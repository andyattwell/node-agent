import logger from "../../utils/logger.js";
import type { StreamChatChunkType } from "./chat-types.js";
import { getChatWorkspace } from "./cli-chat-messages.js";
import { iterateNdjsonLines } from "./cli-runner.js";

export { getChatWorkspace, iterateNdjsonLines };

/**
 * Pi CLI NDJSON event types (from --mode json output).
 * Reference: pi streaming output format
 */
type PiEventType =
  | "session"
  | "agent_start"
  | "agent_end"
  | "turn_start"
  | "turn_end"
  | "message_start"
  | "message_update"
  | "message_end";

interface PiBaseEvent {
  type: PiEventType;
}

interface PiSessionEvent extends PiBaseEvent {
  type: "session";
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
}

interface PiMessageStartEvent extends PiBaseEvent {
  type: "message_start";
  message: {
    role: "user" | "assistant";
    content: Array<{ type: "text" | "thinking"; text?: string; thinking?: string; thinkingSignature?: string }>;
    api?: string;
    provider?: string;
    model?: string;
    usage?: Record<string, unknown>;
    stopReason?: string;
    timestamp: number;
    responseId?: string;
    responseModel?: string;
  };
}

interface PiMessageUpdateEvent extends PiBaseEvent {
  type: "message_update";
  assistantMessageEvent?: {
    type:
      | "thinking_start"
      | "thinking_delta"
      | "thinking_end"
      | "text_start"
      | "text_delta"
      | "text_end";
    contentIndex: number;
    delta?: string;
    content?: string;
    partial: {
      role: "assistant";
      content: Array<{
        type: "text" | "thinking";
        text?: string;
        thinking?: string;
        thinkingSignature?: string;
      }>;
      api?: string;
      provider?: string;
      model?: string;
      usage?: Record<string, unknown>;
      stopReason?: string;
      timestamp: number;
      responseId?: string;
      responseModel?: string;
    };
  };
  message: {
    role: "assistant";
    content: Array<{ type: "text" | "thinking"; text?: string; thinking?: string; thinkingSignature?: string }>;
    api?: string;
    provider?: string;
    model?: string;
    usage?: Record<string, unknown>;
    stopReason?: string;
    timestamp: number;
    responseId?: string;
    responseModel?: string;
  };
}

interface PiMessageEndEvent extends PiBaseEvent {
  type: "message_end";
  message: {
    role: "assistant";
    content: Array<{ type: "text" | "thinking"; text?: string; thinking?: string; thinkingSignature?: string }>;
    api?: string;
    provider?: string;
    model?: string;
    usage?: Record<string, unknown>;
    stopReason?: string;
    timestamp: number;
    responseId?: string;
    responseModel?: string;
  };
}

interface PiTurnEndEvent extends PiBaseEvent {
  type: "turn_end";
  message: {
    role: "assistant";
    content: Array<{ type: "text" | "thinking"; text?: string; thinking?: string; thinkingSignature?: string }>;
    api?: string;
    provider?: string;
    model?: string;
    usage?: Record<string, unknown>;
    stopReason?: string;
    timestamp: number;
    responseId?: string;
    responseModel?: string;
  };
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
  }>;
}

type PiEvent =
  | PiSessionEvent
  | PiBaseEvent
  | PiMessageStartEvent
  | PiMessageUpdateEvent
  | PiMessageEndEvent
  | PiTurnEndEvent;

type StreamState = { content: string; thinking: string };

/** When the CLI reports a resolved model id (Pi stream-json), forward to the UI. */
export type CliStreamMetaCallback = (meta: { model?: string }) => void;

/**
 * Extract model info from Pi event.
 */
function tryExtractPiStreamModel(event: PiEvent): string | undefined {
  // message_start for assistant has model info
  if (event.type === "message_start") {
    const e = event as PiMessageStartEvent;
    if (e.message.role === "assistant") {
      const m = e.message.model?.trim();
      if (m && m !== "auto" && m !== "<synthetic>") return m;
    }
  }

  // message_update partial has model info
  if (event.type === "message_update") {
    const e = event as PiMessageUpdateEvent;
    if (e.message?.model) {
      const m = e.message.model?.trim();
      if (m && m !== "auto" && m !== "<synthetic>") return m;
    }
  }

  // message_end has model info
  if (event.type === "message_end") {
    const e = event as PiMessageEndEvent;
    if (e.message?.model) {
      const m = e.message.model?.trim();
      if (m && m !== "auto" && m !== "<synthetic>") return m;
    }
  }

  // turn_end has model info
  if (event.type === "turn_end") {
    const e = event as PiTurnEndEvent;
    if (e.message?.model) {
      const m = e.message.model?.trim();
      if (m && m !== "auto" && m !== "<synthetic>") return m;
    }
  }

  return undefined;
}

function debugCliLog(rawLine: string): void {
  if (process.env.CHAT_DEBUG_CLI === "1") {
    logger.logMessage(`Pi CLI chat message: ${rawLine}`, "chunk");
  }
}

/**
 * Flatten in-app chat history into one prompt string for Pi CLI.
 * Reuses the same format as Claude/Cursor since Pi accepts a prompt string.
 */
export function formatChatMessagesForCliPrompt(
  messages: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
    images?: string[];
    thinking?: string;
    tool_calls?: Array<{
      id?: string;
      function: { name: string; arguments: Record<string, unknown> };
    }>;
    tool_name?: string;
    tool_call_id?: string;
  }>,
): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const imgNote =
        m.images && m.images.length > 0
          ? `\n[${m.images.length} image(s) attached — not shown in CLI transcript]`
          : "";
      parts.push(`User:\n${m.content.trim()}${imgNote}`);
      continue;
    }
    if (m.role === "assistant") {
      let block = "Assistant:";
      if (m.thinking?.trim()) {
        block += `\n[thinking]\n${m.thinking.trim()}\n[/thinking]`;
      }
      if (m.content?.trim()) {
        block += `\n${m.content.trim()}`;
      }
      if (m.tool_calls?.length) {
        block += `\n[tool_calls]\n${JSON.stringify(m.tool_calls, null, 2)}`;
      }
      parts.push(block);
      continue;
    }
    if (m.role === "tool") {
      const id = m.tool_call_id ? ` (id=${m.tool_call_id})` : "";
      const name = m.tool_name ?? "tool";
      parts.push(`Tool result${id} (${name}):\n${m.content}`);
    }
  }
  return parts.join("\n\n---\n\n");
}

/**
 * Append an assistant text fragment; skip duplicate "full message" lines that repeat
 * already-streamed deltas.
 */
function appendAssistantTextFragment(
  state: StreamState,
  piece: string,
  onChunk?: (text: string, type: StreamChatChunkType) => void,
): void {
  if (!piece) return;
  if (state.content.length > 0) {
    if (piece === state.content || piece.trim() === state.content.trim()) {
      return;
    }
    if (piece.startsWith(state.content)) {
      const delta = piece.slice(state.content.length);
      state.content = piece;
      if (delta) onChunk?.(delta, "content");
      return;
    }
  }
  state.content += piece;
  onChunk?.(piece, "content");
}

/**
 * Map one Pi stream-json line to chunks and accumulated assistant text.
 * Handles Pi's event-based NDJSON format with message_update events.
 */
export function applyPiStreamJsonLine(
  rawLine: string,
  state: StreamState,
  onChunk?: (text: string, type: StreamChatChunkType) => void,
  onStreamMeta?: CliStreamMetaCallback,
): void {
  debugCliLog(rawLine);
  let event: PiEvent;
  try {
    event = JSON.parse(rawLine) as PiEvent;
  } catch {
    return;
  }

  const streamModel = tryExtractPiStreamModel(event);
  if (streamModel) {
    onStreamMeta?.({ model: streamModel });
  }

  switch (event.type) {
    case "session":
    case "agent_start":
    case "turn_start":
      // Meta events, ignore for content streaming
      return;

    case "message_start": {
      const e = event as PiMessageStartEvent;
      if (e.message.role === "assistant") {
        // Model info already extracted above
        // Could emit initial empty state if needed
      }
      return;
    }

    case "message_update": {
      const e = event as PiMessageUpdateEvent;
      const ame = e.assistantMessageEvent;
      if (!ame) return;

      switch (ame.type) {
        case "thinking_start":
          // Start of thinking block - partial may have initial content
          if (ame.partial?.content?.[0]?.thinking) {
            const thinking = ame.partial.content[0].thinking;
            if (thinking) {
              state.thinking += thinking;
              onChunk?.(thinking, "thinking");
            }
          }
          return;

        case "thinking_delta":
          if (typeof ame.delta === "string" && ame.delta.length > 0) {
            state.thinking += ame.delta;
            onChunk?.(ame.delta, "thinking");
          }
          return;

        case "thinking_end":
          // Thinking complete - full content in partial
          if (ame.partial?.content?.[0]?.thinking) {
            const thinking = ame.partial.content[0].thinking;
            // Only add new content not already streamed via deltas
            if (thinking.length > state.thinking.length) {
              const newThinking = thinking.slice(state.thinking.length);
              state.thinking = thinking;
              onChunk?.(newThinking, "thinking");
            } else {
              state.thinking = thinking;
            }
          }
          return;

        case "text_start":
          // Start of text block - partial may have initial content
          if (ame.partial?.content?.[1]?.text) {
            const text = ame.partial.content[1].text;
            if (text) {
              appendAssistantTextFragment(state, text, onChunk);
            }
          }
          return;

        case "text_delta":
          if (typeof ame.delta === "string" && ame.delta.length > 0) {
            appendAssistantTextFragment(state, ame.delta, onChunk);
          }
          return;

        case "text_end":
          // Text complete - full content in partial
          if (ame.partial?.content?.[1]?.text) {
            const text = ame.partial.content[1].text;
            // Only add new content not already streamed via deltas
            if (text.length > state.content.length) {
              const newText = text.slice(state.content.length);
              state.content = text;
              onChunk?.(newText, "content");
            } else {
              state.content = text;
            }
          }
          return;
      }
      return;
    }

    case "message_end":
      // Final message state - could use for verification
      return;

    case "turn_end": {
      const e = event as PiTurnEndEvent;
      // Tool results are available here
      if (e.toolResults?.length) {
        for (const tr of e.toolResults) {
          const toolCallJson = JSON.stringify({
            type: "tool_result",
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            result: tr.result,
            isError: tr.isError,
          });
          onChunk?.(toolCallJson, "tool_response");
        }
      }
      return;
    }

    case "agent_end":
      // Session complete
      return;

    default:
      // Unknown event type, ignore
      return;
  }
}
