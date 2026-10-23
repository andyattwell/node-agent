import { describe, expect, it } from "vitest";
import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import { resolveGitRemoteUrl } from "../utils/git.js";

const emptyCreds: ResolvedAdwConfig["repoCredentials"] = {
  githubToken: "",
  githubAccessToken: "",
  bitbucketAccessToken: "",
  bitbucketWorkspace: "",
  bitbucketRepoSlug: "",
};

function cfg(partial: Partial<ResolvedAdwConfig>): ResolvedAdwConfig {
  return {
    repoRoot: "/r",
    appRepoUrl: "https://github.com/o/r.git",
    baseBranchRef: "origin/main",
    githubOwner: null,
    githubRepo: null,
    repoCredentials: { ...emptyCreds },
    aiProvider: "none",
    aiPath: "",
    aiModel: "",
    ...partial,
  };
}

describe("resolveGitRemoteUrl", () => {
  it("returns plain URL when no credentials", () => {
    expect(resolveGitRemoteUrl(cfg({}))).toBe("https://github.com/o/r.git");
  });

  it("does not alter URL that already has userinfo", () => {
    const url = "https://user:pass@github.com/o/r.git";
    expect(
      resolveGitRemoteUrl(
        cfg({
          appRepoUrl: url,
          repoCredentials: { ...emptyCreds, githubToken: "ghp_x" },
        }),
      ),
    ).toBe(url);
  });

  it("embeds GitHub PAT for https github.com", () => {
    const u = resolveGitRemoteUrl(
      cfg({
        repoCredentials: { ...emptyCreds, githubToken: "ghp_abcd" },
      }),
    );
    expect(u.startsWith("https://")).toBe(true);
    expect(u).toContain("github.com");
    expect(u).toContain("x-access-token");
    expect(u).toContain(encodeURIComponent("ghp_abcd"));
  });

  it("converts git@github.com to https with token", () => {
    expect(
      resolveGitRemoteUrl(
        cfg({
          appRepoUrl: "git@github.com:acme/widget.git",
          repoCredentials: { ...emptyCreds, githubToken: "tok" },
        }),
      ),
    ).toBe("https://x-access-token:tok@github.com/acme/widget.git");
  });

  it("embeds Bitbucket token for bitbucket.org", () => {
    const u = resolveGitRemoteUrl(
      cfg({
        appRepoUrl: "https://bitbucket.org/w/s.git",
        repoCredentials: { ...emptyCreds, bitbucketAccessToken: "bb_tok" },
      }),
    );
    expect(u).toContain("bitbucket.org");
    expect(u).toContain("x-token-auth");
    expect(u).toContain(encodeURIComponent("bb_tok"));
  });
});
