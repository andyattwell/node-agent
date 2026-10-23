import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/job-db.js", () => ({
  updateJobFromState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/issue-adw.js", () => ({
  syncIssueAfterStepTransition: vi.fn().mockResolvedValue(undefined),
}));

import {
  getStateDir,
  getStatePath,
  loadState,
  normalizeWorkflowStepName,
  saveState,
} from "../utils/workflow-state.js";

describe("workflow-state", () => {
  it("normalizeWorkflowStepName maps legacy classify step to plan", () => {
    expect(normalizeWorkflowStepName("await_classify")).toBe("await_plan");
    expect(normalizeWorkflowStepName("await_plan")).toBe("await_plan");
  });

  it("getStateDir creates state/<adw_id> dir and returns it", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "adws-state-"));
    process.env.PROJECT_ROOT = tmp;
    try {
      const stateDir = getStateDir("abc123");
      expect(stateDir).toBe(path.join(tmp, "state", "abc123"));
      expect(fs.existsSync(stateDir)).toBe(true);
    } finally {
      delete process.env.PROJECT_ROOT;
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it("getStatePath returns path under state/<adw_id>/state.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "adws-state-"));
    process.env.PROJECT_ROOT = tmp;
    try {
      const statePath = getStatePath("abc123");
      expect(statePath).toBe(path.join(tmp, "state", "abc123", "state.json"));
      expect(fs.existsSync(path.dirname(statePath))).toBe(true);
    } finally {
      delete process.env.PROJECT_ROOT;
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it("saveState and loadState round-trip all fields", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "adws-state-"));
    process.env.PROJECT_ROOT = tmp;
    try {
      const state = {
        currentStep: "await_plan" as const,
        workPath: "/repo/trees/adw-x",
        branchName: "feature/adw-x",
        adwId: "x",
        prompt: "feat: add X",
        testRetries: 0,
        issueClass: "feature" as const,
        planPath: "/repo/docs/features/foo/PLAN.md",
        prUrl: "https://bitbucket.org/org/repo/pull-requests/1",
      };
      await saveState(state);
      const loaded = loadState("x", tmp);
      expect(loaded).not.toBeNull();
      expect(loaded!.currentStep).toBe("await_plan");
      expect(loaded!.workPath).toBe("/repo/trees/adw-x");
      expect(loaded!.branchName).toBe("feature/adw-x");
      expect(loaded!.adwId).toBe("x");
      expect(loaded!.prompt).toBe("feat: add X");
      expect(loaded!.issueClass).toBe("feature");
      expect(loaded!.planPath).toBe("/repo/docs/features/foo/PLAN.md");
      expect(loaded!.prUrl).toBe(
        "https://bitbucket.org/org/repo/pull-requests/1",
      );
    } finally {
      delete process.env.PROJECT_ROOT;
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it("loadState returns null when state file does not exist", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "adws-state-"));
    process.env.PROJECT_ROOT = tmp;
    try {
      const loaded = loadState("nonexistent", tmp);
      expect(loaded).toBeNull();
    } finally {
      delete process.env.PROJECT_ROOT;
      fs.rmSync(tmp, { recursive: true });
    }
  });
});
