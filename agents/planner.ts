import path from "node:path";
import {
  logStepProgress,
  saveState,
  type StepHandlerParams,
  type StepOutcome,
} from "../utils/workflow-state.js";
import { ensurePlanInWorktree, safeCommit } from "../utils/step-helpers.js";
import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import Agent from "./agent.js";

export class Planner extends Agent {
  constructor(adwConfig: ResolvedAdwConfig) {
    super("planner", adwConfig);
  }

  async plan(p: StepHandlerParams): Promise<StepOutcome> {
    return this.executeStep(p, async () => {
      const { state, runnerCtx, stateDir: _stateDir, repoRoot } = p;
      const { adwId, workPath } = runnerCtx;

      logStepProgress(
        adwId,
        _stateDir,
        "📝 Step: plan - generating implementation plan",
        {
          issueClass: state.issueClass,
        },
      );
      const planResult = await this.run(runnerCtx);
      if (planResult === null) {
        return {
          kind: "exit",
          issueError: "Plan step failed or provider returned no output.",
        };
      }
      const planPathFromStep = planResult.stdout.trim();
      state.planPath = ensurePlanInWorktree(
        adwId,
        planPathFromStep,
        workPath,
        runnerCtx.appRepoRoot,
      );
      const relPlan = path.relative(workPath, state.planPath);
      if (!relPlan.startsWith("..")) {
        safeCommit(workPath, "docs(plan): add implementation plan", [
          "docs/features",
        ]);
      }
      state.currentStep = "await_implement";

      await saveState(state);
      logStepProgress(adwId, _stateDir, "✅ Step done: plan → implement", {
        planPath: state.planPath,
        relativePlan: relPlan,
      });
      return { kind: "continue" };
    });
  }
}
