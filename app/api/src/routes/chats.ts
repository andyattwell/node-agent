import { Router } from "express";
import { getDB } from "../db.js";
import type { ChatSessionRow } from "../types.js";
import {
  createChatSession,
  loadChatMessages,
  listChatSessions,
} from "../services/chat.js";

const router = Router();

router.get("/chats", async (_req, res) => {
  const sessions = await listChatSessions();
  res.json({ sessions });
});

router.get("/chats/:id", async (req, res) => {
  const { id } = req.params;
  const { chatSessionRepo } = await getDB();
  const session = (await chatSessionRepo.findOne({ where: { id } })) as
    | ChatSessionRow
    | undefined
    | null;
  if (!session) {
    res.status(404).json({ error: "Chat session not found" });
    return;
  }
  const rows = await loadChatMessages(id);
  const messages = rows.map((r) => {
    let images: string[] | undefined;
    if (r.images) {
      try {
        const v = JSON.parse(r.images) as unknown;
        if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
          images = v as string[];
        }
      } catch {
        /* ignore */
      }
    }
    return {
      role: r.role,
      content: r.content,
      thinking: r.thinking ?? undefined,
      tool_calls: r.tool_calls
        ? (JSON.parse(r.tool_calls) as unknown)
        : undefined,
      tool_name: r.tool_name ?? undefined,
      ...(images?.length ? { images } : {}),
    };
  });
  res.json({ session, messages });
});

router.delete("/chats/:id", async (req, res) => {
  const { id } = req.params;
  const { chatSessionRepo, chatMessageRepo } = await getDB();
  const session = await chatSessionRepo.findOne({ where: { id } });
  if (!session) {
    res.status(404).json({ error: "Chat session not found" });
    return;
  }
  await chatMessageRepo.delete({ session_id: id });
  await chatSessionRepo.delete({ id });
  res.json({ status: "deleted", id });
});

export default router;
