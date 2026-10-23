import type { EntityManager } from "typeorm";
import { join } from "path";
import type { ChatMessageRow, ChatSessionRow } from "../types.js";
import { getDB } from "../db.js";
import { getProjectRoot } from "../utils.js";

export interface HistoryMessage {
  role: string;
  content: string;
  thinking?: string;
  tool_calls?: unknown[];
  tool_name?: string;
  /** Base64-encoded image payloads for Ollama vision models. */
  images?: string[];
}

async function createChatSession(
  id: string,
  title?: string | null,
): Promise<void> {
  const { chatSessionRepo } = await getDB();
  const existing = await chatSessionRepo.findOne({ where: { id } });
  if (!existing) {
    await chatSessionRepo.save(
      chatSessionRepo.create({ id, title: title ?? null }),
    );
  }
}

/** Serialize DB writes per session so concurrent `history` events cannot race on (session_id, sequence). */
const chatMessageSaveTail = new Map<string, Promise<unknown>>();

async function saveChatMessagesTransactional(
  sessionId: string,
  messages: ChatMessageRow[],
): Promise<void> {
  const root = getProjectRoot();
  const dbModPath = join(root, "adw", "dist", "utils", "db.js");
  const mod = await import(dbModPath);
  const ds = await mod.getDataSource();
  const ChatMessage = mod.ChatMessage;
  const ChatSession = mod.ChatSession;

  await ds.transaction(async (manager: EntityManager) => {
    await manager.delete(ChatMessage, { session_id: sessionId });
    if (messages.length > 0) {
      await manager.insert(
        ChatMessage,
        messages.map((m, i) => ({
          session_id: sessionId,
          sequence: i,
          role: m.role,
          content: m.content,
          thinking: m.thinking ?? null,
          tool_calls: m.tool_calls ?? null,
          tool_name: m.tool_name ?? null,
          images: m.images ?? null,
        })),
      );
    }
    await manager.update(
      ChatSession,
      { id: sessionId },
      { updated_at: new Date().toISOString() },
    );
  });
}

export async function saveChatMessages(
  sessionId: string,
  messages: ChatMessageRow[],
): Promise<void> {
  const prev = chatMessageSaveTail.get(sessionId) ?? Promise.resolve();
  const current = prev.then(() =>
    saveChatMessagesTransactional(sessionId, messages),
  );
  chatMessageSaveTail.set(
    sessionId,
    current.catch(() => undefined),
  );
  await current;
}

export async function loadChatMessages(
  sessionId: string,
): Promise<ChatMessageRow[]> {
  const { chatMessageRepo } = await getDB();
  const rows = (await chatMessageRepo.find({
    where: { session_id: sessionId },
    order: { sequence: "ASC" },
  })) as {
    role: string;
    content: string;
    thinking: string | null;
    tool_calls: string | null;
    tool_name: string | null;
    images: string | null;
  }[];
  return rows.map((r) => ({
    role: r.role,
    content: r.content,
    thinking: r.thinking,
    tool_calls: r.tool_calls,
    tool_name: r.tool_name,
    images: r.images,
  }));
}

export async function listChatSessions(): Promise<ChatSessionRow[]> {
  const { chatSessionRepo } = await getDB();
  const list = (await chatSessionRepo.find({
    order: { updated_at: "DESC" },
  })) as ChatSessionRow[];
  return list;
}

export function historyMessagesToRows(
  messages: HistoryMessage[],
): ChatMessageRow[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    thinking: m.thinking ?? null,
    tool_calls: m.tool_calls ? JSON.stringify(m.tool_calls) : null,
    tool_name: m.tool_name ?? null,
    images:
      m.images && m.images.length > 0 ? JSON.stringify(m.images) : null,
  }));
}

export async function ensureChatSessionExists(
  sessionId: string,
): Promise<boolean> {
  const { chatSessionRepo } = await getDB();
  const row = await chatSessionRepo.findOne({ where: { id: sessionId } });
  return !!row;
}

export { createChatSession };
