import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "path";
import type { WebSocket, WebSocketServer } from "ws";
import type { ChatMessageRow } from "../types.js";
import {
  createChatSession,
  ensureChatSessionExists,
  historyMessagesToRows,
  loadChatMessages,
  saveChatMessages,
  type HistoryMessage,
} from "../services/chat.js";
import { getProjectRoot } from "../utils.js";
import { parseChatProviderOverride } from "../../../../adw/dist/providers/provider-common.js";

/** Normalize client `images` to raw base64 strings; cap count and size. */
function parseBridgeImages(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const el of raw) {
    if (typeof el !== "string" || el.length === 0) return undefined;
    let b64 = el.trim();
    const comma = b64.indexOf(",");
    if (b64.startsWith("data:") && comma !== -1) {
      b64 = b64.slice(comma + 1);
    }
    if (b64.length > 14_000_000) return undefined;
    out.push(b64);
    if (out.length > 8) return undefined;
  }
  return out.length > 0 ? out : undefined;
}

export function attachChatWebSocket(wss: WebSocketServer): void {
  wss.on("connection", (ws: WebSocket) => {
    const projectRoot = getProjectRoot();
    let chatChild: ChildProcess | null = null;
    let currentSessionId: string | null = null;

    const send = (obj: object) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(obj));
      }
    };

    function spawnChild(initialMessages?: HistoryMessage[]): ChildProcess {
      /** Run compiled chat: `tsx` uses esbuild and breaks TypeORM legacy decorators on entities. */
      const chatJs = join(projectRoot, "adw", "dist", "chat.js");
      const adwDir = join(projectRoot, "adw");
      const child = fs.existsSync(chatJs)
        ? spawn(process.execPath, [chatJs], {
            cwd: projectRoot,
            stdio: ["pipe", "pipe", "pipe"],
            env: process.env,
          })
        : spawn("npm", ["run", "chat"], {
            cwd: adwDir,
            stdio: ["pipe", "pipe", "pipe"],
            env: process.env,
          });
      let stdoutBuffer = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as {
              event?: string;
              text?: string;
              type?: "thinking" | "content" | "tool_call" | "tool_response";
              messages?: HistoryMessage[];
              promptTokens?: number;
              completionTokens?: number;
              contextLimit?: number;
              provider?: string;
              model?: string;
            };
            if (parsed.event === "meta") {
              send({
                type: "meta",
                provider:
                  typeof parsed.provider === "string" ? parsed.provider : "",
                model: typeof parsed.model === "string" ? parsed.model : "",
              });
            } else if (parsed.event === "chunk" && parsed.text !== undefined) {
              send({
                type: "chunk",
                text: parsed.text,
                chunkType: parsed.type ?? "content",
              });
            } else if (parsed.event === "context") {
              send({
                type: "context",
                promptTokens: parsed.promptTokens ?? 0,
                completionTokens: parsed.completionTokens ?? 0,
                contextLimit: parsed.contextLimit ?? 0,
              });
            } else if (parsed.event === "response_end") {
              send({ type: "done", sessionId: currentSessionId ?? undefined });
            } else if (
              parsed.event === "history" &&
              Array.isArray(parsed.messages) &&
              currentSessionId
            ) {
              const rows = historyMessagesToRows(parsed.messages);
              void saveChatMessages(currentSessionId, rows).catch(
                (err: unknown) => {
                  console.error("saveChatMessages failed:", err);
                },
              );
            }
          } catch {
            console.error("malformed line", line);
            // ignore malformed lines
          }
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        send({ type: "stderr", text: chunk.toString() });
      });
      child.on("close", (code) => {
        chatChild = null;
        send({
          type: "done",
          code: code ?? undefined,
          sessionId: currentSessionId ?? undefined,
        });
      });
      if (
        initialMessages &&
        initialMessages.length > 0 &&
        child.stdin?.writable
      ) {
        child.stdin.write(
          JSON.stringify({ type: "init", messages: initialMessages }) + "\n",
        );
      }
      return child;
    }

    ws.on("message", async (data: Buffer | ArrayBuffer | Buffer[] | string) => {
      try {
        const raw =
          typeof data === "string"
            ? data
            : Buffer.isBuffer(data)
              ? data.toString()
              : Array.isArray(data)
                ? Buffer.concat(data).toString()
                : Buffer.from(data as ArrayBuffer).toString();
        const msg = JSON.parse(raw) as {
          type?: string;
          content?: string;
          sessionId?: string;
          provider?: string;
          model?: string | null;
          images?: unknown;
        };
        if (msg.type === "stop") {
          chatChild?.kill();
          return;
        }
        if (msg.type !== "message" || typeof msg.content !== "string") {
          send({ type: "error", message: "Invalid message" });
          return;
        }
        const bridgeImages = parseBridgeImages(msg.images);
        if (!msg.content.trim() && !bridgeImages?.length) {
          send({ type: "error", message: "Message or images required" });
          return;
        }
        if (
          typeof msg.provider === "string" &&
          msg.provider.trim() !== "" &&
          parseChatProviderOverride(msg.provider) == null
        ) {
          send({
            type: "error",
            message: `Invalid provider: ${msg.provider}`,
          });
          return;
        }
        let sessionId = msg.sessionId ?? null;
        let loadedMessages: HistoryMessage[] = [];
        if (sessionId) {
          const exists = await ensureChatSessionExists(sessionId);
          if (!exists) {
            send({ type: "error", message: "Chat session not found" });
            return;
          }
          const rows = await loadChatMessages(sessionId);
          loadedMessages = rows.map((r: ChatMessageRow) => {
            let images: string[] | undefined;
            if (r.images) {
              try {
                const v = JSON.parse(r.images) as unknown;
                if (
                  Array.isArray(v) &&
                  v.every((x) => typeof x === "string")
                ) {
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
                ? (JSON.parse(r.tool_calls) as unknown[])
                : undefined,
              tool_name: r.tool_name ?? undefined,
              ...(images?.length ? { images } : {}),
            };
          });
        } else {
          sessionId = randomUUID();
          await createChatSession(sessionId);
          currentSessionId = sessionId;
        }
        currentSessionId = sessionId;
        if (!chatChild) {
          chatChild = spawnChild(loadedMessages);
        }
        if (!chatChild.stdin?.writable) {
          send({ type: "error", message: "Chat process not running" });
          return;
        }
        const bridgeLine: Record<string, unknown> = {
          type: "message",
          content: msg.content,
        };
        if (typeof msg.provider === "string" && msg.provider.trim() !== "") {
          bridgeLine.provider = msg.provider.trim();
        }
        if (Object.prototype.hasOwnProperty.call(msg, "model")) {
          bridgeLine.model = typeof msg.model === "string" ? msg.model : "";
        }
        if (bridgeImages?.length) {
          bridgeLine.images = bridgeImages;
        }
        chatChild.stdin.write(JSON.stringify(bridgeLine) + "\n");
      } catch (e) {
        send({ type: "error", message: String(e) });
      }
    });

    ws.on("close", () => {
      chatChild?.kill();
    });
  });
}
