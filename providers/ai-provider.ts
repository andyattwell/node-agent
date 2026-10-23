import type { IssueClass, WorkflowState } from "../utils/workflow-state.js";

export type InstructionStep =
  | "run_test"
  | "plan"
  | "implement"
  | "test"
  | "pr"
  | "review"
  | "fix_review";

export interface InstructionContext {
  step: InstructionStep;
  workPath: string;
  /** ADW project root (state, command files). */
  repoRoot: string;
  /** App repository root (clone under ADW project). Prompt paths use worktree-relative values. */
  appRepoRoot?: string;
  adwId: string;
  state: WorkflowState;
}

export interface InstructionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AIProvider {
  run(ctx: InstructionContext): Promise<InstructionResult>;
}
