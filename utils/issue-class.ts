import type { Issue } from "./entities/Issue.js";
import type { IssueClass } from "./workflow-state.js";

/**
 * Parse a stored label into a workflow issue class, or null if unknown.
 */
export function normalizeIssueClassLabel(
  raw: string | null | undefined,
): IssueClass | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s === "feature" || s === "bug" || s === "chore") return s;
  return null;
}

/**
 * ADW issue class from the issue row's `type` (feature / bug / chore).
 * Prompt-only runs pass null and get `feature`.
 */
export function deriveIssueClassFromIssue(issue: Issue | null): IssueClass {
  const fromIssue = issue ? normalizeIssueClassLabel(issue.type) : null;
  if (fromIssue) return fromIssue;
  return "feature";
}

/** Issue-driven default: use a git worktree unless the issue disables it. */
export function issuePrefersGitWorktree(issue: Issue | null): boolean {
  if (issue == null) return true;
  if (typeof issue.worktree === "boolean") return issue.worktree;
  return true;
}
