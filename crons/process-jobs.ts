#!/usr/bin/env node
import "reflect-metadata";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { getDataSource } from "../utils/db.js";
import { Job } from "../utils/entities/Job.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.PROJECT_ROOT ?? path.resolve(__dirname, "..");
config({ path: path.join(projectRoot, ".env") });

async function main(): Promise<void> {
  const ds = await getDataSource();
  const jobRepo = ds.getRepository(Job);
  const pending = await jobRepo.findOne({
    where: { status: "pending" },
    order: { created_at: "ASC" },
  });
  if (!pending) {
    process.exit(0);
    return;
  }
  if (pending.issue_id == null) {
    process.exit(0);
    return;
  }
  if (pending.project_id == null) {
    console.error(`Job ${pending.id} has no project_id; cannot start ADW`);
    process.exit(0);
    return;
  }
  await jobRepo.update(pending.id, {
    status: "running",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const child = spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--job-id",
      String(pending.id),
      "--issue-id",
      String(pending.issue_id),
      "--project-id",
      String(pending.project_id),
    ],
    {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
