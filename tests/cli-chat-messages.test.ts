import { describe, expect, it } from "vitest";
import {
  applyCliStreamJsonLine,
  extractAssistantTextFromMessage,
  formatChatMessagesForCliPrompt,
  tryExtractCliStreamModel,
} from "../providers/utils/cli-chat-messages.js";
import type { ChatMessage } from "../providers/utils/chat-types.js";

describe("formatChatMessagesForCliPrompt", () => {
  it("formats user, assistant, and tool roles", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: "Hi there",
        thinking: "brief",
      },
      {
        role: "tool",
        tool_name: "read",
        tool_call_id: "c1",
        content: '{"ok":true}',
      },
    ];
    const out = formatChatMessagesForCliPrompt(messages);
    expect(out).toContain("User:");
    expect(out).toContain("Hello");
    expect(out).toContain("Assistant:");
    expect(out).toContain("[thinking]");
    expect(out).toContain("Hi there");
    expect(out).toContain("Tool result (id=c1) (read):");
    expect(out).toContain('{"ok":true}');
  });

  it("notes attached images on user lines", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "What is this?", images: ["abc", "def"] },
    ];
    const out = formatChatMessagesForCliPrompt(messages);
    expect(out).toContain("What is this?");
    expect(out).toContain("2 image(s) attached");
  });
});

describe("tryExtractCliStreamModel", () => {
  it("reads Claude system init model", () => {
    expect(
      tryExtractCliStreamModel({
        type: "system",
        subtype: "init",
        model: "claude-sonnet-4-6",
      }),
    ).toBe("claude-sonnet-4-6");
  });

  it("skips auto placeholder", () => {
    expect(
      tryExtractCliStreamModel({
        type: "system",
        subtype: "init",
        model: "auto",
      }),
    ).toBeUndefined();
  });

  it("reads modelUsage keys from result", () => {
    expect(
      tryExtractCliStreamModel({
        type: "result",
        subtype: "success",
        modelUsage: { "claude-sonnet-4-6": { costUSD: 1 } },
      }),
    ).toBe("claude-sonnet-4-6");
  });
});

describe("extractAssistantTextFromMessage", () => {
  it("concatenates text blocks from Cursor/Claude assistant messages", () => {
    const text = extractAssistantTextFromMessage({
      role: "assistant",
      content: [
        { type: "text", text: "hello" },
        { type: "text", text: " world" },
      ],
    });
    expect(text).toBe("hello world");
  });
});

describe("applyCliStreamJsonLine", () => {
  it("maps Cursor thinking delta to thinking chunks", () => {
    const state = { content: "", thinking: "" };
    const chunks: { text: string; type: string }[] = [];
    applyCliStreamJsonLine(
      JSON.stringify({
        type: "thinking",
        subtype: "delta",
        text: "plan ",
      }),
      state,
      (text, type) => chunks.push({ text, type }),
    );
    expect(chunks).toEqual([{ text: "plan ", type: "thinking" }]);
    expect(state.thinking).toBe("plan ");
  });

  it("maps Cursor assistant message blocks to content", () => {
    const state = { content: "", thinking: "" };
    const chunks: { text: string; type: string }[] = [];
    applyCliStreamJsonLine(
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: '{"a":1}' }],
        },
      }),
      state,
      (text, type) => chunks.push({ text, type }),
    );
    expect(chunks).toEqual([{ text: '{"a":1}', type: "content" }]);
    expect(state.content).toBe('{"a":1}');
  });

  it("skips duplicate full assistant line after deltas (Cursor)", () => {
    const state = { content: "", thinking: "" };
    const chunks: { text: string; type: string }[] = [];
    const onChunk = (text: string, type: string) =>
      chunks.push({ text, type });
    applyCliStreamJsonLine(
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "ab" }],
        },
      }),
      state,
      onChunk,
    );
    applyCliStreamJsonLine(
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "ab" }],
        },
      }),
      state,
      onChunk,
    );
    expect(chunks).toHaveLength(1);
    expect(state.content).toBe("ab");
  });

  it("maps Cursor tool_call started and completed", () => {
    const state = { content: "", thinking: "" };
    const chunks: { text: string; type: string }[] = [];
    const onChunk = (text: string, type: string) =>
      chunks.push({ text, type });

    applyCliStreamJsonLine(
      JSON.stringify({
        type: "tool_call",
        subtype: "started",
        call_id: "tool_1",
        tool_call: { grepToolCall: { args: { pattern: "x" } } },
      }),
      state,
      onChunk,
    );
    applyCliStreamJsonLine(
      JSON.stringify({
        type: "tool_call",
        subtype: "completed",
        call_id: "tool_1",
        tool_call: { grepToolCall: { result: { ok: true } } },
      }),
      state,
      onChunk,
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].type).toBe("tool_call");
    expect(chunks[1].type).toBe("tool_response");
    expect(JSON.parse(chunks[0].text).subtype).toBe("started");
    expect(JSON.parse(chunks[1].text).subtype).toBe("completed");
  });

  it("maps Claude stream_event content_block_delta text_delta", () => {
    const state = { content: "", thinking: "" };
    const chunks: { text: string; type: string }[] = [];
    applyCliStreamJsonLine(
      JSON.stringify({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hi" },
        },
      }),
      state,
      (text, type) => chunks.push({ text, type }),
    );
    expect(chunks).toEqual([{ text: "Hi", type: "content" }]);
    expect(state.content).toBe("Hi");
  });
});
