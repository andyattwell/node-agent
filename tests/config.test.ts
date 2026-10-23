import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAppRepoUrl,
  getGitHubOwnerRepo,
  getGitHubToken,
  getRemoteHost,
} from "../utils/git.js";
import {
  getProviderName,
  getADWCliPath,
  parseChatProviderOverride,
  sanitizeChatModelOverride,
  MAX_CHAT_MODEL_OVERRIDE_LEN,
} from "../providers/utils/provider-common.js";

const ENV = process.env;

describe("config", () => {
  beforeEach(() => {
    process.env = { ...ENV };
  });

  afterEach(() => {
    process.env = ENV;
  });

  describe("getProviderName", () => {
    it("returns none when ADW_AI_PROVIDER is unset", () => {
      delete process.env.ADW_AI_PROVIDER;
      expect(getProviderName()).toBe("none");
    });

    it("returns none when ADW_AI_PROVIDER is empty", () => {
      process.env.ADW_AI_PROVIDER = "";
      expect(getProviderName()).toBe("none");
    });

    it("returns cursor when ADW_AI_PROVIDER is cursor", () => {
      process.env.ADW_AI_PROVIDER = "cursor";
      expect(getProviderName()).toBe("cursor");
    });

    it("returns cursor when ADW_AI_PROVIDER is CURSOR (case insensitive)", () => {
      process.env.ADW_AI_PROVIDER = "CURSOR";
      expect(getProviderName()).toBe("cursor");
    });

    it("returns none for unknown value", () => {
      process.env.ADW_AI_PROVIDER = "unknown";
      expect(getProviderName()).toBe("none");
    });

    it("returns llama_cpp when ADW_AI_PROVIDER is llama_cpp", () => {
      process.env.ADW_AI_PROVIDER = "llama_cpp";
      expect(getProviderName()).toBe("llama_cpp");
    });

    it("returns llama_cpp when ADW_AI_PROVIDER is llamacpp", () => {
      process.env.ADW_AI_PROVIDER = "llamacpp";
      expect(getProviderName()).toBe("llama_cpp");
    });

    it("returns gemini when ADW_AI_PROVIDER is gemini", () => {
      process.env.ADW_AI_PROVIDER = "gemini";
      expect(getProviderName()).toBe("gemini");
    });

    it("returns gemini when ADW_AI_PROVIDER is GEMINI (case insensitive)", () => {
      process.env.ADW_AI_PROVIDER = "GEMINI";
      expect(getProviderName()).toBe("gemini");
    });
  });

  describe("parseChatProviderOverride", () => {
    it("returns null for none, empty, and unknown", () => {
      expect(parseChatProviderOverride("none")).toBeNull();
      expect(parseChatProviderOverride("")).toBeNull();
      expect(parseChatProviderOverride(null)).toBeNull();
      expect(parseChatProviderOverride("unknown")).toBeNull();
    });

    it("normalizes known providers", () => {
      expect(parseChatProviderOverride("OLLAMA")).toBe("ollama");
      expect(parseChatProviderOverride("llamacpp")).toBe("llama_cpp");
      expect(parseChatProviderOverride("gemini")).toBe("gemini");
    });
  });

  describe("sanitizeChatModelOverride", () => {
    it("trims and strips control characters", () => {
      expect(sanitizeChatModelOverride("  m1\n")).toBe("m1");
      expect(sanitizeChatModelOverride("a\x00b")).toBe("ab");
    });

    it("caps length", () => {
      const long = "x".repeat(MAX_CHAT_MODEL_OVERRIDE_LEN + 40);
      expect(sanitizeChatModelOverride(long).length).toBe(
        MAX_CHAT_MODEL_OVERRIDE_LEN,
      );
    });
  });

  describe("getADWCliPath", () => {
    it("returns cursor when ADW_AI_PATH is unset", () => {
      delete process.env.ADW_AI_PATH;
      expect(getADWCliPath()).toBe("cursor");
    });

    it("returns custom path when ADW_AI_PATH is set", () => {
      process.env.ADW_AI_PATH = "/usr/local/bin/agent";
      expect(getADWCliPath()).toBe("/usr/local/bin/agent");
    });

    it("trims whitespace", () => {
      process.env.ADW_AI_PATH = "  agent  ";
      expect(getADWCliPath()).toBe("agent");
    });
  });

  describe("getAppRepoUrl", () => {
    it("returns empty string when ADW_APP_REPO_URL is unset", () => {
      delete process.env.ADW_APP_REPO_URL;
      expect(getAppRepoUrl()).toBe("");
    });

    it("returns trimmed value when set", () => {
      process.env.ADW_APP_REPO_URL = "  https://github.com/org/app.git  ";
      expect(getAppRepoUrl()).toBe("https://github.com/org/app.git");
    });
  });

  describe("getRemoteHost", () => {
    it("returns null when ADW_APP_REPO_URL is unset", () => {
      delete process.env.ADW_APP_REPO_URL;
      expect(getRemoteHost()).toBeNull();
    });

    it("returns github when URL contains github.com", () => {
      process.env.ADW_APP_REPO_URL = "https://github.com/org/app";
      expect(getRemoteHost()).toBe("github");
    });

    it("returns github for git@github.com URL", () => {
      process.env.ADW_APP_REPO_URL = "git@github.com:org/app.git";
      expect(getRemoteHost()).toBe("github");
    });

    it("returns bitbucket when URL contains bitbucket.org", () => {
      process.env.ADW_APP_REPO_URL = "https://bitbucket.org/workspace/repo";
      expect(getRemoteHost()).toBe("bitbucket");
    });

    it("returns null for unknown host", () => {
      process.env.ADW_APP_REPO_URL = "https://gitlab.com/org/repo";
      expect(getRemoteHost()).toBeNull();
    });
  });

  describe("getGitHubOwnerRepo", () => {
    it("returns null when ADW_APP_REPO_URL is unset", () => {
      delete process.env.ADW_APP_REPO_URL;
      delete process.env.GITHUB_OWNER;
      delete process.env.GITHUB_REPO;
      expect(getGitHubOwnerRepo()).toBeNull();
    });

    it("parses owner and repo from https://github.com/owner/repo", () => {
      process.env.ADW_APP_REPO_URL = "https://github.com/owner/repo";
      expect(getGitHubOwnerRepo()).toEqual({ owner: "owner", repo: "repo" });
    });

    it("parses owner and repo from https://github.com/owner/repo.git", () => {
      process.env.ADW_APP_REPO_URL = "https://github.com/owner/repo.git";
      expect(getGitHubOwnerRepo()).toEqual({ owner: "owner", repo: "repo" });
    });

    it("parses owner and repo from git@github.com:owner/repo.git", () => {
      process.env.ADW_APP_REPO_URL = "git@github.com:owner/repo.git";
      expect(getGitHubOwnerRepo()).toEqual({ owner: "owner", repo: "repo" });
    });

    it("returns override when GITHUB_OWNER and GITHUB_REPO are set", () => {
      process.env.ADW_APP_REPO_URL = "https://github.com/other/repo";
      process.env.GITHUB_OWNER = "myorg";
      process.env.GITHUB_REPO = "myrepo.git";
      expect(getGitHubOwnerRepo()).toEqual({ owner: "myorg", repo: "myrepo" });
    });

    it("returns null for Bitbucket URL", () => {
      process.env.ADW_APP_REPO_URL = "https://bitbucket.org/ws/slug";
      expect(getGitHubOwnerRepo()).toBeNull();
    });
  });

  describe("getGitHubToken", () => {
    it("returns empty string when neither token is set", () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_ACCESS_TOKEN;
      expect(getGitHubToken()).toBe("");
    });

    it("returns GITHUB_TOKEN when set", () => {
      process.env.GITHUB_TOKEN = "gh_secret";
      delete process.env.GITHUB_ACCESS_TOKEN;
      expect(getGitHubToken()).toBe("gh_secret");
    });

    it("prefers GITHUB_TOKEN over GITHUB_ACCESS_TOKEN", () => {
      process.env.GITHUB_TOKEN = "gh_secret";
      process.env.GITHUB_ACCESS_TOKEN = "gh_alt";
      expect(getGitHubToken()).toBe("gh_secret");
    });

    it("returns GITHUB_ACCESS_TOKEN when GITHUB_TOKEN is unset", () => {
      delete process.env.GITHUB_TOKEN;
      process.env.GITHUB_ACCESS_TOKEN = "gh_alt";
      expect(getGitHubToken()).toBe("gh_alt");
    });
  });
});
