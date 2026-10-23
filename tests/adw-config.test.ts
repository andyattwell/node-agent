import { describe, expect, it } from "vitest";
import {
  normalizeBaseBranchRef,
  parseProjectCredentialsRaw,
  refToShortBranchForClone,
  resolveAdwConfig,
} from "../utils/adw-config.js";
import { Project as ProjectEntity } from "../utils/entities/Project.js";

describe("normalizeBaseBranchRef", () => {
  it("defaults empty to origin/main", () => {
    expect(normalizeBaseBranchRef(null)).toBe("origin/main");
    expect(normalizeBaseBranchRef("")).toBe("origin/main");
  });

  it("prefixes bare branch names with origin/", () => {
    expect(normalizeBaseBranchRef("main")).toBe("origin/main");
    expect(normalizeBaseBranchRef("develop")).toBe("origin/develop");
  });

  it("leaves remote refs unchanged", () => {
    expect(normalizeBaseBranchRef("origin/main")).toBe("origin/main");
    expect(normalizeBaseBranchRef("custom/remote/foo")).toBe(
      "custom/remote/foo",
    );
  });
});

describe("refToShortBranchForClone", () => {
  it("strips origin/", () => {
    expect(refToShortBranchForClone("origin/main")).toBe("main");
  });
});

describe("parseProjectCredentialsRaw", () => {
  it("returns empty for null", () => {
    expect(parseProjectCredentialsRaw(null)).toEqual({});
  });

  it("maps plain text to githubToken", () => {
    expect(parseProjectCredentialsRaw("ghp_secret")).toEqual({
      githubToken: "ghp_secret",
    });
  });

  it("parses JSON keys", () => {
    expect(
      parseProjectCredentialsRaw(
        JSON.stringify({
          GITHUB_TOKEN: "t",
          BITBUCKET_ACCESS_TOKEN: "b",
        }),
      ),
    ).toEqual({
      githubToken: "t",
      githubAccessToken: "",
      bitbucketAccessToken: "b",
      bitbucketWorkspace: "",
      bitbucketRepoSlug: "",
    });
  });
});

describe("resolveAdwConfig", () => {
  it("merges env when project is null", () => {
    const orig = { ...process.env };
    process.env.ADW_BASE_BRANCH = "origin/develop";
    process.env.ADW_APP_REPO_URL = "https://github.com/a/b";
    const cfg = resolveAdwConfig(null);
    expect(cfg.baseBranchRef).toBe("origin/develop");
    expect(cfg.appRepoUrl).toBe("https://github.com/a/b");
    process.env.ADW_BASE_BRANCH = orig.ADW_BASE_BRANCH;
    process.env.ADW_APP_REPO_URL = orig.ADW_APP_REPO_URL;
  });

  it("overrides with project fields", () => {
    const p = {
      repository: "https://github.com/org/app",
      base_branch: "staging",
      credentials: null,
      ai_provider: "cursor",
      ai_path: "/usr/bin/cursor-cli",
      ai_model: "gpt-4",
    } as ProjectEntity;
    const cfg = resolveAdwConfig(p);
    expect(cfg.appRepoUrl).toBe("https://github.com/org/app");
    expect(cfg.baseBranchRef).toBe("origin/staging");
    expect(cfg.aiProvider).toBe("cursor");
    expect(cfg.aiPath).toBe("/usr/bin/cursor-cli");
    expect(cfg.aiModel).toBe("gpt-4");
  });

  it("accepts gemini as project ai_provider", () => {
    const p = {
      repository: "https://github.com/org/app",
      base_branch: "main",
      credentials: null,
      ai_provider: "gemini",
      ai_path: "",
      ai_model: "gemini-2.5-flash",
    } as ProjectEntity;
    const cfg = resolveAdwConfig(p);
    expect(cfg.aiProvider).toBe("gemini");
    expect(cfg.aiModel).toBe("gemini-2.5-flash");
  });
});
