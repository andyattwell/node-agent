import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAppRepoCloned } from "../utils/git.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

describe("ensureAppRepoCloned", () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
    vi.mocked(execFileSync).mockReset();
  });

  it("returns development path when development/ exists and is a git repo", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adw-"));
    const appDir = path.join(repoRoot, "development");
    fs.mkdirSync(appDir);
    fs.mkdirSync(path.join(appDir, ".git"));
    try {
      vi.mocked(execSync).mockReturnValue(".git" as any);
      const result = ensureAppRepoCloned(
        appDir,
        "https://example.com/repo.git",
        "develop",
      );
      expect(result).toBe(appDir);
    } finally {
      fs.rmSync(repoRoot, { recursive: true });
    }
  });

  it("rethrows when development/ exists but is not a git repository and clone fails", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adw-"));
    const appDir = path.join(repoRoot, "development");
    fs.mkdirSync(appDir);
    try {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("not a git repo");
      });
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error("not a git repo");
      });
      expect(() =>
        ensureAppRepoCloned(
          appDir,
          "https://example.com/repo.git",
          "develop",
        ),
      ).toThrow(/not a git repo/);
    } finally {
      fs.rmSync(repoRoot, { recursive: true });
    }
  });

  it("creates development/ and returns it when ADW_APP_REPO_URL is empty", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adw-"));
    const appDir = path.join(repoRoot, "development");
    try {
      const result = ensureAppRepoCloned(appDir, "", "develop");
      expect(result).toBe(appDir);
      expect(fs.existsSync(appDir)).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true });
    }
  });

  it("clones into development/ when development/ does not exist and URL is set", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adw-"));
    const appDir = path.join(repoRoot, "development");
    vi.mocked(execSync).mockImplementation(() => undefined as any);
    try {
      const result = ensureAppRepoCloned(
        appDir,
        "https://github.com/org/app.git",
        "main",
      );
      expect(result).toBe(appDir);
      expect(execFileSync).toHaveBeenCalledWith(
        "git",
        ["clone", "-b", "main", "https://github.com/org/app.git", appDir],
        { cwd: repoRoot, stdio: "pipe" },
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true });
    }
  });
});
