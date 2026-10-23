import { config } from "dotenv";
import { getConfiguredProvider } from "./providers/index.js";
import { resolveAdwConfig } from "./utils/adw-config.js";
config();

async function executeStepOrEmit() {
  const provider = getConfiguredProvider(resolveAdwConfig(null));
  if (!provider) {
    console.error("No provider configured");
    return;
  }

  const result = await provider.run({
    step: "plan",
    workPath: ".",
    adwId: "run_test",
    repoRoot: ".",
    state: {
      currentStep: "await_plan",
      workPath: ".",
      branchName: "test",
      adwId: "run_test",
      prompt: "test",
      testRetries: 0,
    },
  });
  console.log(result);
}

executeStepOrEmit();
