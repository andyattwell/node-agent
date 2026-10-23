import fs from "node:fs";
import path from "node:path";
import {
  InstructionResult,
  InstructionStep,
} from "../providers/ai-provider.js";
import Agent, { RunnerContext } from "../agents/agent.js";
import { Args } from "./args.js";
import { Job, updateJobFromState } from "./job-db.js";
import { syncIssueAfterStepTransition } from "./issue-adw.js";
import { ADW_PROJECT_ROOT } from "./adw-config.js";

export type WorkflowStep =
  | "run_test"
  | "await_plan"
  | "await_implement"
  | "await_test"
  | "await_pr"
  | "await_review"
  | "report";

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  "run_test",
  "await_plan",
  "await_implement",
  "await_test",
  "await_pr",
  "await_review",
  "report",
] as const;

export function isWorkflowStep(step: string): step is WorkflowStep {
  return (WORKFLOW_STEPS as readonly string[]).includes(step);
}

/** Maps persisted states from older ADW runs before classify was removed. */
export function normalizeWorkflowStepName(step: string): string {
  return step === "await_classify" ? "await_plan" : step;
}

export type IssueClass = "feature" | "bug" | "chore";

export type WorkflowStatus = "running" | "stopped" | "done";

export interface WorkflowState {
  job?: Job;
  pid?: number;
  /** Current run status: running (script active) or stopped (script not running). */
  status?: WorkflowStatus;
  currentStep: WorkflowStep;
  workPath: string;
  branchName: string;
  adwId: string;
  issueClass?: IssueClass;
  planPath?: string;
  prompt: string;
  promptPath?: string;
  testRetries: number;
  prUrl?: string;
  prId?: number;
  reviewRetries?: number;
  errorDocumentPath?: string;
  currentPromptPath?: string;
  implementationSummaryPath?: string;
  testResultsPath?: string;
  /** When set, issue row is updated through the ADW lifecycle */
  issueId?: number;
  /**
   * When true (default), ADW uses `git worktree`; when false, work is in the project clone on `branchName`.
   * Copied from `Issue.worktree` for issue runs; prompt-only defaults to true.
   */
  useGitWorktree?: boolean;
}

const STATE_DIR = "state";

/**
 * Get the directory for a given ADW's state: state/<adw_id>/
 * Creates the directory if it does not exist.
 */
export function getStateDir(adwId: string): string {
  const root = process.env.PROJECT_ROOT || ADW_PROJECT_ROOT;
  const stateDir = path.join(root, STATE_DIR, adwId);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  return stateDir;
}

/**
 * Get the file path for state persistence: state/<adw_id>/state.json
 */
export function getStatePath(adwId: string): string {
  const stateDir = getStateDir(adwId);
  return path.join(stateDir, "state.json");
}

/**
 * Load workflow state from disk.
 */
export function loadState(
  adwId: string,
  repoRoot: string,
): WorkflowState | null {
  const statePath = getStatePath(adwId);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  const raw = fs.readFileSync(statePath, "utf8");
  return JSON.parse(raw) as WorkflowState;
}

/**
 * Save workflow state to disk.
 */
export async function saveState(state: WorkflowState): Promise<void> {
  const statePath = getStatePath(state.adwId);
  let previous: WorkflowState | null = null;
  if (fs.existsSync(statePath)) {
    try {
      previous = JSON.parse(
        fs.readFileSync(statePath, "utf8"),
      ) as WorkflowState;
    } catch {
      previous = null;
    }
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
  if (state.issueId != null) {
    await syncIssueAfterStepTransition(
      state.issueId,
      previous,
      state.currentStep,
    );
  }
}

/**
 * Persist state to disk and sync the job row. Use this from the CLI/orchestrator.
 * Agent steps use {@link Agent.executeStep} so the job row updates at step start/finish;
 * they call {@link saveState} for file + issue sync only.
 */
export async function persistAdwState(state: WorkflowState): Promise<void> {
  await saveState(state);
  await updateJobFromState(state);
}

export type StepOutcome =
  | { kind: "continue" }
  | { kind: "emit"; title: string; body: string }
  | { kind: "exit"; report?: boolean; issueError?: string }
  | { kind: "retry"; retryCount: number };

export interface StepHandlerParams {
  args: Args;
  state: WorkflowState;
  runnerCtx: RunnerContext;
  stateDir: string;
  repoRoot: string;
}

export function logStepError(
  adwId: string,
  stateDir: string,
  step: InstructionStep,
  error: string,
): void {
  console.error(`[ADW ${adwId}] Step ${step} error: ${error}`);
  const errorPath = path.join(stateDir, step, "error.md");
  // Add new line to error file if it already exists.
  if (!fs.existsSync(errorPath)) {
    fs.mkdirSync(path.dirname(errorPath), { recursive: true });
  }
  let content = `# ${step} error\n\n${error}`;
  if (fs.existsSync(errorPath)) {
    content = `\n\n---\n\n${content}`;
    fs.appendFileSync(errorPath, content, "utf8");
  } else {
    fs.writeFileSync(errorPath, content, "utf8");
  }
}

export function logStepProgress(
  adwId: string,
  stateDir: string,
  message: string,
  data?: Record<string, string | number | undefined>,
): void {
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value != null && value !== "") console.log(`  ${key}: ${value}`);
    }
  }
  const progressPath = path.join(stateDir, "progress.md");
  let content = `${new Date().toISOString()} [ADW ${adwId}] ${message}`;
  console.log(content);
  if (fs.existsSync(progressPath)) {
    content = `\n\n---\n\n${content}`;
    fs.appendFileSync(progressPath, content, "utf8");
  } else {
    fs.writeFileSync(progressPath, content, "utf8");
  }
}

/**
 * Run a step via the configured provider. If there is no provider or the step fails,
 * emit the instruction and return null (caller should return). Otherwise return the result.
 */
export async function executeStepOrEmit(
  ctx: RunnerContext,
  step: InstructionStep,
  instruction: { title: string; body: string },
): Promise<InstructionResult | null> {
  const agent = new Agent(step, ctx.adwConfig);
  const result = await agent.run(ctx);
  if (result === null || result.exitCode !== 0) {
    logStepError(
      ctx.adwId,
      getStateDir(ctx.adwId),
      step,
      `❌ Step ${step} failed: ${result?.stderr ?? "Unknown error"}`,
    );
    return null;
  }
  return result;
}

export function generateAdwId(retries: number = 0): string {
  if (retries > 20) {
    throw new Error("Failed to generate a unique ADW ID after 10 retries");
  }
  const hex = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 8; i++) id += hex[Math.floor(Math.random() * 16)];
  const stateDir = path.join(process.env.PROJECT_ROOT ?? ".", STATE_DIR, id);
  if (fs.existsSync(stateDir)) {
    return generateAdwId(retries + 1);
  }
  return id;
}
