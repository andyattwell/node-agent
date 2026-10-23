import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import { getDB } from "../db.js";
import { Job, JobState } from "../types.js";
import { parsePositiveInt } from "../lib/job-api.js";
import { getStateDir } from "../utils.js";

const router = Router();

async function getAdws(adwIds: string[]): Promise<JobState[]> {
  return await Promise.all(
    adwIds.map(async (adwId) => {
      const stateDir = getStateDir();
      const statePath = path.join(stateDir, adwId, "state.json");
      if (fs.existsSync(statePath)) {
        const raw = fs.readFileSync(statePath, "utf-8");
        const state = JSON.parse(raw) as unknown;
        delete (state as { job: unknown }).job;
        return state as JobState;
      }
      return { adwId } as JobState;
    }),
  );
}

/** Distinct non-empty adw_ids, ordered by most recent job (highest job id) first. */
function orderedDistinctAdwIds(jobs: Job[]): string[] {
  const maxJobId = new Map<string, number>();
  for (const j of jobs) {
    const aid = j.adw_id;
    if (aid == null || String(aid).trim() === "") continue;
    const cur = maxJobId.get(aid) ?? 0;
    if (j.id > cur) maxJobId.set(aid, j.id);
  }
  return [...maxJobId.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([adwId]) => adwId);
}

router.get("/adw/:issueId", async (req, res) => {
  const issueId = parsePositiveInt(req.params.issueId);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issue id" });
    return;
  }
  const { jobRepo } = await getDB();
  const jobs = (await jobRepo.find({
    where: { issue_id: issueId },
    order: { id: "DESC" },
  })) as Job[];
  const adwIds = orderedDistinctAdwIds(jobs);
  const states = await getAdws(adwIds);
  res.json({ adws: states });
});

export default router;
