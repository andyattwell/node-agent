import { spawn } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { createCursorProvider } from "../providers/cursor-provider.js";
import type { InstructionContext } from "../providers/ai-provider.js";
import type { WorkflowState } from "../utils/workflow-state.js";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn() };
});

vi.mock("../providers/utils/provider-common.js", () => ({
  buildPrompt: vi.fn().mockResolvedValue("plan prompt content"),
  getTimeoutMs: vi.fn().mockReturnValue(60_000),
  saveCommandOutput: vi.fn().mockResolvedValue(undefined),
  clearCommandOutput: vi.fn(),
  appendLineCommandOutput: vi.fn(),
  readCommandOutput: vi.fn().mockReturnValue(""),
}));

describe("createCursorProvider", () => {
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
      prompt: "chore: add README",
      testRetries: 0,
    } as WorkflowState,
  };

  it("invokes CLI with -p and -f and cwd set to workPath", async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((ev: string, fn: (code: number) => void) => {
        if (ev === "close") setTimeout(() => fn(0), 0);
        return mockProc;
      }),
    };
    vi.mocked(spawn).mockReturnValue(
      mockProc as unknown as ReturnType<typeof spawn>,
    );
    vi.mocked(mockProc.stdout!.on).mockImplementation((ev, fn) => {
      if (ev === "data") (fn as (d: Buffer) => void)(Buffer.from(JSON.stringify({ type: "result", subtype: "success", result: "feature" })));
      return mockProc.stdout as ReturnType<typeof mockProc.stdout.on>;
    });
    vi.mocked(mockProc.stderr!.on).mockImplementation(
      () => mockProc.stderr as ReturnType<typeof mockProc.stderr.on>,
    );

    const provider = createCursorProvider("cursor", "");
    const result = await provider.run(baseContext);

    expect(spawn).toHaveBeenCalledWith(
      "cursor",
      expect.arrayContaining([
        "-p",
        expect.any(String),
        "-f",
        "--output-format",
        "stream-json",
      ]),
      expect.objectContaining({
        cwd: "/repo/trees/adw-x",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("feature");
  });

  it("returns exitCode and stderr on close with non-zero code", async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((ev: string, fn: (code: number) => void) => {
        if (ev === "close") setTimeout(() => fn(1), 0);
        return mockProc;
      }),
    };
    vi.mocked(spawn).mockReturnValue(
      mockProc as unknown as ReturnType<typeof spawn>,
    );
    vi.mocked(mockProc.stdout!.on).mockImplementation(
      () => mockProc.stdout as ReturnType<typeof mockProc.stdout.on>,
    );
    vi.mocked(mockProc.stderr!.on).mockImplementation((ev, fn) => {
      if (ev === "data") (fn as (d: Buffer) => void)(Buffer.from("error"));
      return mockProc.stderr as ReturnType<typeof mockProc.stderr.on>;
    });

    const provider = createCursorProvider("cursor", "");
    const result = await provider.run(baseContext);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("error");
  });

  it("passes --model when model is non-empty", async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((ev: string, fn: (code: number) => void) => {
        if (ev === "close") setTimeout(() => fn(0), 0);
        return mockProc;
      }),
    };
    vi.mocked(spawn).mockReturnValue(
      mockProc as unknown as ReturnType<typeof spawn>,
    );
    vi.mocked(mockProc.stdout!.on).mockImplementation((ev, fn) => {
      if (ev === "data") (fn as (d: Buffer) => void)(Buffer.from("ok"));
      return mockProc.stdout as ReturnType<typeof mockProc.stdout.on>;
    });
    vi.mocked(mockProc.stderr!.on).mockImplementation(
      () => mockProc.stderr as ReturnType<typeof mockProc.stderr.on>,
    );

    const provider = createCursorProvider("cursor", "gpt-5.2");
    await provider.run(baseContext);

    expect(spawn).toHaveBeenCalledWith(
      "cursor",
      expect.arrayContaining(["--model", "gpt-5.2"]),
      expect.any(Object),
    );
  });

  it("returns error result on spawn error", async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((ev: string, fn: (err: Error) => void) => {
        if (ev === "error") setTimeout(() => fn(new Error("ENOENT")), 0);
        return mockProc;
      }),
    };
    vi.mocked(spawn).mockReturnValue(
      mockProc as unknown as ReturnType<typeof spawn>,
    );
    vi.mocked(mockProc.stdout!.on).mockImplementation(
      () => mockProc.stdout as ReturnType<typeof mockProc.stdout.on>,
    );
    vi.mocked(mockProc.stderr!.on).mockImplementation(
      () => mockProc.stderr as ReturnType<typeof mockProc.stderr.on>,
    );

    const provider = createCursorProvider("cursor", "");
    const result = await provider.run(baseContext);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ENOENT");
  });
});
