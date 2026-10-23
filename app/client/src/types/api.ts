export interface StateEntry {
  id: string;
  runs?: { name: string; content: Run[] }[];
  state: JobState;
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

/** One ADW from GET /adw/:issueId; optional fields omitted when state.json is missing. */
export type AdwStateEntry = Partial<JobState> & { adwId: string };

export interface AdwsForIssueResponse {
  adws: AdwStateEntry[];
}

/** Message content block variants (assistant/user messages). */
export interface MessageContentThinking {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface MessageContentToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
  caller?: { type: string };
}

export interface MessageContentText {
  type: "text";
  text: string;
}

export interface MessageContentToolResult {
  type: "tool_result";
  tool_use_id?: string;
  content: string;
  is_error?: boolean;
}

export type MessageContentBlock =
  | MessageContentThinking
  | MessageContentToolUse
  | MessageContentText
  | MessageContentToolResult;

/** Usage on assistant/result messages. */
export interface RunMessageUsage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  output_tokens?: number;
  service_tier?: string;
  inference_geo?: string;
}

/** Usage on result (summary) line. */
export interface RunResultUsage extends RunMessageUsage {
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
  iterations?: unknown[];
  speed?: string;
}

export interface RunMessage {
  model?: string;
  id?: string;
  type?: string;
  role: string;
  content: MessageContentBlock[] | string;
  stop_reason?: string | null;
  stop_sequence?: string | null;
  usage?: RunMessageUsage;
  context_management?: unknown;
}

export interface ModelUsageEntry {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
}

/** System init line (session start). */
export interface RunSystemInit {
  type: "system";
  subtype: "init";
  cwd: string;
  session_id: string;
  tools: string[];
  mcp_servers: string[];
  model: string;
  permissionMode: string;
  slash_commands: string[];
  apiKeySource?: string;
  claude_code_version?: string;
  output_style?: string;
  agents: string[];
  skills: string[];
  plugins: unknown[];
  uuid: string;
  fast_mode_state?: string;
}

/** Assistant turn line. */
export interface RunAssistant {
  type: "assistant";
  message: RunMessage;
  parent_tool_use_id: string | null;
  session_id: string;
  uuid: string;
}

/** User turn line (may include tool results). */
export interface RunUser {
  type: "user";
  message: RunMessage;
  parent_tool_use_id: string | null;
  session_id: string;
  uuid: string;
  tool_use_result?: {
    type: string;
    filePath?: string;
    content?: string;
    structuredPatch?: unknown[];
    originalFile?: string | null;
  };
}

/** System task_started line. */
export interface RunSystemTaskStarted {
  type: "system";
  subtype: "task_started";
  task_id: string;
  tool_use_id: string;
  description: string;
  task_type: string;
  prompt: string;
  uuid: string;
  session_id: string;
}

/** System task_progress line. */
export interface RunSystemTaskProgress {
  type: "system";
  subtype: "task_progress";
  task_id: string;
  tool_use_id: string;
  description: string;
  usage: {
    total_tokens: number;
    tool_uses: number;
    duration_ms: number;
  };
  last_tool_name: string;
  uuid: string;
  session_id: string;
}

export interface RunContent {
  type: "text" | "tool_use" | "tool_result" | "result";
  id: string;
  name: string;
  input: { command: string; description: string };
  content: string;
  caller?: { type: string };
  tool_use_id?: string;
  is_error?: boolean;
  result?: string;
  tool_result?: string;
}
/** Final result line (success or error). */
export interface RunResult {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  stop_reason: string;
  session_id: string;
  total_cost_usd?: number;
  usage: RunResultUsage;
  modelUsage: {
    [key: string]: ModelUsageEntry;
  };
  messages?: RunMessage[];
  permission_denials?: unknown[];
  fast_mode_state?: string;
  uuid: string;
}

/** One run line from the output JSON (lines array). */
export type Run =
  | RunSystemInit
  | RunAssistant
  | RunUser
  | RunSystemTaskStarted
  | RunSystemTaskProgress
  | RunResult;

/** Type guard: run line has modelUsage (result line). */
export function runHasModelUsage(r: Run): r is RunResult {
  return r.type === "result" && "modelUsage" in r;
}

export interface StatesResponse {
  states: StateEntry[];
}

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

export interface CommentsResponse {
  comments: IssueComment[];
}

export interface CommentResponse {
  comment: IssueComment;
}

export interface IssuesResponse {
  issues: Issue[];
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
  state_snapshot?: JobState | null;
  state?: JobState;
  runs?: { name: string; content: Run[] };
}

export interface JobsResponse {
  jobs: Job[];
}

export interface ProjectsResponse {
  projects: Project[];
}
