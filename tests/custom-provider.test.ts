import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomProvider, createCustomChatService } from "../providers/custom-provider.js";
import type { InstructionContext } from "../providers/ai-provider.js";
import type { WorkflowState } from "../utils/workflow-state.js";
import { resolveAdwConfig } from "../utils/adw-config.js";
import { buildPrompt, saveCommandOutput } from "../providers/utils/provider-common.js";

vi.mock("../providers/utils/provider-common.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../providers/utils/provider-common.js")>();
  return {
    ...actual,
    buildPrompt: vi.fn().mockResolvedValue("test prompt"),
    saveCommandOutput: vi.fn().mockResolvedValue(undefined),
  };
});

describe("createCustomProvider", () => {
  const baseContext: InstructionContext = {
    step: "plan",
    workPath: "/repo/trees/adw-x",
    repoRoot: "/repo",
    adwId: "x",
    state: {
      currentStep: "await_plan",
      workPath: "/repo/trees/adw-x",
      branchName: "feature/adw-x",
      adwId: "x",
      prompt: "add README",
      testRetries: 0,
    } as WorkflowState,
  };

  const origFetch = globalThis.fetch;
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    process.env.ADW_AI_PROVIDER = "ollama";
    process.env.ADW_AI_PATH = "http://127.0.0.1:11434";
    process.env.ADW_AI_MODEL = "llama3.2";
  });

  afterEach(() => {
    process.env = origEnv;
    vi.unstubAllGlobals();
    globalThis.fetch = origFetch;
    vi.clearAllMocks();
  });

  it("returns exitCode 0 and stdout on successful run", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        exitCode: 0,
        stdout: "success output",
        stderr: "",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const config = resolveAdwConfig(null);
    const provider = createCustomProvider(config);
    const result = await provider.run(baseContext);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("success output");
    expect(result.stderr).toBe("");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/chat/execute",
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.provider).toBe("ollama");
    expect(body.model).toBe("llama3.2");
    expect(body.prompt).toBe("test prompt");
    expect(saveCommandOutput).toHaveBeenCalledWith("plan", "success output", "", "x", "/repo");
  });

  it("returns exitCode 1 and error from API on failed HTTP response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "detailed error message",
    });
    vi.stubGlobal("fetch", mockFetch);

    const config = resolveAdwConfig(null);
    const provider = createCustomProvider(config);
    const result = await provider.run(baseContext);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("HTTP 500: detailed error message");
    expect(saveCommandOutput).toHaveBeenCalledWith("plan", "", expect.stringContaining("HTTP 500"), "x", "/repo");
  });

  it("returns exitCode 1 and stderr on fetch rejection", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network connection lost"));
    vi.stubGlobal("fetch", mockFetch);

    const config = resolveAdwConfig(null);
    const provider = createCustomProvider(config);
    const result = await provider.run(baseContext);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Network connection lost");
    expect(saveCommandOutput).toHaveBeenCalledWith("plan", "", "Network connection lost", "x", "/repo");
  });

  it("returns exitCode 1 and Unknown step if prompt is empty", async () => {
    vi.mocked(buildPrompt).mockResolvedValueOnce("");

    const config = resolveAdwConfig(null);
    const provider = createCustomProvider(config);
    const result = await provider.run(baseContext);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Unknown step");
  });
});

describe("createCustomChatService", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = origFetch;
    vi.clearAllMocks();
  });

  it("streams chat and parses NDJSON lines correctly", async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type":"thinking","text":"Thinking..."}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type":"content","text":"Hello "}\n{"type":"content","text":"world!"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type":"tool_call","tool_call":{"id":"call_1","function":{"name":"run","arguments":{}}}}\n'),
        })
        .mockResolvedValueOnce({
          done: true,
        }),
      releaseLock: vi.fn(),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });
    vi.stubGlobal("fetch", mockFetch);

    const chatService = createCustomChatService("llama3.2", { baseUrl: "http://localhost:11434" });
    const onChunk = vi.fn();
    const onStreamMeta = vi.fn();

    const result = await chatService.streamChat(
      [{ role: "user", content: "Hi" }],
      [],
      {},
      onChunk,
      undefined,
      onStreamMeta
    );

    expect(result.content).toBe("Hello world!");
    expect(result.thinking).toBe("Thinking...");
    expect(result.tool_calls).toEqual([
      { id: "call_1", function: { name: "run", arguments: {} } },
    ]);

    expect(onChunk).toHaveBeenCalledTimes(3); // "Thinking...", "Hello ", "world!"
    expect(onChunk).toHaveBeenNthCalledWith(1, "Thinking...", "thinking");
    expect(onChunk).toHaveBeenNthCalledWith(2, "Hello ", "content");
    expect(onChunk).toHaveBeenNthCalledWith(3, "world!", "content");

    expect(onStreamMeta).toHaveBeenCalledWith({ model: "llama3.2" });
  });

  it("handles empty/missing response body in streamChat", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null,
    });
    vi.stubGlobal("fetch", mockFetch);

    const chatService = createCustomChatService("llama3.2");
    await expect(
      chatService.streamChat([{ role: "user", content: "Hi" }], [], {})
    ).rejects.toThrow("No response body received from stream endpoint");
  });
});
