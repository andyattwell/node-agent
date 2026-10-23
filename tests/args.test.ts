import { describe, expect, it } from "vitest";
import { parseArgs } from "../utils/args.js";

describe("parseArgs", () => {
  it("defaults resume to false", () => {
    expect(parseArgs([]).resume).toBe(false);
    expect(parseArgs(["--prompt", "x"]).resume).toBe(false);
  });

  it("parses --resume", () => {
    expect(parseArgs(["--resume"]).resume).toBe(true);
  });

  it("parses --prompt", () => {
    expect(parseArgs(["--prompt", "feat: add X"]).prompt).toBe("feat: add X");
  });

  it("parses --adw-id as next arg", () => {
    expect(parseArgs(["--adw-id", "my-id"]).adwId).toBe("my-id");
  });

  it("parses --adw-id=value", () => {
    expect(parseArgs(["--adw-id=my-id"]).adwId).toBe("my-id");
  });

  it("parses --issue-id as next arg", () => {
    expect(parseArgs(["--issue-id", "42"]).issueId).toBe(42);
  });

  it("parses --issue-id=value", () => {
    expect(parseArgs(["--issue-id=7"]).issueId).toBe(7);
  });

  it("ignores invalid --issue-id", () => {
    expect(parseArgs(["--issue-id", "0"]).issueId).toBeUndefined();
    expect(parseArgs(["--issue-id", "nope"]).issueId).toBeUndefined();
  });

  it("parses --job-id as next arg", () => {
    expect(parseArgs(["--job-id", "99"]).jobId).toBe("99");
  });

  it("parses --job-id=value", () => {
    expect(parseArgs(["--job-id=100"]).jobId).toBe("100");
  });

  it("combines resume and adw-id", () => {
    const args = parseArgs(["--resume", "--adw-id=abc"]);
    expect(args.resume).toBe(true);
    expect(args.adwId).toBe("abc");
  });

  it("combines job-id and issue-id", () => {
    const args = parseArgs(["--job-id", "5", "--issue-id", "12"]);
    expect(args.jobId).toBe("5");
    expect(args.issueId).toBe(12);
  });

  it("parses --project-id as next arg", () => {
    expect(parseArgs(["--project-id", "3"]).projectId).toBe(3);
  });

  it("parses --project-id=value", () => {
    expect(parseArgs(["--project-id=2"]).projectId).toBe(2);
  });

  it("ignores invalid --project-id", () => {
    expect(parseArgs(["--project-id", "0"]).projectId).toBeUndefined();
  });
});
