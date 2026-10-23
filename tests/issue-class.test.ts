import { describe, expect, it } from "vitest";
import type { Issue } from "../utils/entities/Issue.js";
import {
  deriveIssueClassFromIssue,
  issuePrefersGitWorktree,
  normalizeIssueClassLabel,
} from "../utils/issue-class.js";

function issue(i: Partial<Issue>): Issue {
  return {
    id: 1,
    title: "t",
    description: "d",
    status: "open",
    priority: "p",
    type: "feature",
    adw_id: null,
    project_id: 1,
    worktree: true,
    created_at: "",
    updated_at: "",
    ...i,
  };
}

describe("deriveIssueClassFromIssue", () => {
  it("maps issue.type when feature, bug, or chore", () => {
    expect(deriveIssueClassFromIssue(issue({ type: "bug" }))).toBe("bug");
    expect(deriveIssueClassFromIssue(issue({ type: "CHORE" }))).toBe("chore");
  });

  it("defaults to feature for unknown type or null issue", () => {
    expect(deriveIssueClassFromIssue(issue({ type: "epic" }))).toBe("feature");
    expect(deriveIssueClassFromIssue(null)).toBe("feature");
  });
});

describe("issuePrefersGitWorktree", () => {
  it("is true when issue is null or worktree flag is true", () => {
    expect(issuePrefersGitWorktree(null)).toBe(true);
    expect(issuePrefersGitWorktree(issue({ worktree: true }))).toBe(true);
  });

  it("is false when issue.worktree is false", () => {
    expect(issuePrefersGitWorktree(issue({ worktree: false }))).toBe(false);
  });
});

describe("normalizeIssueClassLabel", () => {
  it("accepts feature, bug, chore case-insensitively", () => {
    expect(normalizeIssueClassLabel("BUG")).toBe("bug");
    expect(normalizeIssueClassLabel(" Feature ")).toBe("feature");
  });

  it("returns null for unknown", () => {
    expect(normalizeIssueClassLabel("epic")).toBeNull();
  });
});
