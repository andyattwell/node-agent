import type { Job, JobUpdateFields } from "./db.js";
import { getDataSource } from "./db.js";
import { Job as JobEntity } from "./entities/Job.js";
import logger from "./logger.js";
import { WorkflowState } from "./workflow-state.js";

export type { Job, JobUpdateFields, Project } from "./db.js";

function toJob(row: JobEntity): Job {
  return {
    id: row.id,
    adw_id: row.adw_id ?? "",
    step: row.step,
    status: row.status,
    prompt: row.prompt,
    created_at: row.created_at,
    started_at: row.started_at,
    updated_at: row.updated_at,
    process_id: row.process_id,
    project_id: row.project_id,
    issue_id: row.issue_id ?? null,
    state_snapshot: row.state_snapshot ?? null,
  };
}

/**
 * Update a job row by id. Only provided fields are updated.
 * updated_at is always set to datetime('now').
 */
export async function updateJob(
  jobId: number,
  fields: JobUpdateFields,
): Promise<void> {
  const ds = await getDataSource();
  const repo = ds.getRepository(JobEntity);
  const row = await repo.findOne({ where: { id: jobId } });
  if (!row) return;
  const allowed = [
    "adw_id",
    "step",
    "status",
    "started_at",
    "process_id",
    "project_id",
    "issue_id",
    "state_snapshot",
  ] as const;
  let anySet = false;
  const r = row as unknown as Record<string, unknown>;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      r[key] = fields[key] as string | number | null;
      anySet = true;
    }
  }
  if (!anySet) return;
  row.updated_at = new Date().toISOString();
  logger.logMessage(
    `UPDATE jobs id=${jobId} fields=${JSON.stringify(fields, null, 2)}`,
  );
  await repo.save(row);
}

export async function updateJobFromState(state: WorkflowState): Promise<void> {
  const id = state.job?.id;
  if (id == null) return;
  await updateJob(id, {
    status: state.status ?? "running",
    started_at: state.job?.started_at ?? new Date().toISOString(),
    process_id: state.pid ?? null,
    adw_id: state.adwId,
    state_snapshot: JSON.stringify(
      {
        adw_id: state.adwId,
        step: state.currentStep,
        status: state.status ?? "running",
        currentStep: state.currentStep,
        process_id: state.pid ?? null,
      },
      null,
      2,
    ),
  });
}

export async function createJob(fields: JobUpdateFields): Promise<Job> {
  const ds = await getDataSource();
  const repo = ds.getRepository(JobEntity);
  const toInsert: Partial<JobEntity> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "updated_at") continue;
    if (value !== undefined && value !== null) {
      (toInsert as Record<string, unknown>)[key] = value;
    }
  }
  const created = await repo.save(repo.create(toInsert));
  return toJob(created);
}

/** One DB row per workflow step; called at the start of each step iteration. */
export async function createJobForWorkflowStep(
  state: WorkflowState,
): Promise<Job> {
  const started = new Date().toISOString();
  return createJob({
    adw_id: state.adwId,
    step: state.currentStep,
    status: state.status ?? "running",
    prompt: state.prompt,
    project_id: state.job?.project_id ?? null,
    issue_id: state.issueId ?? null,
    process_id: state.pid ?? null,
    started_at: started,
  });
}

export async function loadJobById(jobId: number): Promise<Job | null> {
  const ds = await getDataSource();
  const repo = ds.getRepository(JobEntity);
  const row = await repo.findOne({ where: { id: jobId } });
  return row ? toJob(row) : null;
}
