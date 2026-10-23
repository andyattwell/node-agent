import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import type { AIProvider, InstructionContext, InstructionResult } from "./ai-provider.js";
import type { ChatMessage, StreamChatChunkType, StreamChatResult, Tool } from "./utils/chat-types.js";
import {
  getLLMServerBaseUrlFromConfig,
  getResolvedAdwModelFromConfig,
  saveCommandOutput,
  buildPrompt,
  getAdwModel,
} from "./utils/provider-common.js";

export type CustomProviderOptions = {
  tools?: Tool[];
  toolDescriptionToName?: Record<string, string>;
};

/**
 * Consolidates all HTTP-based AI providers (Ollama, Llama-CPP, Gemini)
 * into a single unified Custom provider.
 */
export function createCustomProvider(
  config: ResolvedAdwConfig,
  options?: CustomProviderOptions,
): AIProvider {
  const tools = options?.tools ?? [];
  const toolDescriptionToName = options?.toolDescriptionToName ?? {};

  async function run(ctx: InstructionContext): Promise<InstructionResult> {
    const model = getResolvedAdwModelFromConfig(config);
    const baseUrl = getLLMServerBaseUrlFromConfig(config);

    const prompt = await buildPrompt(ctx);
    if (!prompt) {
      const result = { exitCode: 1, stdout: "", stderr: "Unknown step" };
      await saveCommandOutput(ctx.step, result.stdout, result.stderr, ctx.adwId, ctx.repoRoot);
      return result;
    }

    try {
      const response = await fetch(`${baseUrl}/api/chat/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          tools,
          toolDescriptionToName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const result = {
          exitCode: 1,
          stdout: "",
          stderr: `HTTP ${response.status}: ${errorText || response.statusText}`,
        };
        await saveCommandOutput(ctx.step, result.stdout, result.stderr, ctx.adwId, ctx.repoRoot);
        return result;
      }

      const parsed = (await response.json()) as Partial<InstructionResult>;
      const result = {
        exitCode: parsed.exitCode ?? 0,
        stdout: parsed.stdout ?? "",
        stderr: parsed.stderr ?? "",
      };
      await saveCommandOutput(ctx.step, result.stdout, result.stderr, ctx.adwId, ctx.repoRoot);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const result = {
        exitCode: 1,
        stdout: "",
        stderr: msg,
      };
      await saveCommandOutput(ctx.step, result.stdout, result.stderr, ctx.adwId, ctx.repoRoot);
      return result;
    }
  }

  return {
    run,
  };
}

/**
 * Creates a consolidated chat service for HTTP backends.
 */
export function createCustomChatService(
  _model?: string,
  options?: { baseUrl?: string },
) {
  return {
    async streamChat(
      messages: ChatMessage[],
      tools: Tool[],
      toolDescriptionToName: Record<string, string>,
      onChunk?: (text: string, type: StreamChatChunkType) => void,
      signal?: AbortSignal,
      onStreamMeta?: (meta: { model?: string }) => void,
    ): Promise<StreamChatResult> {
      const baseUrl = options?.baseUrl || getLLMServerBaseUrlFromConfig();
      const model = _model || getAdwModel();
      onStreamMeta?.({ model });
      const response = await fetch(`${baseUrl}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          toolDescriptionToName,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body received from stream endpoint");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let thinking = "";
      const tool_calls: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              const type = (parsed.type || "content") as StreamChatChunkType;
              const text = parsed.text || parsed.content || "";

              if (text) {
                if (type === "thinking") {
                  thinking += text;
                } else if (type === "content") {
                  content += text;
                }
                onChunk?.(text, type);
              }

              if (parsed.tool_calls) {
                tool_calls.push(...parsed.tool_calls);
              } else if (parsed.tool_call) {
                tool_calls.push(parsed.tool_call);
              }

              if (parsed.model) {
                onStreamMeta?.({ model: parsed.model });
              }
            } catch {
              // Ignore line parse errors
            }
          }
        }

        // Process final line if any
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim());
            const type = (parsed.type || "content") as StreamChatChunkType;
            const text = parsed.text || parsed.content || "";

            if (text) {
              if (type === "thinking") {
                thinking += text;
              } else if (type === "content") {
                content += text;
              }
              onChunk?.(text, type);
            }

            if (parsed.tool_calls) {
              tool_calls.push(...parsed.tool_calls);
            } else if (parsed.tool_call) {
              tool_calls.push(parsed.tool_call);
            }

            if (parsed.model) {
              onStreamMeta?.({ model: parsed.model });
            }
          } catch {
            // ignore
          }
        }
      } finally {
        reader.releaseLock();
      }

      return {
        content,
        thinking,
        tool_calls,
      };
    },
  };
}
