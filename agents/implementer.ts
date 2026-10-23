import {
  logStepProgress,
  saveState,
  type StepHandlerParams,
  type StepOutcome,
} from "../utils/workflow-state.js";
import { safeCommit } from "../utils/step-helpers.js";
import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import Agent from "./agent.js";

export class Implementer extends Agent {
  constructor(adwConfig: ResolvedAdwConfig) {
    super("implementer", adwConfig);
  }

  async implement(p: StepHandlerParams): Promise<StepOutcome> {
    return this.executeStep(p, async () => {
      const { state, runnerCtx, stateDir: _stateDir, repoRoot } = p;
      const { adwId, workPath } = runnerCtx;

      logStepProgress(
        adwId,
        _stateDir,
        "🔨 Step: implement - implementing plan",
        {
          planPath: state.planPath,
        },
      );
      const implResult = await this.run(runnerCtx);

      if (implResult === null) {
        return {
          kind: "exit",
          issueError: "Implement step failed or provider returned no output.",
        };
      }
      safeCommit(workPath, "feat(scope): implement plan");
      state.currentStep = "await_test";
      state.implementationSummaryPath = implResult.stdout.trim();

      await saveState(state);
      logStepProgress(adwId, _stateDir, "✅ Step done: implement → test", {
        workPath,
      });
      return { kind: "continue" };
    });
  }
}
