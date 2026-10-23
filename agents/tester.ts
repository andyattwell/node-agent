import path from "node:path";
import {
  logStepError,
  logStepProgress,
  saveState,
  type StepHandlerParams,
  type StepOutcome,
} from "../utils/workflow-state.js";
import { checkTestResults, MAX_TEST_RETRIES } from "../utils/step-helpers.js";
import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import Agent from "./agent.js";

export class Tester extends Agent {
  constructor(adwConfig: ResolvedAdwConfig) {
    super("tester", adwConfig);
  }

  async test(p: StepHandlerParams): Promise<StepOutcome> {
    return this.executeStep(p, async () => {
      const { state, runnerCtx, stateDir: _stateDir, repoRoot } = p;
      const { adwId } = runnerCtx;

      logStepProgress(adwId, _stateDir, "🧪 Step: test - running tests", {
        retry:
          state.testRetries > 0
            ? `${state.testRetries}/${MAX_TEST_RETRIES}`
            : undefined,
      });
      const testResultPath = path.join(_stateDir, "test", "results.json");
      state.testResultsPath = testResultPath;
      let passed = checkTestResults(testResultPath);
      if (!passed) {
        const testResult = await this.run(runnerCtx);

        if (testResult === null || testResult.exitCode !== 0) {
          logStepError(
            adwId,
            _stateDir,
            "test",
            testResult?.stderr.slice(0, 300) ?? "",
          );
          return {
            kind: "exit",
            issueError:
              testResult?.stderr.slice(0, 500) ?? "Test step failed to run.",
          };
        }
        passed = checkTestResults(testResult.stdout);
      }
      if (!passed) {
        state.testRetries += 1;

        await saveState(state);
        if (state.testRetries >= MAX_TEST_RETRIES) {
          state.currentStep = "report";
          await saveState(state);
          logStepProgress(
            adwId,
            _stateDir,
            "⚠️ Step done: test → report (max retries)",
            {
              result: "fail",
            },
          );
          logStepError(
            adwId,
            _stateDir,
            "test",
            `❌ Test failure after ${MAX_TEST_RETRIES} attempts\n\n.`,
          );
          return {
            kind: "exit",
            report: true,
            issueError: `Tests failed after ${MAX_TEST_RETRIES} attempts.`,
          };
        }
        return {
          kind: "retry",
          retryCount: state.testRetries,
        };
      }
      state.currentStep = "await_pr";
      await saveState(state);
      logStepProgress(adwId, _stateDir, "✅ Step done: test → pull_request", {
        result: "pass",
      });
      return { kind: "continue" };
    });
  }
}
