export interface Args {
  prompt?: string;
  adwId?: string;
  /** Set when started by cron or API; used with --issue-id */
  jobId?: string;
  /** When set, ADW loads prompt from issue description and syncs issue lifecycle */
  issueId?: number;
  /** Project the issue belongs to; required with --issue-id when not resuming */
  projectId?: number;
  resume: boolean;
}

function parsePositiveIntArg(value: string): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return undefined;
  return n;
}

/**
 * Parse argv (e.g. process.argv.slice(2)) into Args.
 */
export function parseArgs(argv: string[]): Args {
  const args: Args = { resume: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--resume") args.resume = true;
    else if (a === "--prompt" && argv[i + 1]) args.prompt = argv[++i];
    else if (a === "--adw-id" && argv[i + 1]) args.adwId = argv[++i];
    else if (a === "--job-id" && argv[i + 1]) args.jobId = argv[++i];
    else if (a === "--issue-id" && argv[i + 1]) {
      const id = parsePositiveIntArg(argv[++i]);
      if (id !== undefined) args.issueId = id;
    } else if (a === "--project-id" && argv[i + 1]) {
      const id = parsePositiveIntArg(argv[++i]);
      if (id !== undefined) args.projectId = id;
    } else if (a.startsWith("--adw-id=")) args.adwId = a.slice(9);
    else if (a.startsWith("--job-id=")) args.jobId = a.slice(9);
    else if (a.startsWith("--issue-id=")) {
      const id = parsePositiveIntArg(a.slice(11));
      if (id !== undefined) args.issueId = id;
    } else if (a.startsWith("--project-id=")) {
      const id = parsePositiveIntArg(a.slice(13));
      if (id !== undefined) args.projectId = id;
    }
  }
  return args;
}

/**
 * Validates CLI combinations. Exits the process on error.
 * If both --issue-id and --prompt are present, the issue wins (prompt ignored).
 */
export function validateCliArgs(args: Args): void {
  if (args.jobId != null && args.jobId !== "" && args.issueId == null) {
    console.error("--issue-id is required when --job-id is set");
    process.exit(1);
  }
  if (args.issueId != null && !args.resume && args.projectId == null) {
    console.error("--project-id is required when using --issue-id");
    process.exit(1);
  }
  if (args.resume && !args.adwId) {
    console.error("--resume requires --adw-id");
    process.exit(1);
  }
  if (args.jobId != null && args.jobId !== "") {
    return;
  }
  if (args.resume) {
    return;
  }
  if (args.issueId != null) {
    return;
  }
  if (args.prompt != null && args.prompt.trim() !== "") {
    return;
  }
  console.error(
    "Provide one of: --issue-id with --project-id, --prompt, --job-id with --issue-id and --project-id, or --resume --adw-id",
  );
  process.exit(1);
}
