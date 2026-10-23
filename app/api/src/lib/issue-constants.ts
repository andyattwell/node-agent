import type { Issue } from "../types.js";

export const ISSUE_STATUSES: Issue["status"][] = [
  "open",
  "started",
  "planning",
  "implementing",
  "testing",
  "pr",
  "reviewing",
  "completed",
  "error",
  "cancelled",
  "draft",
];

export const ISSUE_PRIORITIES: Issue["priority"][] = ["low", "medium", "high"];

export const ISSUE_TYPES: Issue["type"][] = ["feature", "bug", "chore"];

export function isIssueStatus(value: string): value is Issue["status"] {
  return (ISSUE_STATUSES as string[]).includes(value);
}

export function isIssuePriority(value: string): value is Issue["priority"] {
  return (ISSUE_PRIORITIES as string[]).includes(value);
}

export function isIssueType(value: string): value is Issue["type"] {
  return (ISSUE_TYPES as string[]).includes(value);
}
