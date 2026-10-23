import fs from "node:fs";

function checkTestResults(testResultPath: string): boolean {
  try {
    const testResults = JSON.parse(fs.readFileSync(testResultPath, "utf8"));
    if (!Array.isArray(testResults)) {
      return testResults?.status === "passed";
    }
    return testResults.every((result: any) => result.status === "passed");
  } catch (error) {
    return false;
  }
}

console.log(
  checkTestResults(
    "/home/andy/Projects/node-agent/state/692d116d/test-results.json",
  ),
);
