export type IssueStatus =
  | "open"
  | "started"
  | "planning"
  | "implementing"
  | "testing"
  | "pr"
  | "reviewing"
  | "completed"
  | "error"
  | "cancelled"
  | "draft";

export type IssuePriority = "low" | "medium" | "high";

export type IssueType = "feature" | "bug" | "chore";

export interface Issue {
  id: number;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  adw_id: string | null;
  project_id: number;
  /** When true (default), ADW uses a git worktree; when false, work runs in the project clone on a branch. */
  worktree?: boolean;
  created_at: string;
  updated_at: string;
}

export interface IssueComment {
  id: number;
  commenter: string;
  comment: string;
  issue_id: number;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  workdir: string | null;
  repository: string | null;
  base_branch: string | null;
  credentials: string | null;
  ai_provider: string | null;
  ai_path: string | null;
  ai_model: string | null;
  created_at: string;
}

export interface Job {
  id: number;
  adw_id: string;
  step: string | null;
  status: string;
  prompt: string;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  process_id: number | null;
  project_id: number | null;
  issue_id: number | null;
  state_snapshot?: string | JobState | null;
  state?: JobState;
  runs?: { name: string; content: Run[] };
}

export interface JobState {
  statePath: string;
  pid: number;
  status?: "running" | "stopped";
  currentStep: string;
  workPath: string;
  branchName: string;
  adwId: string;
  prompt: string;
  promptPath: string;
  testRetries: number;
  issueClass: string;
  planPath: string;
  implementationSummaryPath: string;
  currentPromptPath: string;
  prUrl: string;
  prId: number;
  reviewRetries: number;
  testResultsPath: string;
  outputLogPath: string;
  errorLogPath: string;
}

export interface StateEntry {
  id: string;
  runs?: { name: string; content: Run[] }[];
  state: {
    statePath: string;
    pid: number;
    status?: "running" | "stopped";
    currentStep: string;
  };
}

export interface Run {
  name: string;
  content: RunContent[];
}

export interface RunContent {
  type: "text" | "tool_use" | "tool_result" | "result";
  id: string;
  name: string;
  input: { command: string; description: string };
  content: string;
}

export interface ChatMessageRow {
  role: string;
  content: string;
  thinking: string | null;
  tool_calls: string | null;
  tool_name: string | null;
  /** JSON array of base64 strings (Ollama vision). */
  images: string | null;
}

export interface ChatSessionRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}
