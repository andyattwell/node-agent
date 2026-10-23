import path from "node:path";
import { getPrTitleAndDescription } from "../utils/git.js";
import { createPullRequest, getPrUrl } from "../utils/remote-pr.js";
import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import {
  logStepError,
  logStepProgress,
  saveState,
  type StepHandlerParams,
  type StepOutcome,
} from "../utils/workflow-state.js";
import Agent from "./agent.js";

export class PullRequestAgent extends Agent {
  constructor(adwConfig: ResolvedAdwConfig) {
    super("pull_request", adwConfig);
  }

  async pullRequest(p: StepHandlerParams): Promise<StepOutcome> {
    return this.executeStep(p, async () => {
      const { state, runnerCtx, stateDir: _stateDir, repoRoot } = p;
      const { adwId, adwConfig } = runnerCtx;

      logStepProgress(adwId, _stateDir, "🔗 Step: pull_request - creating PR");
      if (!state.prUrl) {
        const prDescriptionPath = path.join(
          _stateDir,
          "pull_request",
          "pr_description.md",
        );
        let prTitleAndDescription = getPrTitleAndDescription(prDescriptionPath);
        if (!prTitleAndDescription) {
          const prStepResult = await this.run(runnerCtx);
          if (prStepResult === null) {
            logStepError(
              adwId,
              _stateDir,
              "pr",
              "❌ Failed to create pull request.",
            );
            return {
              kind: "exit",
              issueError: "Failed to create pull request (provider step).",
            };
          }
          prTitleAndDescription = getPrTitleAndDescription(prDescriptionPath);
          if (!prTitleAndDescription) {
            logStepError(
              adwId,
              _stateDir,
              "pr",
              "❌ Failed to generate pull request title and description.",
            );
            return {
              kind: "exit",
              issueError:
                "Failed to generate pull request title and description.",
            };
          }
        }

        logStepProgress(
          adwId,
          _stateDir,
          "🔗 Step: pull_request - creating PR",
          {
            prTitleAndDescription: prTitleAndDescription?.title ?? "",
            prDescription: prTitleAndDescription?.description ?? "",
            sourceBranch: state.branchName,
            destinationBranch: adwConfig.baseBranchRef,
            draft: "true",
          },
        );

        try {
          const pr = await createPullRequest(
            {
              title: prTitleAndDescription?.title ?? "",
              description: prTitleAndDescription?.description ?? "",
              sourceBranch: state.branchName,
              destinationBranch: adwConfig.baseBranchRef,
              draft: true,
            },
            adwConfig,
          );

          state.prUrl = pr.html_url ?? getPrUrl(pr.id, adwConfig);
          state.prId = pr.id;
          state.reviewRetries = 0;
          state.currentStep = "await_review";

          await saveState(state);
          logStepProgress(
            adwId,
            _stateDir,
            "✅ Step done: pull_request → review",
            {
              prUrl: state.prUrl,
              prId: state.prId,
              reviewRetries: 0,
            },
          );
        } catch (error) {
          logStepError(
            adwId,
            _stateDir,
            "pr",
            `❌ Failed to create pull request: ${(error as Error).message}`,
          );
          return {
            kind: "exit",
            issueError: `Failed to create pull request: ${(error as Error).message}`,
          };
        }
        return { kind: "continue" };
      }

      return {
        kind: "emit",
        title: "Create Pull Request",
        body: "Run the command: commands/pr.md\n",
      };
    });
  }
}
