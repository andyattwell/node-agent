import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  pathRelativeToWorktree,
  getLLMServerBaseUrlFromConfig,
} from "../providers/utils/provider-common.js";

const ENV = process.env;

describe("getLLMServerBaseUrlFromConfig", () => {
  beforeEach(() => {
    process.env = { ...ENV };
    delete process.env.ADW_AI_PATH;
  });

  afterEach(() => {
    process.env = ENV;
  });

  it("prefers config.aiPath over env variables", () => {
    const config = { aiPath: "http://host-a:11434" } as any;
    process.env.ADW_AI_PATH = "http://host-b:11434";
    expect(getLLMServerBaseUrlFromConfig(config)).toBe("http://host-a:11434");
  });

  it("uses ADW_AI_PATH when config/aiPath is unset", () => {
    process.env.ADW_AI_PATH = "http://remote:11434/";
    expect(getLLMServerBaseUrlFromConfig()).toBe("http://remote:11434");
  });
});

describe("pathRelativeToWorktree", () => {
  const wt = "/project/development/trees/adw-branch";

  it("returns empty string for empty path", () => {
    expect(pathRelativeToWorktree("", wt)).toBe("");
  });

  it("returns relative path for a file under the worktree", () => {
    const p = path.join(wt, "docs/x/prompt.md");
    expect(pathRelativeToWorktree(p, wt)).toBe(
      path.join("docs", "x", "prompt.md"),
    );
  });

  it("returns dot when path equals worktree", () => {
    expect(pathRelativeToWorktree(wt, wt)).toBe(".");
  });

  it("returns relative path with parents for paths outside the worktree", () => {
    const stateDir = "/project/state/adw-id";
    expect(pathRelativeToWorktree(stateDir, wt)).toBe(
      path.join("..", "..", "..", "state", "adw-id"),
    );
  });
});
