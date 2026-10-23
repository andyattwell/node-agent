import logger from "../../utils/logger.js";
import type { ChatMessage, StreamChatChunkType } from "./chat-types.js";
import { iterateNdjsonLines } from "./cli-runner.js";

export { iterateNdjsonLines };

/** Working directory for CLI chat (PROJECT_ROOT or process.cwd()). */
export function getChatWorkspace(override?: string): string {
  if (override?.trim()) return override.trim();
  const fromEnv = process.env.PROJECT_ROOT?.trim();
  return fromEnv || process.cwd();
}

/**
 * Extract concatenated text from Cursor/Claude assistant `message.content` blocks
 * (`[{ type: "text", text: "..." }, ...]`).
 */
export function extractAssistantTextFromMessage(
  message: Record<string, unknown>,
): string {
  const c = message.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  let out = "";
  for (const block of c) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      out += b.text;
    }
  }
  return out;
}

/**
 * Append an assistant text fragment; skip duplicate "full message" lines that repeat
 * already-streamed deltas (Cursor sends a final assistant line with the full body).
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

function debugCliLog(rawLine: string): void {
  if (process.env.CHAT_DEBUG_CLI === "1") {
    logger.logMessage(`CLI chat message: ${rawLine}`, "chunk");
  }
}

/**
 * Flatten in-app chat history into one prompt string for Cursor/Claude CLIs.
 */
export function formatChatMessagesForCliPrompt(
  messages: ChatMessage[],
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

type StreamState = { content: string; thinking: string };

/** When the CLI reports a resolved model id (Claude stream-json), forward to the UI. */
export type CliStreamMetaCallback = (meta: { model?: string }) => void;

/**
 * Best-effort model id from Cursor/Claude NDJSON (system init, message_start, assistant, result.modelUsage).
 */
export function tryExtractCliStreamModel(
  o: Record<string, unknown>,
): string | undefined {
  const t = typeof o.type === "string" ? o.type : "";

  if (t === "system" && o.subtype === "init" && typeof o.model === "string") {
    const m = o.model.trim();
    if (m && m.toLowerCase() !== "auto") return m;
  }

  if (t === "stream_event" && o.event && typeof o.event === "object") {
    const ev = o.event as Record<string, unknown>;
    if (
      ev.type === "message_start" &&
      ev.message &&
      typeof ev.message === "object"
    ) {
      const msg = ev.message as Record<string, unknown>;
      if (typeof msg.model === "string") {
        const m = msg.model.trim();
        if (m && m !== "auto" && m !== "<synthetic>") return m;
      }
    }
  }

  if (t === "assistant" && o.message && typeof o.message === "object") {
    const msg = o.message as Record<string, unknown>;
    if (typeof msg.model === "string") {
      const m = msg.model.trim();
      if (m && m !== "auto" && m !== "<synthetic>") return m;
    }
  }

  if (
    t === "result" &&
    o.modelUsage &&
    typeof o.modelUsage === "object" &&
    !Array.isArray(o.modelUsage)
  ) {
    const keys = Object.keys(o.modelUsage as Record<string, unknown>);
    for (const k of keys) {
      const id = k.trim();
      if (id && id !== "auto" && !id.toLowerCase().includes("synthetic")) {
        return id;
      }
    }
  }

  return undefined;
}

/**
 * Map one stream-json line to chunks and accumulated assistant text.
 * Shapes differ by CLI version; unknown lines are ignored.
 *
 * Cursor (stream-json): `thinking` + `subtype: delta` + `text`; `assistant` +
 * `message.content[]`; `result` + `result`.
 * Claude (stream-json): `stream_event` + nested `content_block_delta` / `text_delta`;
 * same `assistant` envelope; `result` + `result`.
 */
export function applyCliStreamJsonLine(
  rawLine: string,
  state: StreamState,
  onChunk?: (text: string, type: StreamChatChunkType) => void,
  onStreamMeta?: CliStreamMetaCallback,
): void {
  debugCliLog(rawLine);
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(rawLine) as Record<string, unknown>;
  } catch {
    return;
  }

  const streamModel = tryExtractCliStreamModel(o);
  if (streamModel) {
    onStreamMeta?.({ model: streamModel });
  }

  const t = typeof o.type === "string" ? o.type : "";
  const tl = t.toLowerCase();

  if (t === "system" || t === "user") {
    return;
  }

  // Claude Code: nested streaming API events
  if (t === "stream_event" && o.event && typeof o.event === "object") {
    const ev = o.event as Record<string, unknown>;
    const et = typeof ev.type === "string" ? ev.type : "";

    if (et === "content_block_start" && ev.content_block) {
      const block = ev.content_block as Record<string, unknown>;
      const bt = typeof block.type === "string" ? block.type : "";
      if (
        bt === "tool_use" ||
        bt === "server_tool_use" ||
        bt.includes("tool")
      ) {
        onChunk?.(JSON.stringify(o), "tool_call");
        return;
      }
    }

    if (
      et === "content_block_delta" &&
      ev.delta &&
      typeof ev.delta === "object"
    ) {
      const d = ev.delta as Record<string, unknown>;
      const dt = typeof d.type === "string" ? d.type : "";
      if (
        dt === "text_delta" &&
        typeof d.text === "string" &&
        d.text.length > 0
      ) {
        appendAssistantTextFragment(state, d.text, onChunk);
        return;
      }
      if (dt === "thinking_delta") {
        const th =
          typeof d.thinking === "string"
            ? d.thinking
            : typeof d.text === "string"
              ? d.text
              : "";
        if (th.length > 0) {
          state.thinking += th;
          onChunk?.(th, "thinking");
        }
        return;
      }
    }

    return;
  }

  // Cursor: thinking stream (subtype delta | completed)
  if (t === "thinking") {
    if (typeof o.text === "string" && o.text.length > 0) {
      state.thinking += o.text;
      onChunk?.(o.text, "thinking");
    }
    return;
  }

  /**
   * Cursor stream-json (`type` is literally `tool_call`, not `tool_use` - the old
   * `tool`+`use` substring check never matched).
   * - subtype `started` → display as tool_call
   * - subtype `completed` → display as tool_response (includes result payload)
   */
  if (t === "tool_call") {
    const sub = typeof o.subtype === "string" ? o.subtype.toLowerCase() : "";
    if (sub === "completed") {
      onChunk?.(JSON.stringify(o), "tool_response");
    } else {
      onChunk?.(JSON.stringify(o), "tool_call");
    }
    return;
  }

  if (
    tl === "tool_use" ||
    tl === "tooluse" ||
    (tl.includes("tool") && tl.includes("use") && !tl.includes("result"))
  ) {
    onChunk?.(JSON.stringify(o), "tool_call");
    return;
  }
  if (tl === "tool_result" || (tl.includes("tool") && tl.includes("result"))) {
    onChunk?.(JSON.stringify(o), "tool_response");
    return;
  }

  // Cursor / Claude: assistant with message.content as block array
  if (t === "assistant" && o.message && typeof o.message === "object") {
    const piece = extractAssistantTextFromMessage(
      o.message as Record<string, unknown>,
    );
    if (piece.length > 0) {
      appendAssistantTextFragment(state, piece, onChunk);
    }
    const m = o.message as Record<string, unknown>;
    const rc = m.reasoning_content ?? m.reasoning;
    if (typeof rc === "string" && rc.length > 0) {
      state.thinking += rc;
      onChunk?.(rc, "thinking");
    }
    return;
  }

  if (typeof o.text === "string" && o.text.length > 0) {
    if (
      t === "text" ||
      t === "" ||
      t === "assistant" ||
      tl === "content" ||
      tl === "message"
    ) {
      appendAssistantTextFragment(state, o.text, onChunk);
      return;
    }
  }

  const msg = o.message;
  if (msg && typeof msg === "object") {
    const m = msg as Record<string, unknown>;
    if (typeof m.content === "string" && m.content.length > 0) {
      appendAssistantTextFragment(state, m.content, onChunk);
    }
    const rc = m.reasoning_content ?? m.reasoning;
    if (typeof rc === "string" && rc.length > 0) {
      state.thinking += rc;
      onChunk?.(rc, "thinking");
    }
  }

  const delta = o.delta;
  if (delta && typeof delta === "object") {
    const d = delta as Record<string, unknown>;
    if (typeof d.content === "string" && d.content.length > 0) {
      appendAssistantTextFragment(state, d.content, onChunk);
    }
    const dr = d.reasoning_content ?? d.reasoning;
    if (typeof dr === "string" && dr.length > 0) {
      state.thinking += dr;
      onChunk?.(dr, "thinking");
    }
  }

  if (typeof o.thinking === "string" && o.thinking.length > 0) {
    state.thinking += o.thinking;
    onChunk?.(o.thinking, "thinking");
  }
  if (
    typeof o.reasoning_content === "string" &&
    o.reasoning_content.length > 0
  ) {
    state.thinking += o.reasoning_content;
    onChunk?.(o.reasoning_content, "thinking");
  }

  if (
    t === "result" &&
    o.subtype === "success" &&
    typeof o.result === "string"
  ) {
    if (state.content.length === 0) {
      state.content = o.result;
      onChunk?.(o.result, "content");
    }
  }
}
