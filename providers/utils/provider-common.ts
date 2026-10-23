import path from "node:path";
import fs from "node:fs";
import type { ResolvedAdwConfig } from "../../utils/adw-config.js";
import type { InstructionContext } from "../ai-provider.js";
import { AGENT_COMMANDS, expandCommand } from "../../utils/agent-commands.js";
import { getStateDir } from "../../utils/workflow-state.js";

const DEFAULT_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * Express filesystem paths in prompts as relative to the git worktree so agent output
 * committed to the app repo does not embed host-specific absolute paths. Paths outside
 * the worktree (e.g. ADW state/) become relative paths from the worktree (e.g. ../../state/id).
 */
export function pathRelativeToWorktree(
  absPath: string,
  workPath: string,
): string {
  if (!absPath) return "";
  const a = path.resolve(absPath);
  const w = path.resolve(workPath);
  const rel = path.relative(w, a);
  if (rel === "") return ".";
  return rel;
}

/**
 * Parse timeout from an environment variable.
 * @param envVar - Environment variable name (e.g. ADW_CURSOR_TIMEOUT_MS).
 * @param defaultMs - Default value when unset or invalid.
 */
export function getTimeoutMs(
  envVar: string,
  defaultMs: number = DEFAULT_TIMEOUT_MS,
): number {
  const raw = process.env[envVar];
  if (raw == null || raw === "") return defaultMs;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}

export async function saveCommandPrompt(
  command: string,
  prompt: string,
  adwId: string,
  repoRoot: string,
): Promise<void> {
  const stateDir = getStateDir(adwId);
  const promptPath = path.join(stateDir, command, "prompt.md");
  fs.mkdirSync(path.dirname(promptPath), { recursive: true });
  fs.writeFileSync(promptPath, `\n${prompt}\n`);
}

export function readCommandPrompt(
  command: string,
  adwId: string,
  repoRoot: string,
): string {
  const stateDir = getStateDir(adwId);
  const promptPath = path.join(stateDir, command, `prompt.md`);
  return fs.readFileSync(promptPath, "utf8");
}

export async function saveCommandOutput(
  command: string,
  stdout: string,
  stderr: string,
  adwId: string,
  repoRoot: string,
): Promise<void> {
  let cmd = command.replace("await_", "");
  const stateDir = getStateDir(adwId);
  const outputPath = path.join(stateDir, cmd, "output.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ stdout, stderr }, null, 2));
}

export function clearCommandOutput(
  command: string,
  adwId: string,
  repoRoot: string,
): void {
  let cmd = command.replace("await_", "");
  const stateDir = getStateDir(adwId);
  const outputPath = path.join(stateDir, cmd, `output.json`);
  if (!fs.existsSync(outputPath)) {
    return;
  }
  fs.writeFileSync(outputPath, JSON.stringify({ lines: [] }, null, 2));
}

export function appendLineCommandOutput(
  command: string,
  line: string,
  adwId: string,
  repoRoot: string,
  fileName?: string,
): void {
  let cmd = command.replace("await_", "");
  const stateDir = getStateDir(adwId);
  const outputPath = path.join(stateDir, cmd, fileName ?? "run.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (!fs.existsSync(outputPath)) {
    fs.writeFileSync(outputPath, JSON.stringify({ lines: [] }, null, 2));
  }
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  output.lines.push(line);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

export function readCommandOutput(
  command: string,
  adwId: string,
  repoRoot: string,
): string {
  let cmd = command.replace("await_", "");
  const stateDir = getStateDir(adwId);
  const outputPath = path.join(stateDir, cmd, "output.json");
  if (!fs.existsSync(outputPath)) {
    return "";
  }
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  return output.lines;
}

/**
 * Build the prompt for an instruction step using AGENT_COMMANDS and expandCommand.
 * Saves the prompt to the state dir and returns it, or "" if step is unknown.
 */
export async function buildPrompt(ctx: InstructionContext): Promise<string> {
  const step = ctx.step.replace("await_", "");
  if (step in AGENT_COMMANDS) {
    const stateDir = getStateDir(ctx.adwId);
    const reviewResultPath = path.join(stateDir, "review", "result.json");
    const wt = ctx.workPath;
    const prompt = expandCommand(step, {
      ISSUE_TYPE: ctx.state.issueClass ?? "",
      WORKING_DIRECTORY: ".",
      PROMPT_PATH: pathRelativeToWorktree(ctx.state.promptPath ?? "", wt),
      PROMPT_STR: ctx.state.promptPath
        ? getFileContent(ctx.state.promptPath)
        : ctx.state.prompt,
      PLAN_PATH: pathRelativeToWorktree(ctx.state.planPath ?? "", wt),
      PLAN_STR: getFileContent(ctx.state.planPath ?? ""),
      IMPLEMENTATION_SUMMARY_PATH: pathRelativeToWorktree(
        ctx.state.implementationSummaryPath ?? "",
        wt,
      ),
      IMPLEMENTATION_SUMMARY_STR: getFileContent(
        ctx.state.implementationSummaryPath ?? "",
      ),
      ADW_ID: ctx.adwId,
      PROJECT_ROOT: ".",
      PR_URL: ctx.state.prUrl ?? "",
      PR_ID: String(ctx.state.prId ?? ""),
      REVIEW_RESULT_PATH: pathRelativeToWorktree(reviewResultPath, wt),
      REVIEW_RESULT_STR: getFileContent(reviewResultPath),
      STATE_DIR: pathRelativeToWorktree(stateDir, wt),
    });

    await saveCommandPrompt(step, prompt, ctx.adwId, ctx.repoRoot);

    return prompt;
  }
  return "";
}

export function getAvailableCommands(): string[] {
  let pwd = process.cwd();
  if (!pwd.includes("adw")) {
    pwd = path.join(pwd, "adw");
  }
  const commandsDir = path.join(pwd, "commands", "llama");
  const commands = fs.readdirSync(commandsDir);
  return commands.filter((command) => command.endsWith(".md"));
}

export function getCommandFromPrompt(prompt: string): string | undefined {
  let command = prompt.split("/")[0];
  command = command.split(" ")[0];
  if (!getAvailableCommands().includes(command)) {
    return;
  }
  return command;
}

export function buildCommandFromPrompt(
  command: string,
  prompt: string,
): string | undefined {
  const commandPath = path.join(
    process.cwd(),
    "commands",
    "llama",
    command + ".md",
  );
  if (!fs.existsSync(commandPath)) {
    return;
  }
  const commandContent = fs.readFileSync(commandPath, "utf8");
  return commandContent + "\n\n" + prompt;
}

export function getFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

export type ProviderName =
  | "cursor"
  | "custom"
  | "claude"
  | "pi"
  | "none";

/** Providers that support interactive chat (excludes `none`). */
export type ChatCapableProviderName = Exclude<ProviderName, "none">;

/** Max length for client-supplied model id / path (WebSocket / stdin). */
export const MAX_CHAT_MODEL_OVERRIDE_LEN = 512;

const DEFAULT_PROVIDER: ProviderName = "none";
/** When `ADW_AI_MODEL` is unset, Ollama / llama-server use this id. */
export const DEFAULT_ADW_AI_MODEL = "llama3.2";

/** When `ADW_AI_MODEL` is unset, Gemini provider uses this id. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function getResolvedGeminiModel(): string {
  return process.env.ADW_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

/**
 * Read AI provider name from environment.
 * Values: "cursor" | "claude" | "pi" | "custom" | "none". Default: "none".
 */
export function getProviderName(): ProviderName {
  return process.env.ADW_AI_PROVIDER?.toLowerCase().trim() as ProviderName || DEFAULT_PROVIDER;
}

/**
 * Normalize a client-supplied provider for chat. Returns null if missing, invalid, or `none`.
 */
export function parseChatProviderOverride(
  raw: unknown,
): ChatCapableProviderName | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const lowered = raw.toLowerCase().trim();
  return lowered as ChatCapableProviderName;
}

/**
 * Sanitize model override from the client: trim, strip ASCII control chars, cap length.
 */
export function sanitizeChatModelOverride(raw: unknown): string {
  if (raw == null || typeof raw !== "string") return "";
  const s = raw.replace(/[\x00-\x1f\x7f]/g, "").trim();
  return s.length > MAX_CHAT_MODEL_OVERRIDE_LEN
    ? s.slice(0, MAX_CHAT_MODEL_OVERRIDE_LEN)
    : s;
}

/**
 * Unified model id from `ADW_AI_MODEL`. Empty if unset (use for CLI: omit `--model` when empty).
 */
export function getAdwModel(config?: ResolvedAdwConfig): string {
  return config?.aiModel.trim() || process.env.ADW_AI_MODEL?.trim() || "";
}

/**
 * Model or backend label for chat UI.
 */
export function getChatModelLabel(): string {
  switch (getProviderName()) {
    case "custom":
    case "cursor":
    case "claude":
    case "pi":
      return getAdwModel();
    default:
      return "-";
  }
}

// --- Resolved ADW config (project + env merge, no process.env mutation) ---

export function getProviderNameFromConfig(
  config: ResolvedAdwConfig,
): ProviderName {
  return config.aiProvider;
}

export function getResolvedAdwModelFromConfig(
  config: ResolvedAdwConfig,
): string {
  return getAdwModel(config) || DEFAULT_ADW_AI_MODEL;
}

export function getLLMServerBaseUrlFromConfig(config?: ResolvedAdwConfig): string {
  const raw =
    config?.aiPath.trim() ||
    process.env.ADW_AI_PATH?.trim() ||
    "";
  return (raw).replace(/\/$/, "");
}

/** Default matches llama-server `-c` in `buildServerArgv` (16384). */
const DEFAULT_CHAT_CONTEXT_WINDOW = 16384;

/**
 * Max context window in tokens for chat UI fullness (denominator).
 * Set `ADW_CHAT_CONTEXT_WINDOW` to match Ollama `num_ctx` / llama-server `-c`.
 */
export function getChatContextWindowTokens(): number {
  const raw = process.env.ADW_CHAT_CONTEXT_WINDOW?.trim();
  if (raw == null || raw === "") return DEFAULT_CHAT_CONTEXT_WINDOW;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHAT_CONTEXT_WINDOW;
}

// ============================================================================
// Pi Provider Configuration
// ============================================================================

const DEFAULT_PI_PROVIDER = "google";

/**
 * Read Pi CLI path from environment.
 * Default: "pi" (expect binary on PATH).
 */
export function getADWCliPath(config?: ResolvedAdwConfig): string {
  return config?.aiPath.trim() || process.env.ADW_AI_PATH?.trim() || "pi";
}

/**
 * Read Pi timeout from environment.
 * Default: 10 minutes (same as DEFAULT_TIMEOUT_MS).
 */
export function getPiTimeoutMs(): number {
  return getTimeoutMs("ADW_PI_TIMEOUT_MS");
}

/**
 * Read Pi thinking level from environment.
 * Returns undefined if unset (let pi use default).
 */
export function getPiThinkingLevel(): string | undefined {
  const raw = process.env.ADW_PI_THINKING?.trim();
  return raw || undefined;
}

/**
 * Read Pi tools allowlist from environment.
 * Comma-separated list of tool names to enable.
 * Returns undefined if unset.
 */
export function getPiTools(): string | undefined {
  const raw = process.env.ADW_PI_TOOLS?.trim();
  return raw || undefined;
}

/**
 * Read Pi tools denylist from environment.
 * Comma-separated list of tool names to disable.
 * Returns undefined if unset.
 */
export function getPiExcludeTools(): string | undefined {
  const raw = process.env.ADW_PI_EXCLUDE_TOOLS?.trim();
  return raw || undefined;
}

/**
 * Read Pi no-tools flag from environment.
 * If "1" / "true" / "yes", disable all tools.
 */
export function getPiNoTools(): boolean {
  const raw = process.env.ADW_PI_NO_TOOLS?.toLowerCase().trim();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Read Pi no-session flag from environment.
 * If "1" / "true" / "yes", don't save session (ephemeral).
 */
export function getPiNoSession(): boolean {
  const raw = process.env.ADW_PI_NO_SESSION?.toLowerCase().trim();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Build Pi CLI args for model/provider/thinking/tools.
 */
export function buildPiCliArgs(model: string, provider?: string): string[] {
  const args: string[] = [];
  if (provider) args.push("--provider", provider);
  const m = model.trim();
  if (m && m !== "auto") args.push("--model", m);
  return args;
}
