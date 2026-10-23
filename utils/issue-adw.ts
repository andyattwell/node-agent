import { getDataSource } from "./data-source.js";
import { Issue } from "./entities/Issue.js";
import { Comment } from "./entities/Comment.js";

/** Matches API / client allowed issue statuses for ADW-driven updates. */
export type IssueAdwStatus =
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

const ADW_COMMENTER = "ADW";

function nowIso(): string {
  return new Date().toISOString();
}

export async function loadIssueForAdw(
  id: number,
  projectId?: number,
): Promise<Issue | null> {
  const ds = await getDataSource();
  const repo = ds.getRepository(Issue);
  const where = projectId != null ? { id, project_id: projectId } : { id };
  return repo.findOne({ where });
}

export async function updateIssueAdwFields(
  issueId: number,
  fields: Partial<Pick<Issue, "status" | "adw_id">>,
): Promise<void> {
  const ds = await getDataSource();
  const repo = ds.getRepository(Issue);
  await repo.update(issueId, {
    ...fields,
    updated_at: nowIso(),
  });
}

export async function addIssueAdwComment(
  issueId: number,
  message: string,
): Promise<void> {
  const ds = await getDataSource();
  const repo = ds.getRepository(Comment);
  await repo.save(
    repo.create({
      commenter: ADW_COMMENTER,
      comment: message,
      issue_id: issueId,
    }),
  );
}

/**
 * Issue status for the workflow phase being entered (`state.currentStep` after transition).
 * Returns null when status should not change (e.g. entering `report`).
 */
export function mapEnteringWorkflowStepToIssueStatus(
  currentStep: string,
): IssueAdwStatus | null {
  switch (currentStep) {
    case "await_plan":
      return "planning";
    case "await_implement":
      return "implementing";
    case "await_test":
      return "testing";
    case "await_pr":
      return "pr";
    case "await_review":
      return "reviewing";
    case "report":
      return null;
    default:
      return null;
  }
}

const MAX_ERROR_COMMENT = 2000;

export function truncateForComment(
  text: string,
  max = MAX_ERROR_COMMENT,
): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 20)}… [truncated]`;
}

/**
 * After a state save, if `currentStep` changed vs previous file, record step completion on the issue.
 * Skips when there was no prior state file (first persist after start).
 */
export async function syncIssueAfterStepTransition(
  issueId: number,
  previous: { currentStep: string } | null,
  newCurrentStep: string,
): Promise<void> {
  if (!previous) {
    const nextStatus = mapEnteringWorkflowStepToIssueStatus(newCurrentStep);
    if (nextStatus != null) {
      await updateIssueAdwFields(issueId, { status: nextStatus });
    }
    return;
  }
  if (previous.currentStep === newCurrentStep) return;

  await addIssueAdwComment(
    issueId,
    `ADW completed step: ${previous.currentStep}`,
  );

  const nextStatus = mapEnteringWorkflowStepToIssueStatus(newCurrentStep);
  if (nextStatus != null) {
    await updateIssueAdwFields(issueId, { status: nextStatus });
  }
}

export async function markIssueAdwCompleted(
  issueId: number,
  adwId: string,
): Promise<void> {
  await updateIssueAdwFields(issueId, { status: "completed" });
  await addIssueAdwComment(issueId, `ADW completed ID: ${adwId}`);
}

export async function markIssueAdwError(
  issueId: number,
  message: string,
): Promise<void> {
  await updateIssueAdwFields(issueId, { status: "error" });
  await addIssueAdwComment(issueId, truncateForComment(message));
}

export async function markIssueAdwCancelled(issueId: number): Promise<void> {
  await updateIssueAdwFields(issueId, { status: "cancelled" });
}

export async function addIssueAdwRetryComment(
  issueId: number,
  step: string,
  retryCount: number,
): Promise<void> {
  await addIssueAdwComment(
    issueId,
    `ADW retrying ${step} (retry ${retryCount})`,
  );
}

export async function notifyIssueAdwPaused(
  issueId: number,
  title: string,
): Promise<void> {
  await addIssueAdwComment(
    issueId,
    `ADW paused: manual step required - ${title}`,
  );
}

export async function bootstrapIssueForNewAdw(
  issueId: number,
  adwId: string,
  projectId: number,
): Promise<Issue> {
  const issue = await loadIssueForAdw(issueId, projectId);
  if (!issue) {
    throw new Error(`Issue not found: id=${issueId} project_id=${projectId}`);
  }
  await updateIssueAdwFields(issueId, {
    status: "started",
    adw_id: adwId,
  });
  await addIssueAdwComment(issueId, `ADW started ID: ${adwId}`);
  return issue;
}
