#!/usr/bin/env node
import "reflect-metadata";
import { config } from "dotenv";
import path from "node:path";

const envPath = path.resolve(ADW_PROJECT_ROOT, ".env");
config({ path: envPath });
if (!process.env.PROJECT_ROOT) process.env.PROJECT_ROOT = ADW_PROJECT_ROOT;

import { execSync } from "node:child_process";
import { prepareAdwWorkingCopy } from "./utils/git.js";
import {
  ADW_PROJECT_ROOT,
  loadProjectById,
  resolveAdwConfig,
  type ResolvedAdwConfig,
} from "./utils/adw-config.js";
import type {
  IssueClass,
  StepHandlerParams,
  StepOutcome,
  WorkflowState,
} from "./utils/workflow-state.js";
import { parseArgs, validateCliArgs, type Args } from "./utils/args.js";
import {
  generateAdwId,
  getStateDir,
  isWorkflowStep,
  loadState,
  logStepProgress,
  normalizeWorkflowStepName,
  persistAdwState,
} from "./utils/workflow-state.js";
import type { InstructionStep } from "./providers/index.js";
import type { Job } from "./utils/job-db.js";
import {
  createJobForWorkflowStep,
  loadJobById,
  updateJob,
} from "./utils/job-db.js";
import {
  addIssueAdwRetryComment,
  bootstrapIssueForNewAdw,
  loadIssueForAdw,
  markIssueAdwCancelled,
  markIssueAdwCompleted,
  markIssueAdwError,
  notifyIssueAdwPaused,
} from "./utils/issue-adw.js";
import {
  deriveIssueClassFromIssue,
  issuePrefersGitWorktree,
} from "./utils/issue-class.js";
import type { RunnerContext } from "./agents/agent.js";
import { Implementer } from "./agents/implementer.js";
import { Planner } from "./agents/planner.js";
import { PullRequestAgent } from "./agents/pull-request.js";
import { Reviewer } from "./agents/reviewer.js";
import { Tester } from "./agents/tester.js";
import {
  copyPromptToWorktree,
  MAX_TEST_RETRIES,
} from "./utils/step-helpers.js";
import logger from "./utils/logger.js";
import type { Issue } from "./utils/entities/Issue.js";

let currentAwdId: string | null = null;

function defaultExitIssueError(state: WorkflowState): string {
  return `ADW stopped at step ${state.currentStep} (adw ${state.adwId})`;
}

function parseEnvProjectId(): number | undefined {
  const raw = process.env.ADW_PROJECT_ID?.trim();
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

async function resumeADW(
  args: Args,
): Promise<{ state: WorkflowState; adwConfig: ResolvedAdwConfig } | null> {
  if (!args.adwId) {
    console.error("--adw-id is required");
    process.exit(1);
  }
  const state = loadState(args.adwId!, ADW_PROJECT_ROOT);
  if (!state) {
    console.error(`No state found for adw-id=${args.adwId}`);
    process.exit(1);
    return null;
  }
  const coercedStep = normalizeWorkflowStepName(state.currentStep);
  if (!isWorkflowStep(coercedStep)) {
    console.error(`Invalid workflow step in state: ${state.currentStep}`);
    process.exit(1);
    return null;
  }
  state.currentStep = coercedStep;

  const targetProjectId = state.job?.project_id ?? parseEnvProjectId() ?? 1;
  const project = await loadProjectById(targetProjectId);
  let resumeIssue: Issue | null = null;
  if (state.issueId != null) {
    resumeIssue = await loadIssueForAdw(state.issueId, targetProjectId);
  }
  if (state.issueClass == null) {
    state.issueClass = deriveIssueClassFromIssue(resumeIssue);
  }
  if (state.useGitWorktree === undefined) {
    state.useGitWorktree = issuePrefersGitWorktree(resumeIssue);
  }
  const adwConfig = resolveAdwConfig(project);
  state.status = "running";
  state.pid = process.pid;
  if (
    args.issueId != null &&
    state.issueId != null &&
    args.issueId !== state.issueId
  ) {
    state.status = "stopped";
    await persistAdwState(state);
    console.error(
      `--issue-id ${args.issueId} does not match state issueId ${state.issueId}`,
    );
    process.exit(1);
  }
  await persistAdwState(state);

  logStepProgress(
    state.adwId,
    path.join(ADW_PROJECT_ROOT, "state", state.adwId),
    "Resuming workflow",
    {
      adwId: state.adwId,
      jobId: state.job?.id,
      step: state.currentStep,
      workPath: state.workPath,
      branch: state.branchName,
    },
  );
  return { state, adwConfig };
}

/**
 * --job-id + --issue-id: resume from a saved job checkpoint or start a queued job row.
 */
async function startFromJobRow(
  args: Args,
): Promise<{ state: WorkflowState; adwConfig: ResolvedAdwConfig }> {
  const raw = args.jobId?.trim() ?? "";
  const jobId = parseInt(raw, 10);
  if (!Number.isFinite(jobId) || jobId < 1) {
    console.error("Invalid --job-id");
    process.exit(1);
  }
  const issueId = args.issueId!;
  const row = await loadJobById(jobId);
  if (!row) {
    await updateJob(jobId, { status: "stopped" });
    console.error(`No job found for id=${jobId}`);
    process.exit(1);
  }
  if (row.issue_id !== issueId) {
    await updateJob(jobId, { status: "stopped" });
    console.error(
      `--issue-id ${issueId} does not match job ${jobId} (issue_id=${row.issue_id ?? "null"})`,
    );
    process.exit(1);
  }
  if (
    args.projectId != null &&
    row.project_id != null &&
    row.project_id !== args.projectId
  ) {
    await updateJob(jobId, { status: "stopped" });
    console.error(
      `--project-id ${args.projectId} does not match job ${jobId} (project_id=${row.project_id})`,
    );
    process.exit(1);
  }

  const hasAdw = row.adw_id != null && row.adw_id !== "";
  if (hasAdw) {
    const loaded = loadState(row.adw_id, ADW_PROJECT_ROOT);
    if (!loaded) {
      await updateJob(jobId, { status: "stopped" });
      console.error(`No state on disk for job ${jobId} (adw-id=${row.adw_id})`);
      process.exit(1);
    }
    const rawStep =
      row.step != null && row.step !== "" ? row.step : loaded.currentStep;
    const coercedStep = normalizeWorkflowStepName(rawStep);
    if (!isWorkflowStep(coercedStep)) {
      await updateJob(jobId, { status: "stopped" });
      console.error(`Invalid step on job ${jobId}: ${rawStep}`);
      process.exit(1);
    }
    loaded.currentStep = coercedStep;
    loaded.status = "running";
    loaded.pid = process.pid;
    if (args.projectId != null) {
      const stProject = loaded.job?.project_id ?? row.project_id;
      if (stProject != null && stProject !== args.projectId) {
        await updateJob(jobId, { status: "stopped" });
        console.error(
          `--project-id ${args.projectId} does not match job/state (project_id=${stProject})`,
        );
        process.exit(1);
      }
    }
    const targetProjectId =
      loaded.job?.project_id ??
      row.project_id ??
      args.projectId ??
      parseEnvProjectId() ??
      1;
    const project = await loadProjectById(targetProjectId);
    const adwConfig = resolveAdwConfig(project);
    if (!loaded.job) {
      loaded.job = { project_id: targetProjectId } as Job;
    }
    loaded.job.project_id = targetProjectId;
    let jobResumeIssue: Issue | null = null;
    if (loaded.issueId != null) {
      jobResumeIssue = await loadIssueForAdw(loaded.issueId, targetProjectId);
    }
    if (loaded.issueClass == null) {
      loaded.issueClass = deriveIssueClassFromIssue(jobResumeIssue);
    }
    if (loaded.useGitWorktree === undefined) {
      loaded.useGitWorktree = issuePrefersGitWorktree(jobResumeIssue);
    }
    await persistAdwState(loaded);
    logStepProgress(
      loaded.adwId,
      path.join(ADW_PROJECT_ROOT, "state", loaded.adwId),
      "Resuming workflow from job",
      {
        adwId: loaded.adwId,
        jobDbId: jobId,
        step: loaded.currentStep,
        workPath: loaded.workPath,
        branch: loaded.branchName,
      },
    );
    return { state: loaded, adwConfig };
  }

  let adwId = generateAdwId();
  let prompt = row.prompt;
  let bootIssue: Issue | null = null;
  try {
    bootIssue = await bootstrapIssueForNewAdw(issueId, adwId, args.projectId!);
    prompt = bootIssue.description;
    logger.logMessage(`Bootstrapped issue for queued job ${jobId}: ${adwId}`);
  } catch (e) {
    await updateJob(jobId, { status: "stopped" });
    logger.logError(
      `Error bootstrapping issue for queued job: ${e instanceof Error ? e.message : e}`,
    );
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const targetProjectId =
    row.project_id ?? args.projectId ?? parseEnvProjectId() ?? 1;
  const project = await loadProjectById(targetProjectId);
  const adwConfig = resolveAdwConfig(project);

  const state: WorkflowState = {
    currentStep: "await_plan",
    status: "running",
    adwId,
    prompt,
    testRetries: 0,
    pid: process.pid,
    workPath: "",
    branchName: "",
    issueId,
    issueClass: deriveIssueClassFromIssue(bootIssue),
    useGitWorktree: issuePrefersGitWorktree(bootIssue),
  };

  state.job = {
    project_id: targetProjectId,
    issue_id: issueId,
  } as Job;

  const { workPath, branchName } = prepareAdwWorkingCopy(
    state.adwId,
    adwConfig,
    state.useGitWorktree !== false ? "git_worktree" : "in_repo",
  );

  const promptPath = copyPromptToWorktree(prompt, workPath, adwId);

  state.promptPath = promptPath;
  state.workPath = workPath;
  state.branchName = branchName;

  await updateJob(jobId, {
    adw_id: state.adwId,
    status: "running",
    process_id: state.pid ?? null,
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

  await persistAdwState(state);

  logStepProgress(
    state.adwId,
    path.join(ADW_PROJECT_ROOT, "state", state.adwId),
    "🚀 Starting workflow (from queued job)",
    {
      adwId: state.adwId,
      jobDbId: jobId,
      step: state.currentStep,
      workPath: state.workPath,
      branch: state.branchName,
    },
  );
  return { state, adwConfig };
}

async function startADW(
  args: Args,
): Promise<{ state: WorkflowState; adwConfig: ResolvedAdwConfig }> {
  const issueId = args.issueId;
  // If both --issue-id and --prompt are present, issue wins.
  let prompt = "";

  if (issueId != null) {
    try {
      const adwId = generateAdwId();
      const projectId = args.projectId!;
      const issue = await bootstrapIssueForNewAdw(issueId, adwId, projectId);
      prompt = issue.description;
      logger.logMessage(
        `Bootstrapped issue for new ADW: ${adwId} with prompt: ${prompt}`,
      );
      const targetProjectId = projectId;
      const project = await loadProjectById(targetProjectId);
      const adwConfig = resolveAdwConfig(project);

      const state: WorkflowState = {
        currentStep: "await_plan",
        status: "running",
        adwId,
        prompt,
        testRetries: 0,
        pid: process.pid,
        workPath: "",
        branchName: "",
        issueId,
        issueClass: deriveIssueClassFromIssue(issue),
        useGitWorktree: issuePrefersGitWorktree(issue),
      };

      state.job = {
        project_id: targetProjectId,
        issue_id: issueId,
      } as Job;

      const { workPath, branchName } = prepareAdwWorkingCopy(
        state.adwId,
        adwConfig,
        state.useGitWorktree !== false ? "git_worktree" : "in_repo",
      );

      const promptPath = copyPromptToWorktree(prompt, workPath, adwId);

      state.promptPath = promptPath;
      state.workPath = workPath;
      state.branchName = branchName;

      await persistAdwState(state);

      logStepProgress(
        state.adwId,
        path.join(ADW_PROJECT_ROOT, "state", state.adwId),
        "🚀 Starting workflow",
        {
          adwId: state.adwId,
          step: state.currentStep,
          workPath: state.workPath,
          branch: state.branchName,
        },
      );
      return { state, adwConfig };
    } catch (e) {
      logger.logError(
        `Error bootstrapping issue for new ADW: ${e instanceof Error ? e.message : e}`,
      );
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  prompt = args.prompt?.trim() ?? "";
  if (!prompt) {
    console.error("Provide --prompt <text> when not using --issue-id");
    process.exit(1);
  }

  const adwId = generateAdwId();
  const targetProjectId = args.projectId ?? parseEnvProjectId() ?? 1;
  const project = await loadProjectById(targetProjectId);
  const adwConfig = resolveAdwConfig(project);

  const state: WorkflowState = {
    currentStep: "await_plan",
    status: "running",
    adwId,
    prompt,
    testRetries: 0,
    pid: process.pid,
    workPath: "",
    branchName: "",
    issueClass: "feature" as IssueClass,
    useGitWorktree: true,
  };

  state.job = { project_id: targetProjectId, issue_id: null } as Job;

  const { workPath, branchName } = prepareAdwWorkingCopy(
    state.adwId,
    adwConfig,
    "git_worktree",
  );

  const promptPath = copyPromptToWorktree(prompt, workPath, adwId);

  state.promptPath = promptPath;
  state.workPath = workPath;
  state.branchName = branchName;

  await persistAdwState(state);

  logStepProgress(
    state.adwId,
    path.join(ADW_PROJECT_ROOT, "state", state.adwId),
    "🚀 Starting workflow",
    {
      adwId: state.adwId,
      step: state.currentStep,
      workPath: state.workPath,
      branch: state.branchName,
    },
  );
  return { state, adwConfig };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  validateCliArgs(args);
  const repoRoot = ADW_PROJECT_ROOT;

  let state: WorkflowState;
  let adwConfig: ResolvedAdwConfig;

  if (args.jobId != null && args.jobId !== "") {
    const started = await startFromJobRow(args);
    state = started.state;
    adwConfig = started.adwConfig;
  } else if (args.resume) {
    const saved = await resumeADW(args);
    if (!saved) {
      console.error(`No state found for adw-id=${args.adwId}`);
      process.exit(1);
    }
    state = saved.state;
    adwConfig = saved.adwConfig;
  } else {
    const started = await startADW(args);
    state = started.state;
    adwConfig = started.adwConfig;
  }

  currentAwdId = state.adwId;

  const stateDir = getStateDir(state.adwId);

  while (state.currentStep !== "report") {
    state.job = await createJobForWorkflowStep(state);
    await persistAdwState(state);

    const runnerCtx: RunnerContext = {
      step: state.currentStep as InstructionStep,
      workPath: state.workPath,
      repoRoot,
      adwId: state.adwId,
      state,
      appRepoRoot: adwConfig.repoRoot,
      adwConfig,
    };
    const params: StepHandlerParams = {
      args,
      state,
      runnerCtx,
      stateDir,
      repoRoot,
    };

    let outcome: StepOutcome;
    switch (state.currentStep) {
      case "await_plan":
        outcome = await new Planner(adwConfig).plan(params);
        break;
      case "await_implement":
        outcome = await new Implementer(adwConfig).implement(params);
        break;
      case "await_test":
        outcome = await new Tester(adwConfig).test(params);
        break;
      case "await_pr":
        outcome = await new PullRequestAgent(adwConfig).pullRequest(params);
        break;
      case "await_review":
        outcome = await new Reviewer(adwConfig).review(params);
        break;
      default:
        outcome = { kind: "continue" };
    }

    if (outcome.kind === "retry") {
      await persistAdwState(state);
      if (state.issueId != null) {
        await addIssueAdwRetryComment(
          state.issueId,
          state.currentStep,
          outcome.retryCount,
        );
      }
      logStepProgress(
        state.adwId,
        stateDir,
        "🔄 Step: test - running tests (retry)",
        {
          retry: `${outcome.retryCount + 1}/${MAX_TEST_RETRIES}`,
        },
      );
    }

    if (outcome.kind === "emit") {
      state.status = "stopped";
      if (state.issueId != null) {
        await notifyIssueAdwPaused(state.issueId, outcome.title);
      }
      await persistAdwState(state);
      return;
    }
    if (outcome.kind === "exit") {
      state.status = "stopped";
      await persistAdwState(state);
      if (state.issueId != null) {
        await markIssueAdwError(
          state.issueId,
          outcome.issueError ?? defaultExitIssueError(state),
        );
      }
      if (outcome.report) {
        printReport(repoRoot, state, adwConfig);
      }
      return;
    }
  }

  logStepProgress(
    state.adwId,
    path.join(repoRoot, "state", state.adwId),
    "🏁 Workflow complete - report",
    {
      adwId: state.adwId,
      branch: state.branchName,
      prUrl: state.prUrl,
    },
  );
  printReport(repoRoot, state, adwConfig);
  state.status = "stopped";
  await persistAdwState(state);
  if (state.issueId != null) {
    await markIssueAdwCompleted(state.issueId, state.adwId);
  }
}

function printReport(
  _repoRoot: string,
  state: WorkflowState,
  adwConfig: ResolvedAdwConfig,
): void {
  const baseRef = adwConfig.baseBranchRef;
  console.log("\n--- Report ---");
  console.log("Branch:", state.branchName);
  console.log("Working directory:", state.workPath);
  console.log("PR URL:", state.prUrl ?? "N/A");
  try {
    const stat = execSync(`git diff ${baseRef} --stat`, {
      encoding: "utf8",
      cwd: state.workPath,
    });
    console.log(`Diff (${baseRef}):\n` + stat);
  } catch {
    console.log("(git diff not run or failed)");
  }
}

run().catch(async (e) => {
  console.error(e);
  const id = currentAwdId;
  if (id) {
    const st = loadState(id, ADW_PROJECT_ROOT);
    if (st?.issueId != null) {
      try {
        await markIssueAdwError(
          st.issueId,
          e instanceof Error ? e.message : String(e),
        );
      } catch (err) {
        console.error(err);
      }
    }
  }
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("SIGINT received");
  if (!currentAwdId) {
    console.error("No active ADW (adw id not set yet)");
    process.exit(1);
  }
  const state = loadState(currentAwdId, ADW_PROJECT_ROOT);
  if (!state) {
    console.error(`No state found for adw-id=${currentAwdId}`);
    process.exit(1);
  }
  state.status = "stopped";
  void persistAdwState(state)
    .then(async () => {
      if (state.issueId != null) {
        await markIssueAdwCancelled(state.issueId);
      }
      logStepProgress(
        state.adwId,
        getStateDir(state.adwId),
        "🛑 Workflow interrupted",
        {
          adwId: currentAwdId!,
          currentStep: state.currentStep,
          workPath: state.workPath,
        },
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
});
