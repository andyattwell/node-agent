import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Router } from "express";
import { getDB } from "../db.js";
import type { Job } from "../types.js";
import {
  getPpid,
  getProjectRoot,
  loadState,
  saveState,
} from "../utils.js";
import { parsePositiveInt } from "../lib/job-api.js";

const router = Router();

router.post("/run", async (req, res) => {
  const prompt = req.body?.prompt;
  const projectIdParam = req.body?.project_id;
  const issueIdRaw = req.body?.issue_id;
  if (projectIdParam === undefined || projectIdParam === null) {
    res
      .status(400)
      .json({ error: 'Missing or invalid "project_id" in request body' });
    return;
  }
  const projectId = parsePositiveInt(projectIdParam);
  if (projectId === null) {
    res.status(400).json({ error: 'Invalid "project_id" in request body' });
    return;
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    res
      .status(400)
      .json({ error: 'Missing or invalid "prompt" in request body' });
    return;
  }
  let issueId: number | null = null;
  if (issueIdRaw !== undefined && issueIdRaw !== null && issueIdRaw !== "") {
    const parsed = parsePositiveInt(issueIdRaw);
    if (parsed === null) {
      res.status(400).json({ error: 'Invalid "issue_id" in request body' });
      return;
    }
    issueId = parsed;
  }
  const { jobRepo } = await getDB();
  const created = (await jobRepo.save(
    jobRepo.create({
      adw_id: null,
      step: null,
      status: "pending",
      prompt: prompt.trim(),
      project_id: projectId,
      issue_id: issueId,
    }),
  )) as { id: number };
  res.status(202).json({ status: "queued", jobId: String(created.id) });
});

router.post("/start", async (req, res) => {
  const jobId = parsePositiveInt(req.body?.id);
  if (jobId === null) {
    res.status(400).json({ error: "Missing or invalid 'id' in request body" });
    return;
  }
  const { jobRepo } = await getDB();
  const job = (await jobRepo.findOne({ where: { id: jobId } })) as Job | null;
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.issue_id == null) {
    res.status(400).json({
      error: "Job has no issue_id; cannot start ADW without --issue-id",
    });
    return;
  }
  if (job.project_id == null) {
    res.status(400).json({
      error: "Job has no project_id; cannot start ADW",
    });
    return;
  }
  const child = spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--job-id",
      String(jobId),
      "--issue-id",
      String(job.issue_id),
      "--project-id",
      String(job.project_id),
    ],
    {
      cwd: getProjectRoot(),
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
  await jobRepo.update(jobId, { process_id: child.pid ?? null });
  res
    .status(200)
    .json({ status: "started", jobId: String(jobId), processId: child.pid });
});

router.post("/stop", async (req, res) => {
  if (typeof req.body?.pid !== "number") {
    res.status(400).json({ error: "Missing or invalid 'pid' in request body" });
    return;
  }

  const { ppid, code, signal } = await getPpid(req.body.pid);
  if (code === 0) {
    process.kill(ppid, "SIGTERM");
  }

  const state = loadState(req.body.adwId, getProjectRoot());
  if (state) {
    state.status = "stopped";
    saveState(req.body.adwId, state, getProjectRoot());
  }

  res.status(200).json({
    status: "stopped",
    message: "Agent run stopped",
    ppid,
    code,
    signal,
  });
});

router.post("/resume", async (req, res) => {
  const { adwId } = req.body;
  if (typeof adwId !== "string") {
    res
      .status(400)
      .json({ error: "Missing or invalid 'adwId' in request body" });
    return;
  }
  const projectRoot = getProjectRoot();
  const outFile = fs.openSync(
    path.join(projectRoot, "state", adwId, `output.log`),
    "a",
  );
  const errFile = fs.openSync(
    path.join(projectRoot, "state", adwId, `error.log`),
    "a",
  );

  const child = spawn(
    "npm",
    ["run", "dev", "--", "--resume", "--adw-id", adwId],
    {
      cwd: getProjectRoot(),
      detached: true,
      stdio: ["ignore", outFile, errFile],
    },
  );
  child.unref();
  res.status(202).json({
    status: "started",
    message: "Agent run started in background",
    process: child.pid,
  });
});

export default router;
