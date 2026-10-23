import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { getDB } from "../db.js";
import type { Issue, Job, JobState, Run, RunContent } from "../types.js";
import { getStateDir, log } from "../utils.js";
import { jobForApiResponse, parsePositiveInt } from "../lib/job-api.js";
import { FindOptionsWhere } from "typeorm";

const router = Router();

function getRuns(
  adwId: string,
  step: string,
): { name: string; content: Run[] } {
  const stepName = step.replace("await_", "");
  const runJsonPath = path.join(getStateDir(), adwId, stepName, "run.json");
  if (fs.existsSync(runJsonPath)) {
    const raw = fs.readFileSync(runJsonPath, "utf-8");
    const run = JSON.parse(raw).lines.map(
      (r: string) => JSON.parse(r) as RunContent,
    );
    return { name: stepName, content: run };
  }
  return { name: stepName, content: [] };
}

router.get("/jobs", async (req, res) => {
  const projectIdParam = req.query.project_id;
  const issueIdParam = req.query.issue_id;
  const adwIdParam = req.query.adw_id;
  const { jobRepo } = await getDB();
  let jobs: Job[];
  const where: FindOptionsWhere<Job> = {};
  if (projectIdParam !== undefined && projectIdParam !== "") {
    where.project_id = Number(projectIdParam);
  }
  if (issueIdParam !== undefined && issueIdParam !== "") {
    where.issue_id = Number(issueIdParam);
  }
  if (adwIdParam !== undefined && adwIdParam !== "") {
    where.adw_id = String(adwIdParam);
  }
  jobs = (await jobRepo.find({ where, order: { id: "DESC" } })) as Job[];

  // if (issueIdParam !== undefined && issueIdParam !== "") {
  //   const issueId = parsePositiveInt(issueIdParam);
  //   if (issueId === null) {
  //     res.status(400).json({ error: "Invalid 'issue_id' query parameter" });
  //     return;
  //   }
  //   const issue = (await issueRepo.findOne({
  //     where: { id: issueId },
  //   })) as Issue | null;
  //   if (!issue) {
  //     res.status(404).json({ error: "Issue not found" });
  //     return;
  //   }
  //   jobs = (await jobRepo.find({
  //     where: { issue_id: issueId },
  //     order: { id: "DESC" },
  //   })) as Job[];
  //   return res.json({
  //     jobs: jobs.map((j) =>
  //       jobForApiResponse(j as Job & { state_snapshot?: string | null }),
  //     ),
  //   });
  // } else if (projectIdParam !== undefined && projectIdParam !== "") {
  //   const projectId = parsePositiveInt(projectIdParam);
  //   if (projectId === null) {
  //     res.status(400).json({ error: "Invalid 'project_id' query parameter" });
  //     return;
  //   }
  //   jobs = (await jobRepo.find({ where: { project_id: projectId } })) as Job[];
  // } else {
  //   jobs = (await jobRepo.find()) as Job[];
  // }
  res.json({
    jobs: jobs.map((j) =>
      jobForApiResponse(j as Job & { state_snapshot?: string | null }),
    ),
  });
});

router.get("/job/:id", async (req, res) => {
  const jobId = parsePositiveInt(req.params.id);
  log(`GET /job/${jobId} started`);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const { jobRepo } = await getDB();
  const job = (await jobRepo.findOne({ where: { id: jobId } })) as Job | null;
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.adw_id) {
    const stateDir = getStateDir();
    const statePath = path.join(stateDir, job.adw_id, "state.json");
    if (fs.existsSync(statePath)) {
      const raw = fs.readFileSync(statePath, "utf-8");
      const state = JSON.parse(raw) as unknown;
      delete (state as { job: unknown }).job;
      job.state = state as JobState;
      const step = job.step?.replace("await_", "") ?? "";
      job.runs = getRuns(job.adw_id, step);
    }
  }
  res.json({
    job: jobForApiResponse(job as Job & { state_snapshot?: string | null }),
  });
});

router.delete("/job/:id", async (req, res) => {
  const jobId = parsePositiveInt(req.params.id);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const { jobRepo } = await getDB();
  const job = (await jobRepo.findOne({ where: { id: jobId } })) as Job | null;
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.adw_id) {
    const stateDir = getStateDir();
    const statePath = path.join(stateDir, job.adw_id);
    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath, { recursive: true });
    }
  }
  await jobRepo.delete({ id: jobId });
  res.json({ status: "deleted", id: jobId });
});

export default router;
