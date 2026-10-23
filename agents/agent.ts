import {
  AIProvider,
  getConfiguredProvider,
  InstructionResult,
  InstructionStep,
} from "../providers/index.js";
import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import { updateJobFromState } from "../utils/job-db.js";
import type {
  StepHandlerParams,
  StepOutcome,
} from "../utils/workflow-state.js";
import type { WorkflowState } from "../utils/workflow-state.js";

export interface RunnerContext {
  step: InstructionStep;
  workPath: string;
  repoRoot: string;
  adwId: string;
  state: WorkflowState;
  appRepoRoot: string;
  adwConfig: ResolvedAdwConfig;
}

class Agent {
  private provider: AIProvider;
  constructor(
    public name: string,
    adwConfig: ResolvedAdwConfig,
  ) {
    const provider = getConfiguredProvider(adwConfig);
    if (!provider) {
      throw new Error("No provider configured");
    }
    this.provider = provider;
  }

  async run(ctx: RunnerContext): Promise<InstructionResult | null> {
    return await this.provider.run(ctx);
  }

  /**
   * Runs a workflow step with {@link updateJobFromState} at start and in `finally`
   * so the job row reflects the step boundary even when {@link saveState} is not called.
   */
  protected async executeStep(
    p: StepHandlerParams,
    work: () => Promise<StepOutcome>,
  ): Promise<StepOutcome> {
    await updateJobFromState(p.state);
    try {
      return await work();
    } finally {
      await updateJobFromState({
        ...p.state,
        status: "done",
      });
    }
  }
}

export default Agent;
