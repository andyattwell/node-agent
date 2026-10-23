import fs from "node:fs";
import path from "node:path";
import { commitInWorktree } from "./git.js";
import { getStateDir, logStepProgress } from "./workflow-state.js";
import logger from "./logger.js";

export const MAX_TEST_RETRIES = 3;
export const MAX_REVIEW_RETRIES = 3;

/**
 * Ensure the plan file exists in the worktree (copy from repo root if needed) so it can be committed.
 * Returns the path to use for state.planPath (always under worktree when possible).
 */
export function ensurePlanInWorktree(
  adwId: string,
  planPath: string,
  workPath: string,
  repoRoot: string,
): string {
  if (path.resolve(planPath).startsWith(path.resolve(workPath) + path.sep)) {
    return planPath;
  }

  const planDir = path.join(
    workPath,
    `docs/${adwId}`,
    "IMPLEMENTATION_PLAN.md",
  );
  if (fs.existsSync(planDir)) {
    return planDir;
  }

  const relToRepo = path.relative(repoRoot, planPath);
  const destPath = path.join(workPath, relToRepo);
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(planPath, destPath);
  const stateDir = getStateDir(adwId);
  logStepProgress(
    adwId,
    stateDir,
    "📄 Plan was in repo root; copied to worktree",
    {
      from: planPath,
      to: destPath,
    },
  );
  return destPath;
}

export function safeCommit(
  workPath: string,
  message: string,
  paths?: string[],
): boolean {
  try {
    commitInWorktree(workPath, message, paths);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check test results from a file path or raw JSON string.
 * Returns true if all tests passed (array: every status === "passed", single object: status === "passed").
 */
export function checkTestResults(input: string): boolean {
  try {
    let data: unknown;
    const trimmed = input.trim();
    const looksLikePath =
      trimmed.includes(path.sep) ||
      trimmed.endsWith(".json") ||
      (!trimmed.startsWith("[") && !trimmed.startsWith("{"));
    if (looksLikePath && fs.existsSync(trimmed)) {
      data = JSON.parse(fs.readFileSync(trimmed, "utf8"));
    } else {
      data = JSON.parse(trimmed);
    }
    if (Array.isArray(data)) {
      return (data as Array<{ status?: string }>).every(
        (r) => r?.status === "passed",
      );
    }
    return (data as { status?: string })?.status === "passed";
  } catch {
    return false;
  }
}

/**
 * Copy .env and optional feature document from the app repo into the worktree.
 * appRepoRoot must be the app repository (clone from ADW_APP_REPO_URL at development/),
 * not the ADW project root.
 */
export function copyEnvToWorktree(appRepoRoot: string, workPath: string) {
  if (path.resolve(appRepoRoot) === path.resolve(workPath)) {
    return;
  }
  const envSrc = path.join(appRepoRoot, ".env");
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, path.join(workPath, ".env"));
  }
}

/**
 * Copy .env and optional feature document from the app repo into the worktree.
 * appRepoRoot must be the app repository (clone from ADW_APP_REPO_URL at development/),
 * not the ADW project root.
 */
export function copyPromptToWorktree(
  prompt: string,
  workPath: string,
  adwId: string,
): string | undefined {
  const promptDir = path.join(workPath, `docs/${adwId}`);
  if (!fs.existsSync(promptDir)) {
    fs.mkdirSync(promptDir, { recursive: true });
  }
  const promptPath = path.join(promptDir, "prompt.md");
  fs.writeFileSync(promptPath, prompt);
  return promptPath;
}
