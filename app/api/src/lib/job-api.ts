import type { Job, JobState } from "../types.js";
import { getDB } from "../db.js";

/** Parse a value as a positive integer; returns null if invalid (avoids passing NaN to TypeORM). */
export function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

/**
 * Build a plain JSON job object. TypeORM entities do not spread reliably onto
 * `{ ...job }`, so read columns explicitly (including `state_snapshot`).
 */
export function jobForApiResponse(
  job: Job & { state_snapshot?: string | null },
): Job {
  const raw = job as unknown as Record<string, unknown>;
  const snap = raw.state_snapshot;
  return {
    id: job.id,
    adw_id: job.adw_id,
    step: job.step,
    status: job.status,
    prompt: job.prompt,
    created_at: job.created_at,
    started_at: job.started_at,
    updated_at: job.updated_at,
    process_id: job.process_id,
    project_id: job.project_id,
    issue_id: job.issue_id,
    state: job.state,
    state_snapshot:
      typeof snap === "string" ? (JSON.parse(snap) as JobState) : null,
    ...(job.state !== undefined ? { state: job.state } : {}),
    ...(job.runs !== undefined ? { runs: job.runs } : {}),
  };
}

export async function jobExistsForProjectIssue(
  projectId: number,
  adwId: string,
): Promise<boolean> {
  const { jobRepo } = await getDB();
  const job = (await jobRepo.findOne({
    where: { project_id: projectId, adw_id: adwId },
  })) as { adw_id: string | null } | null;
  return job != null && job.adw_id != null;
}

/** Resolve optional adw_id from body: null/omit/blank means no job link. */
export function parseOptionalAdwId(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const t = raw.trim();
  return { ok: true, value: t === "" ? null : t };
}
