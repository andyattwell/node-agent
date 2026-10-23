/**
 * Chat with the AI
 * @author: @andyattwell
 * @date: 2026-03-17
 * @version: 1.0.0
 * @description: Chat via Cursor CLI, Claude CLI, Pi CLI, or custom server
 * (ADW_AI_PROVIDER=cursor | claude | pi | custom)
 * CLI: npm run chat -- --message="Hello" or CHAT_MESSAGE=Hello (uses dist/chat.js after build)
 * Streaming (API): WebSocket gateway runs node adw/dist/chat.js with stdin pipe
 */

import { createInterface } from "node:readline";
import fs from "node:fs";
import dotenv from "dotenv";
import { createClaudeChatService } from "./providers/claude-provider.js";
import { createCursorChatService } from "./providers/cursor-provider.js";
import { createCustomChatService } from "./providers/custom-provider.js";
import { createPiChatService } from "./providers/pi-provider.js";
import type { ChatMessage, StreamChatChunkType, StreamChatResult, Tool } from "./providers/utils/chat-types.js";
import type { ChatCapableProviderName } from "./providers/utils/provider-common.js";
import {
  getAdwModel,
  getChatContextWindowTokens,
  getChatModelLabel,
  getADWCliPath,
  getProviderName,
  parseChatProviderOverride,
  sanitizeChatModelOverride,
} from "./providers/utils/provider-common.js";
import {
  TOOL_DESCRIPTION_TO_NAME,
  toolFunctions,
  TOOLS,
  validateToolArgs,
} from "./utils/tools/index.js";
import { expandCommand, identifyCommand } from "./utils/tools/commands.js";
import logger from "./utils/logger.js";
dotenv.config();

let messages: ChatMessage[] = [];
let chatService = createChatService();

interface ChatService {
  streamChat(
    messages: ChatMessage[],
    tools: Tool[],
    toolDescriptionToName: Record<string, string>,
    onChunk?: (text: string, type: StreamChatChunkType) => void,
    signal?: AbortSignal,
    onStreamMeta?: (meta: { model?: string }) => void,
  ): Promise<StreamChatResult>;
}

function createChatService(): ChatService {
  const provider = getProviderName();
  switch (provider) {
    case "cursor":
      return createCursorChatService();
    case "claude":
      return createClaudeChatService(getADWCliPath(), getAdwModel());
    case "pi":
      return createPiChatService(getADWCliPath());
    case "custom":
      return createCustomChatService(getAdwModel());
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Apply per-message provider/model from the API bridge (mutates process.env, recreates service).
 */
function applyChatRuntimeConfig(opts: {
  provider?: ChatCapableProviderName;
  hasModelKey: boolean;
  model: string;
}): void {
  if (opts.provider != null) {
    process.env.ADW_AI_PROVIDER = opts.provider;
  }
  const p = getProviderName();
  if (p === "none") {
    throw new Error(
      "Chat requires a provider: set ADW_AI_PROVIDER or send provider from the client.",
    );
  }
  if (opts.hasModelKey) {
    if (opts.model) process.env.ADW_AI_MODEL = opts.model;
    else delete process.env.ADW_AI_MODEL;
  }
  chatService = createChatService();
}

function isBridgeMessagePayload(parsed: unknown): parsed is {
  type: "message";
  content: string;
  provider?: string;
  model?: string;
  images?: string[];
} {
  if (typeof parsed !== "object" || parsed === null) return false;
  const p = parsed as {
    type?: unknown;
    content?: unknown;
    images?: unknown;
  };
  if (p.type !== "message" || typeof p.content !== "string") return false;
  if (p.images !== undefined) {
    if (!Array.isArray(p.images)) return false;
    if (!p.images.every((x) => typeof x === "string")) return false;
  }
  return true;
}

function applyChatRuntimeConfigFromBridgePayload(
  parsed: {
    provider?: string;
    model?: string;
  },
  raw: Record<string, unknown>,
): void {
  let provider: ChatCapableProviderName | undefined;
  const provRaw = parsed.provider;
  if (typeof provRaw === "string" && provRaw.trim() !== "") {
    const p = parseChatProviderOverride(provRaw);
    if (p == null) {
      throw new Error(`Invalid chat provider: ${provRaw}`);
    }
    provider = p;
  }
  const hasModelKey = Object.prototype.hasOwnProperty.call(raw, "model");
  const model = hasModelKey ? sanitizeChatModelOverride(parsed.model) : "";
  applyChatRuntimeConfig({ provider, hasModelKey, model });
}

function getParams(): Record<string, string> {
  const args = process.argv.slice(2);
  return args.reduce((acc: Record<string, string>, arg: string) => {
    const [key, value] = arg.split("=");
    acc[key as keyof typeof acc] = value ?? "";
    return acc;
  }, {});
}

/**
 * NDJSON protocol for the API WebSocket bridge. Uses writeSync so lines flush
 * immediately when stdout is a pipe (otherwise libc may block-buffer and the
 * UI receives everything at end of turn).
 */
function writeProtocolLine(payload: object): void {
  const line = JSON.stringify(payload) + "\n";
  try {
    fs.writeSync(1, Buffer.from(line, "utf8"));
  } catch {
    process.stdout.write(line);
  }
}

function emitChunk(
  text: string,
  type: "thinking" | "content" | "tool_call" | "tool_response",
): void {
  writeProtocolLine({ event: "chunk", text, type });
}

function emitResponseEnd(): void {
  writeProtocolLine({ event: "response_end" });
}

function emitHistory(): void {
  writeProtocolLine({ event: "history", messages });
}

function emitContext(usage: {
  promptTokens: number;
  completionTokens: number;
}): void {
  writeProtocolLine({
    event: "context",
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    contextLimit: getChatContextWindowTokens(),
  });
}

/** Emitted at the start of each user turn so clients can show provider / model. */
function emitChatMeta(): void {
  writeProtocolLine({
    event: "meta",
    provider: getProviderName(),
    model: getChatModelLabel(),
  });
}

/** When Claude (or Cursor) stream-json reports a resolved model id, refresh the UI. */
function emitChatMetaFromStream(meta: { model: string }): void {
  writeProtocolLine({
    event: "meta",
    provider: getProviderName(),
    model: meta.model,
  });
}

async function sendMessageToModel(
  message?: string,
  bridgeImages?: string[],
): Promise<void> {
  if (message !== undefined) {
    emitChatMeta();
  }
  const trimmed = message?.trim() ?? "";
  const images =
    bridgeImages && bridgeImages.length > 0 ? bridgeImages : undefined;
  const hasText = trimmed.length > 0;
  const hasImages = !!images?.length;

  if (message !== undefined && (hasText || hasImages)) {
    let text = trimmed;
    if (hasText) {
      const command = identifyCommand(trimmed);
      if (command) {
        text = expandCommand(command, trimmed) ?? trimmed;
      }
    }
    const contentForModel = hasText
      ? text
      : hasImages
        ? "Describe this image."
        : "";
    if (hasText) {
      logger.logMessage(`User: ${text}`, "chat");
    } else {
      logger.logMessage(`User: [${images!.length} image(s)]`, "chat");
    }
    messages.push({
      role: "user",
      content: contentForModel,
      ...(hasImages ? { images } : {}),
    });
  }

  const {
    content,
    thinking,
    tool_calls: toolCalls,
    usage,
  } = await chatService.streamChat(
    messages,
    TOOLS,
    TOOL_DESCRIPTION_TO_NAME,
    (text, type) => emitChunk(text, type),
    undefined,
    (meta) => {
      if (meta.model) {
        emitChatMetaFromStream({ model: meta.model });
      }
    },
  );

  if (usage) {
    emitContext(usage);
  }

  messages.push({
    role: "assistant",
    content,
    thinking,
    tool_calls: toolCalls.length
      ? toolCalls.map((tc, i) => ({
        id: tc.id ?? `call_${i}`,
        function: tc.function,
      }))
      : undefined,
  });

  if (toolCalls.length === 0) {
    emitResponseEnd();
    emitHistory();
    return;
  }

  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i]!;
    let result = "";
    const fnName = call.function.name as keyof typeof toolFunctions;
    const fn = toolFunctions[fnName];
    const argsObj = (call.function.arguments ?? {}) as Record<string, unknown>;
    if (fn) {
      const toolDef = TOOLS.find((t) => t.function.name === fnName);
      const paramOrder =
        toolDef?.function?.parameters &&
          "properties" in toolDef.function.parameters
          ? Object.keys(toolDef.function.parameters.properties as object)
          : [];
      const fnArgs = paramOrder.map((k) => argsObj[k]);
      const typeCheck = validateToolArgs(fnName, argsObj, toolDef);
      if (typeCheck !== null) {
        result = typeCheck;
      } else {
        emitChunk(
          JSON.stringify({ tool: fnName, arguments: argsObj }),
          "tool_call",
        );
        const raw = (fn as (...args: unknown[]) => string | Promise<string>)(
          ...fnArgs,
        );
        result =
          typeof (raw as Promise<string>)?.then === "function"
            ? await (raw as Promise<string>)
            : (raw as string);
      }
    } else {
      result = `Unknown tool ${call.function.name}`;
    }
    messages.push({
      role: "tool",
      tool_name: call.function.name,
      tool_call_id: call.id ?? `call_${i}`,
      content: JSON.stringify(result),
    });
    emitChunk(
      JSON.stringify({ tool: call.function.name, result }),
      "tool_response",
    );
    await sendMessageToModel();
  }
  emitResponseEnd();
  emitHistory();
}

function isInitPayload(
  parsed: unknown,
): parsed is { type: "init"; messages: ChatMessage[] } {
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { type?: string }).type !== "init"
  ) {
    return false;
  }
  const arr = (parsed as { messages?: unknown[] }).messages;
  if (!Array.isArray(arr)) return false;
  return arr.every((m: unknown) => {
    if (typeof m !== "object" || m === null) return false;
    const o = m as Record<string, unknown>;
    if (typeof o.role !== "string" || typeof o.content !== "string") {
      return false;
    }
    if (o.images !== undefined) {
      if (!Array.isArray(o.images)) return false;
      if (!o.images.every((x) => typeof x === "string")) return false;
    }
    return true;
  });
}

/** Streaming mode: read lines from stdin, call model with full history, stream JSON lines to stdout. */
async function runStreamingMode(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  let allowInitLine = true;
  for await (const line of rl) {
    const msg = line.trim();
    if (!msg) continue;
    if (allowInitLine) {
      allowInitLine = false;
      try {
        const parsed = JSON.parse(msg) as unknown;
        if (isInitPayload(parsed)) {
          messages = parsed.messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.images && m.images.length > 0 ? { images: m.images } : {}),
            thinking: m.thinking,
            tool_calls: m.tool_calls,
            tool_name: m.tool_name,
            tool_call_id:
              typeof (m as { tool_call_id?: string }).tool_call_id === "string"
                ? (m as { tool_call_id: string }).tool_call_id
                : undefined,
          }));
          continue;
        }
      } catch {
        // not valid JSON or not init - handle same line as user input below
      }
    }
    try {
      let parsedLine: unknown;
      try {
        parsedLine = JSON.parse(msg) as unknown;
      } catch {
        parsedLine = undefined;
      }
      if (parsedLine !== undefined && isBridgeMessagePayload(parsedLine)) {
        applyChatRuntimeConfigFromBridgePayload(
          parsedLine,
          parsedLine as Record<string, unknown>,
        );
        await sendMessageToModel(parsedLine.content, parsedLine.images);
        continue;
      }
      await sendMessageToModel(msg);
    } catch (error) {
      const errText = error instanceof Error ? error.message : String(error);
      emitChunk(JSON.stringify({ error: errText }), "content");
      emitResponseEnd();
      emitHistory();
    }
  }
}

/** CLI mode: single message from env/args, raw stdout, then exit. */
async function runCliMode(): Promise<void> {
  console.log("Params", getParams());
  const message = getParams().message;
  if (!message) {
    console.error("Message is required");
    process.exit(1);
  }
  messages = [{ role: "user", content: message }];
  let inThinking = false;
  const { content, thinking } = await chatService.streamChat(
    messages,
    TOOLS,
    TOOL_DESCRIPTION_TO_NAME,
    (text, type) => {
      if (type === "thinking") {
        if (!inThinking) {
          inThinking = true;
          process.stdout.write("Thinking:\n");
        }
        process.stdout.write(text);
      } else if (type === "content") {
        if (inThinking) {
          inThinking = false;
          process.stdout.write("\n\nAnswer:\n");
        }
        process.stdout.write(text);
      } else if (type === "tool_call" || type === "tool_response") {
        process.stdout.write(`\n[${type}]\n${text}\n`);
      }
    },
  );
  messages.push({ role: "assistant", thinking, content });
  if (process.stdout.isTTY) {
    process.stdout.write("\nDone\n");
    process.stdout.write(JSON.stringify(messages, null, 2) + "\n");
  }
}

function isStreamingMode(): boolean {
  const hasMessage = !!process.env.CHAT_MESSAGE || !!getParams().message;
  return !process.stdin.isTTY && !hasMessage;
}

async function main(): Promise<void> {
  if (isStreamingMode()) {
    await runStreamingMode();
  } else {
    await runCliMode();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
