#!/usr/bin/env node
// Picks one open issue (oldest first), claims it, spawns ADW. Run from cron every 5 minutes; see README.
import "reflect-metadata";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { getDataSource } from "../utils/db.js";
import { Issue } from "../utils/entities/Issue.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.PROJECT_ROOT ?? path.resolve(__dirname, "..");
const logFile = path.join(projectRoot, "logs", "cron-issues.log");

config({ path: path.join(projectRoot, ".env") });

function logLine(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, line, "utf8");
}

async function main(): Promise<void> {
  const ds = await getDataSource();
  const issueRepo = ds.getRepository(Issue);
  const candidate = await issueRepo.findOne({
    where: { status: "open" },
    order: { created_at: "ASC" },
  });
  if (!candidate) {
    logLine("No open issues; exiting.");
    process.exit(0);
    return;
  }

  const now = new Date().toISOString();
  const claim = await issueRepo.update(
    { id: candidate.id, status: "open" },
    { status: "started", updated_at: now },
  );
  if (!claim.affected) {
    logLine(`Issue id=${candidate.id} was claimed by another run; exiting.`);
    process.exit(0);
    return;
  }

  logLine(`Claimed issue id=${candidate.id}; spawning ADW.`);

  const child = spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--issue-id",
      String(candidate.id),
      "--project-id",
      String(candidate.project_id),
    ],
    {
      cwd: projectRoot + "/adw",
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
  process.exit(0);
}

main().catch((err) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  try {
    logLine(`ERROR: ${msg}`);
  } catch {
    console.error(msg);
  }
  process.exit(1);
});
