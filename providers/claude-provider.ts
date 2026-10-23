import type { AIProvider, InstructionContext, InstructionResult } from "./ai-provider.js";
import { runCliProcess, runCliStream } from "./utils/cli-runner.js";
import { applyCliStreamJsonLine, formatChatMessagesForCliPrompt, getChatWorkspace } from "./utils/cli-chat-messages.js";
import {
  buildPrompt,
  getADWCliPath,
  getAdwModel,
  getTimeoutMs,
  saveCommandOutput,
} from "./utils/provider-common.js";
import type { ChatMessage, StreamChatChunkType, StreamChatResult, Tool } from "./utils/chat-types.js";
import { ResolvedAdwConfig } from "../utils/adw-config.js";

export type ClaudeChatServiceOptions = {
  workspace?: string;
};

function modelCliArgs(model: string): string[] {
  const m = model.trim();
  return m && m !== "auto" ? ["--model", m] : [];
}

/**
 * Chat service using Claude Code CLI (stream-json). Does not return native tool_calls;
 * tool activity may appear via onChunk only.
 */
export function createClaudeChatService(
  cliPath: string,
  model: string,
  options?: ClaudeChatServiceOptions,
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
      const timeoutMs = getTimeoutMs("ADW_CLAUDE_TIMEOUT_MS");
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
            ...modelCliArgs(model),
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--dangerously-skip-permissions",
          ],
          cwd: workspace,
          timeoutMs,
          signal,
          onLine: (line) => {
            applyCliStreamJsonLine(line, state, onChunk, forwardMeta);
          },
        });

        if (exitCode !== 0 && !state.content.trim()) {
          throw new Error(stderr.trim() || `Claude CLI exited with code ${exitCode}`);
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
 * Claude Code CLI is invoked with -p (prompt) for non-interactive (print) mode.
 * See https://code.claude.com/docs/en/headless and https://docs.claude.com/en/docs/claude-code/cli-reference
 * Use CLAUDE_CLI_PATH=claude if your binary is not on PATH.
 */
export function createClaudeProvider(config?: ResolvedAdwConfig): AIProvider {
  const cliPath = getADWCliPath(config);
  const model = getAdwModel(config);
  async function run(ctx: InstructionContext): Promise<InstructionResult> {

    const prompt = await buildPrompt(ctx);
    if (!prompt) {
      return { exitCode: 1, stdout: "", stderr: "Unknown step" };
    }

    const timeoutMs = getTimeoutMs("ADW_CLAUDE_TIMEOUT_MS");
    try {
      const res = await runCliProcess({
        cliPath,
        args: [
          "-p",
          prompt,
          ...modelCliArgs(model),
          "--output-format",
          "text",
          "--dangerously-skip-permissions",
        ],
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
