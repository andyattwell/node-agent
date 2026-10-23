export const ADW_STEPS = [
  "await_plan",
  "await_implement",
  "await_test",
  "await_pr",
  "await_review",
  "report",
];

export const ADW_STEPS_DESCRIPTIONS = {
  await_plan: "Plan the implementation",
  await_implement: "Implement the feature",
  await_test: "Test the implementation",
  await_pr: "Create a pull request",
  await_review: "Review the pull request",
  report: "Done",
};
export const ADW_STEPS_Files = {
  await_plan: ["prompt.md", "output.json", "plan.md"],
  await_implement: ["prompt.md", "output.json", "summary.md"],
  await_test: ["prompt.md", "output.json", "results.json"],
  await_pr: ["prompt.md", "output.json", "pr_description.md"],
  await_review: ["result.json"],
  report: [],
};
