import type { AIProvider, InstructionContext, InstructionResult } from "./ai-provider.js";
import { runCliProcess, runCliStream } from "./utils/cli-runner.js";
import {
  applyPiStreamJsonLine,
  formatChatMessagesForCliPrompt,
  getChatWorkspace,
} from "./utils/pi-chat-messages.js";
import {
  buildPrompt,
  saveCommandOutput,
  getPiTimeoutMs,
  getPiThinkingLevel,
  getPiTools,
  getPiExcludeTools,
  getPiNoTools,
  getPiNoSession,
  buildPiCliArgs,
  getAdwModel,
  getADWCliPath,
} from "./utils/provider-common.js";
import type { ChatMessage, StreamChatChunkType, StreamChatResult, Tool } from "./utils/chat-types.js";
import { ResolvedAdwConfig } from "../utils/adw-config.js";

export type PiChatServiceOptions = {
  workspace?: string;
};

/**
 * Build Pi CLI base arguments for non-interactive mode.
 */
function buildPiBaseArgs(prompt: string, mode: "text" | "json"): string[] {
  const args = ["-p", prompt, "--mode", mode];

  const model = getAdwModel();
  if (model) args.push("--model", model);

  // Thinking level
  // const thinking = getPiThinkingLevel();
  // if (thinking) args.push("--thinking", thinking);

  // Tools configuration
  // if (getPiNoTools()) {
  //   args.push("--no-tools");
  // } else {
  //   const tools = getPiTools();
  //   if (tools) args.push("--tools", tools);

  //   const excludeTools = getPiExcludeTools();
  //   if (excludeTools) args.push("--exclude-tools", excludeTools);
  // }

  // Session handling
  // if (getPiNoSession()) {
  //   args.push("--no-session");
  // }

  return args;
}

/**
 * Chat service using Pi CLI (stream-json via --mode json).
 * Tool activity appears via onChunk as tool_response events.
 */
export function createPiChatService(
  cliPath: string,
  options?: PiChatServiceOptions,
) {
  const workspace = getChatWorkspace(options?.workspace);
  return {
    async streamChat(
      messages: ChatMessage[],
      _tools: Tool[],
      _toolDescriptionToName: Record<string, string>,
      onChunk?: (text: string, type: StreamChatChunkType) => void,
      signal?: AbortSignal,
      onStreamMeta?: (meta: { model?: string }) => void,
    ): Promise<StreamChatResult> {
      const transcript = formatChatMessagesForCliPrompt(messages);
      const timeoutMs = getPiTimeoutMs();
      const state = { content: "", thinking: "" };
      let lastStreamModel: string | undefined;

      const forwardMeta = (meta: { model?: string }) => {
        if (!meta.model || meta.model === lastStreamModel) return;
        lastStreamModel = meta.model;
        onStreamMeta?.(meta);
      };

      try {
        const args = buildPiBaseArgs(transcript, "json");
        const { exitCode, stderr } = await runCliStream({
          cliPath,
          args,
          cwd: workspace,
          timeoutMs,
          signal,
          onLine: (line) => {
            applyPiStreamJsonLine(line, state, onChunk, forwardMeta);
          },
        });

        if (exitCode !== 0 && !state.content.trim()) {
          throw new Error(stderr.trim() || `Pi CLI exited with code ${exitCode}`);
        }

        return { content: state.content, thinking: state.thinking, tool_calls: [] };
      } catch (err) {
        if (signal?.aborted) {
          return { content: state.content, thinking: state.thinking, tool_calls: [] };
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
  };
}

/**
 * Pi CLI is invoked with -p (prompt) for non-interactive (print) mode.
 * Use --mode text for simple output, --mode json for streaming NDJSON.
 * See pi --help for all options.
 * Use ADW_PI_CLI_PATH=pi if your binary is not on PATH.
 */
export function createPiProvider(config: ResolvedAdwConfig): AIProvider {
  const cliPath = getADWCliPath(config);
  const model = getAdwModel(config);

  async function run(ctx: InstructionContext): Promise<InstructionResult> {
    const prompt = await buildPrompt(ctx);
    if (!prompt) {
      return { exitCode: 1, stdout: "", stderr: "Unknown step" };
    }

    const timeoutMs = getPiTimeoutMs();
    const args = buildPiBaseArgs(prompt, "text");

    try {
      const res = await runCliProcess({
        cliPath,
        args,
        cwd: ctx.workPath,
        timeoutMs,
      });

      await saveCommandOutput(ctx.step, res.stdout, res.stderr, ctx.adwId, ctx.repoRoot);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stderr = msg + `\n[Timed out after ${timeoutMs}ms]`;
      await saveCommandOutput(ctx.step, "", stderr, ctx.adwId, ctx.repoRoot);
      return { exitCode: 1, stdout: "", stderr };
    }
  }

  return { run };
}