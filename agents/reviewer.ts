import fs from "node:fs";
import path from "node:path";
import { pushWork } from "../utils/git.js";
import { addPullRequestComments } from "../utils/remote-pr.js";
import {
  executeStepOrEmit,
  logStepError,
  logStepProgress,
  saveState,
  type StepHandlerParams,
  type StepOutcome,
} from "../utils/workflow-state.js";
import { MAX_REVIEW_RETRIES, safeCommit } from "../utils/step-helpers.js";
import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import Agent from "./agent.js";

export class Reviewer extends Agent {
  constructor(adwConfig: ResolvedAdwConfig) {
    super("reviewer", adwConfig);
  }

  async review(p: StepHandlerParams): Promise<StepOutcome> {
    return this.executeStep(p, async () => {
      const { state, runnerCtx, stateDir: _stateDir, repoRoot } = p;
      const { adwId, workPath, adwConfig } = runnerCtx;
      const reviewResultPath = path.join(_stateDir, "review_result.json");
      const reviewRetries = state.reviewRetries ?? 0;

      if (!fs.existsSync(reviewResultPath)) {
        logStepProgress(
          adwId,
          _stateDir,
          "🔍 Step: review - reviewing pull request",
          {
            prUrl: state.prUrl,
            retry:
              reviewRetries > 0
                ? `${reviewRetries}/${MAX_REVIEW_RETRIES}`
                : undefined,
          },
        );
        const codeReviewResult = await this.run(runnerCtx);
        if (codeReviewResult === null) {
          return {
            kind: "exit",
            issueError:
              "Code review step failed or provider returned no output.",
          };
        }
      }

      let reviewResult: {
        approved?: boolean;
        comments?: Array<{ body: string; path?: string; line?: number }>;
      };
      try {
        reviewResult = JSON.parse(fs.readFileSync(reviewResultPath, "utf8"));
      } catch {
        logStepError(
          adwId,
          _stateDir,
          "review",
          "❌ Invalid review_result.json, re-running review.",
        );
        fs.unlinkSync(reviewResultPath);
        return { kind: "continue" };
      }

      const approved = reviewResult.approved === true;

      if (approved) {
        await addPullRequestComments(
          state.prId!,
          [{ body: "LGTM 👍" }],
          adwConfig,
        );
        state.currentStep = "report";

        await saveState(state);
        logStepProgress(
          adwId,
          _stateDir,
          "✅ Step done: review → report (merged)",
          {
            prUrl: state.prUrl,
          },
        );
        return { kind: "continue" };
      }

      const comments = reviewResult.comments ?? [];
      if (state.prId != null && comments.length > 0) {
        try {
          await addPullRequestComments(state.prId, comments, adwConfig);
          logStepProgress(
            adwId,
            _stateDir,
            "💬 Comment icon: Posted review comments on PR",
            {
              count: comments.length,
              prUrl: state.prUrl,
            },
          );
        } catch (error) {
          logStepError(
            adwId,
            _stateDir,
            "pr",
            `❌ Failed to post PR comments: ${(error as Error).message}`,
          );
        }
      }

      if (reviewRetries >= MAX_REVIEW_RETRIES) {
        state.currentStep = "report";

        await saveState(state);
        logStepProgress(
          adwId,
          _stateDir,
          "⚠️ Step done: review → report (max retries, no review comments)",
          {
            prUrl: state.prUrl,
          },
        );
        return { kind: "continue" };
      }

      logStepProgress(
        adwId,
        _stateDir,
        "🔍 Step: fix_review - applying review feedback",
        {
          retry: `${reviewRetries + 1}/${MAX_REVIEW_RETRIES}`,
          prUrl: state.prUrl,
        },
      );
      const fixReviewInstruction = {
        title: "Run Fix Review",
        body: `Run the command: commands/fix_review.md\nThen resume: npm run dev -- --resume --adw-id=${adwId}`,
      };
      if (
        (await executeStepOrEmit(
          runnerCtx,
          "fix_review",
          fixReviewInstruction,
        )) === null
      ) {
        logStepError(
          adwId,
          _stateDir,
          "fix_review",
          "❌ Failed to run fix review.",
        );
        return { kind: "exit", issueError: "Failed to run fix review." };
      }

      logStepProgress(
        adwId,
        _stateDir,
        "✅ Step done: fix_review → re-review",
        {
          reviewRetries: state.reviewRetries ?? 0,
          prUrl: state.prUrl,
        },
      );

      if (!safeCommit(workPath, "fix(review): address review comments")) {
        logStepProgress(
          adwId,
          _stateDir,
          "No changes to commit after fix_review",
        );
      }

      logStepProgress(adwId, _stateDir, "🔍 Step: push_work - pushing", {
        branch: state.branchName,
        workPath,
      });
      try {
        pushWork(workPath, state.branchName);
      } catch (error) {
        logStepError(
          adwId,
          _stateDir,
          "fix_review",
          `❌ Failed to push: ${(error as Error).message}`,
        );
        return {
          kind: "emit",
          title: "Push branch",
          body: `Push the branch manually: cd ${workPath} && git push origin ${state.branchName}\nThen resume: npm run dev -- --resume --adw-id=${adwId}`,
        };
      }
      fs.unlinkSync(reviewResultPath);
      state.reviewRetries = reviewRetries + 1;

      await saveState(state);
      logStepProgress(
        adwId,
        _stateDir,
        "✅ Step done: fix_review → re-review",
        {
          reviewRetries: state.reviewRetries ?? 0,
          prUrl: state.prUrl,
          branch: state.branchName,
          workPath,
        },
      );
      return { kind: "continue" };
    });
  }
}
