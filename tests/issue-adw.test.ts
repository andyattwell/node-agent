import { describe, expect, it } from "vitest";
import {
  mapEnteringWorkflowStepToIssueStatus,
  truncateForComment,
} from "../utils/issue-adw.js";

describe("mapEnteringWorkflowStepToIssueStatus", () => {
  it("maps workflow phases to issue statuses", () => {
    expect(mapEnteringWorkflowStepToIssueStatus("await_plan")).toBe("planning");
    expect(mapEnteringWorkflowStepToIssueStatus("await_implement")).toBe(
      "implementing",
    );
    expect(mapEnteringWorkflowStepToIssueStatus("await_test")).toBe("testing");
    expect(mapEnteringWorkflowStepToIssueStatus("await_pr")).toBe("pr");
    expect(mapEnteringWorkflowStepToIssueStatus("await_review")).toBe(
      "reviewing",
    );
  });

  it("returns null for report and unknown", () => {
    expect(mapEnteringWorkflowStepToIssueStatus("report")).toBeNull();
    expect(mapEnteringWorkflowStepToIssueStatus("run_test")).toBeNull();
  });
});

describe("truncateForComment", () => {
  it("truncates long text", () => {
    const long = "x".repeat(2500);
    const out = truncateForComment(long, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out).toContain("truncated");
  });
});
