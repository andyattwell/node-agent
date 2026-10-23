import path from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_COMMANDS } from "../utils/agent-commands.js";

describe("agent-commands", () => {
  it("AGENT_COMMANDS has implement, test, pr, review, fix_review, report under commands", () => {
    expect(AGENT_COMMANDS.implement).toBe("commands/implement.md");
    expect(AGENT_COMMANDS.test).toBe("commands/test.md");
    expect(AGENT_COMMANDS.pr).toBe("commands/pr.md");
    expect(AGENT_COMMANDS.review).toBe("commands/review.md");
    expect(AGENT_COMMANDS.fix_review).toBe("commands/fix_review.md");
    expect(AGENT_COMMANDS.report).toBe("commands/report.md");
  });
});
