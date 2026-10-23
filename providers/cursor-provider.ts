import type { AIProvider, InstructionContext, InstructionResult } from "./ai-provider.js";
import { runCliProcess, runCliStream } from "./utils/cli-runner.js";
import { applyCliStreamJsonLine, formatChatMessagesForCliPrompt, getChatWorkspace } from "./utils/cli-chat-messages.js";
import {
  appendLineCommandOutput,
  buildPrompt,
  clearCommandOutput,
  getADWCliPath,
  getAdwModel,
  getTimeoutMs,
  saveCommandOutput,
} from "./utils/provider-common.js";
import type { ChatMessage, StreamChatChunkType, StreamChatResult, Tool } from "./utils/chat-types.js";
import { ResolvedAdwConfig } from "../utils/adw-config.js";

export type CursorChatServiceOptions = {
  /** Working directory / `--workspace` (default: PROJECT_ROOT or process.cwd()). */
  workspace?: string;
};

function modelCliArgs(model: string): string[] {
  const m = model.trim();
  return m ? ["--model", m] : [];
}

/**
 * Chat service using Cursor Agent CLI (stream-json). Does not return native tool_calls;
 * the CLI runs tools internally; tool-related stream lines are passed via onChunk only.
 */
export function createCursorChatService(
  options?: CursorChatServiceOptions,
) {
  const workspace = getChatWorkspace(options?.workspace);
  const cliPath = getADWCliPath();
  const model = getAdwModel();
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
      const timeoutMs = getTimeoutMs("ADW_CURSOR_TIMEOUT_MS");
      const state = { content: "", thinking: "" };
      let lastStreamModel: string | undefined;

      const forwardMeta = (meta: { model?: string }) => {
        if (!meta.model || meta.model === lastStreamModel) return;
        lastStreamModel = meta.model;
        onStreamMeta?.(meta);
      };

      try {
        const { exitCode, stderr } = await runCliStream({
          cliPath,
          args: [
            "-p",
            transcript,
            "-f",
            ...modelCliArgs(model),
            "--output-format",
            "stream-json",
            "--stream-partial-output",
            "--workspace",
            workspace,
          ],
          cwd: workspace,
          timeoutMs,
          signal,
          onLine: (line) => {
            applyCliStreamJsonLine(line, state, onChunk, forwardMeta);
          },
        });

        if (exitCode !== 0 && !state.content.trim()) {
          throw new Error(stderr.trim() || `Cursor CLI exited with code ${exitCode}`);
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
 * Cursor CLI is invoked with -p (prompt) and -f (force) for non-interactive use.
 * See https://cursor.com/docs/cli/overview and https://cursor.com/docs/cli/reference/parameters
 * Use ADW_AI_PATH=agent if your binary is "agent" instead of "cursor".
 */
export function createCursorProvider(config?: ResolvedAdwConfig): AIProvider {

  const cliPath = getADWCliPath(config);
  const model = getAdwModel(config);

  async function run(ctx: InstructionContext): Promise<InstructionResult> {
    const prompt = await buildPrompt(ctx);
    if (!prompt) {
      return { exitCode: 1, stdout: "", stderr: "Unknown step" };
    }

    const timeoutMs = getTimeoutMs("ADW_CURSOR_TIMEOUT_MS");
    clearCommandOutput(ctx.step, ctx.adwId, ctx.repoRoot);
    let stdout = "";

    try {
      const { exitCode, stderr } = await runCliProcess({
        cliPath,
        args: [
          "-p",
          prompt,
          "-f",
          ...modelCliArgs(model),
          "--output-format",
          "stream-json",
          "--stream-partial-output",
          "--workspace",
          ctx.workPath,
        ],
        cwd: ctx.workPath,
        timeoutMs,
        onStdoutChunk: (chunk) => {
          const lines = chunk.trim().split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            appendLineCommandOutput(ctx.step, line, ctx.adwId, ctx.repoRoot);
            try {
              const json = JSON.parse(line);
              if (json.type === "result" && json.subtype === "success") {
                stdout = json.result;
              }
            } catch { }
          }
        },
        onStderrChunk: (chunk) => {
          try {
            const line = JSON.parse(chunk);
            appendLineCommandOutput(ctx.step, line, ctx.adwId, ctx.repoRoot, "error.log");
          } catch {
            appendLineCommandOutput(ctx.step, chunk, ctx.adwId, ctx.repoRoot, "error.log");
          }
        },
      });

      saveCommandOutput(ctx.step, stdout, stderr, ctx.adwId, ctx.repoRoot);
      return { exitCode, stdout, stderr };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLineCommandOutput(ctx.step, msg, ctx.adwId, ctx.repoRoot, "error.log");
      return { exitCode: 1, stdout: "", stderr: msg };
    }
  }

  return { run };
}
