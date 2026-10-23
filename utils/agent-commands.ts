import path from "node:path";
import fs from "node:fs";
import type { IssueClass } from "./workflow-state.js";
import { getRepoRoot } from "./git.js";

/**
 * Paths to Cursor command files, relative to repository root.
 */
export const AGENT_COMMANDS = {
  plan: "commands/plan.md",
  implement: "commands/implement.md",
  test: "commands/test.md",
  pr: "commands/pr.md",
  review: "commands/review.md",
  fix_review: "commands/fix_review.md",
  report: "commands/report.md",
} as const;

/**
 * Expand a command template with variables. Command files are read from repoRoot (ADW project).
 * @param repoRoot - ADW project root; when omitted, uses getRepoRoot(process.cwd()).
 */
export function expandCommand(
  command: string,
  variables: Record<string, string>,
): string {
  const root = getRepoRoot();
  const cmdPath = AGENT_COMMANDS[
    command as keyof typeof AGENT_COMMANDS
  ] as string;
  const commandAbsPath = path.join(root, "adw", cmdPath);
  try {
    const commandContent = fs.readFileSync(commandAbsPath, "utf8");
    let expandedContent = commandContent;
    for (const [key, value] of Object.entries(variables)) {
      expandedContent = expandedContent.replace(
        new RegExp(`\\$${key}`, "g"),
        value,
      );
    }
    return expandedContent;
  } catch (error) {
    console.error(`Error reading command file: ${commandAbsPath}`, error);
    return "";
  }
}
