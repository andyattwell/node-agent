import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { ResolvedAdwConfig } from "./adw-config.js";
import { refToShortBranchForClone } from "./adw-config.js";
import { copyEnvToWorktree } from "./step-helpers.js";

/**
 * Get repository root directory (absolute path).
 * Must be run from within the repository.
 */
export function getRepoRoot(cwd: string = process.cwd()): string {
  return execSync("git rev-parse --show-toplevel", {
    encoding: "utf8",
    cwd,
  }).trim();
}

/**
 * App repo at `<adwProjectRoot>/development` when not using a per-project `workdir`.
 * For the resolved project layout, use `adwConfig.repoRoot` from `resolveAdwConfig`.
 */
export function getDevelopmentRepoRoot(adwProjectRoot: string): string {
  return path.join(adwProjectRoot, "development");
}

/**
 * Remote URL for git (clone/fetch/push): same as `appRepoUrl` unless project/env
 * credentials allow embedding tokens for non-interactive HTTPS.
 */
export function resolveGitRemoteUrl(config: ResolvedAdwConfig): string {
  const raw = config.appRepoUrl.trim();
  if (!raw) return raw;

  const gh = (
    config.repoCredentials.githubToken ||
    config.repoCredentials.githubAccessToken
  ).trim();
  const bb = config.repoCredentials.bitbucketAccessToken.trim();

  if (raw.startsWith("git@github.com:") && gh) {
    const m = raw.match(/^git@github\.com:([^/]+)\/(.+)$/i);
    if (!m) return raw;
    const repo = m[2].replace(/\.git$/i, "");
    return `https://x-access-token:${encodeURIComponent(gh)}@github.com/${m[1]}/${repo}.git`;
  }

  if (raw.startsWith("git@bitbucket.org:") && bb) {
    const m = raw.match(/^git@bitbucket\.org:([^/]+)\/(.+)$/i);
    if (!m) return raw;
    const repo = m[2].replace(/\.git$/i, "");
    return `https://x-token-auth:${encodeURIComponent(bb)}@bitbucket.org/${m[1]}/${repo}.git`;
  }

  try {
    const u = new URL(raw);
    if (u.username || u.password) return raw;

    if (gh && u.hostname.toLowerCase().includes("github")) {
      u.username = "x-access-token";
      u.password = gh;
      return u.toString();
    }
    if (bb && u.hostname.includes("bitbucket.org")) {
      u.username = "x-token-auth";
      u.password = bb;
      return u.toString();
    }
  } catch {
    /* not a parseable https URL */
  }

  return raw;
}

/**
 * Point `origin` at the configured remote (with credentials when present) so fetch/push work.
 */
export function applyConfiguredOriginRemote(
  appRepoPath: string,
  config: ResolvedAdwConfig,
): void {
  const url = resolveGitRemoteUrl(config).trim();
  if (!url) return;
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd: appRepoPath,
      stdio: "pipe",
    });
  } catch {
    return;
  }
  let hasOrigin = true;
  try {
    execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: appRepoPath,
      stdio: "pipe",
    });
  } catch {
    hasOrigin = false;
  }
  try {
    if (hasOrigin) {
      execFileSync("git", ["remote", "set-url", "origin", url], {
        cwd: appRepoPath,
        stdio: "pipe",
      });
    } else {
      execFileSync("git", ["remote", "add", "origin", url], {
        cwd: appRepoPath,
        stdio: "pipe",
      });
    }
  } catch {
    // ignore: unusual repo layout
  }
}

/**
 * Ensure the app repository is cloned at repoRoot/development.
 * If development/ does not exist or is not a git repository, clones appRepoUrl into development/.
 * branchName: branch to clone/checkout (e.g. "develop").
 */
export function ensureAppRepoCloned(
  developmentDir: string,
  appRepoUrl: string,
  branchName: string,
): string {
  if (appRepoUrl === "") {
    if (!fs.existsSync(developmentDir)) {
      fs.mkdirSync(developmentDir, { recursive: true });
    }
    return developmentDir;
  }

  if (fs.existsSync(developmentDir)) {
    try {
      execSync("git rev-parse --git-dir", {
        encoding: "utf8",
        cwd: developmentDir,
        stdio: "pipe",
      });
      return developmentDir;
    } catch {}
  }

  try {
    execFileSync(
      "git",
      ["clone", "-b", branchName, appRepoUrl, developmentDir],
      {
        cwd: path.dirname(developmentDir),
        stdio: "pipe",
      },
    );
  } catch (error) {
    console.error("Error cloning app repo: ", error);
    throw error;
  }
  return developmentDir;
}

/**
 * Ensure the trees directory exists at repo root.
 */
export function ensureTreesDir(repoRoot: string): string {
  const treesDir = path.join(repoRoot, "trees");
  if (!fs.existsSync(treesDir)) {
    fs.mkdirSync(treesDir, { recursive: true });
  }
  return treesDir;
}

function getRepoName(appRepoUrl: string): string {
  return (
    appRepoUrl
      .split("/")
      .pop()
      ?.replace(/\.git$/, "") ?? ""
  );
}

function localBranchExists(repoRoot: string, branchName: string): boolean {
  try {
    execFileSync(
      "git",
      ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
      { cwd: repoRoot, stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

export type AdwWorkingCopyMode = "git_worktree" | "in_repo";

/**
 * Prepare app checkout + ADW branch: either a linked git worktree or in-place checkout in the clone.
 */
export function prepareAdwWorkingCopy(
  adwId: string,
  config: ResolvedAdwConfig,
  mode: AdwWorkingCopyMode,
): { workPath: string; branchName: string } {
  if (mode === "git_worktree") {
    return initializeWorktree(adwId, config);
  }
  return prepareWorkingCopyInRepo(adwId, config);
}

/**
 * Same branch as worktree mode, but `git checkout` that branch in the main clone (no `git worktree add`).
 */
export function prepareWorkingCopyInRepo(
  adwId: string,
  config: ResolvedAdwConfig,
): { workPath: string; branchName: string } {
  const shortBranch = refToShortBranchForClone(config.baseBranchRef);
  const cloneUrl = resolveGitRemoteUrl(config);
  const devRoot = ensureAppRepoCloned(config.repoRoot, cloneUrl, shortBranch);
  applyConfiguredOriginRemote(devRoot, config);

  const baseBranch = config.baseBranchRef;
  const branchName = `adw-${adwId}`;

  execFileSync("git", ["fetch", "origin"], { cwd: devRoot, stdio: "pipe" });

  if (localBranchExists(devRoot, branchName)) {
    throw new Error(
      `Branch ${branchName} already exists in ${devRoot}. Use another adw_id or delete the branch.`,
    );
  }

  execFileSync("git", ["branch", branchName, baseBranch], {
    cwd: devRoot,
    stdio: "pipe",
  });
  execFileSync("git", ["checkout", branchName], {
    cwd: devRoot,
    stdio: "pipe",
  });

  return { workPath: devRoot, branchName };
}

/**
 * Create a worktree and copy .env and feature document to it.
 * App clone root is `config.repoRoot` (project `workdir` or `<adw>/development`).
 * Worktrees are created at `<repoRoot>/trees/<folderName>`.
 */
export function initializeWorktree(
  adwId: string,
  config: ResolvedAdwConfig,
): {
  workPath: string;
  branchName: string;
} {
  const shortBranch = refToShortBranchForClone(config.baseBranchRef);
  const cloneUrl = resolveGitRemoteUrl(config);
  const devRoot = ensureAppRepoCloned(config.repoRoot, cloneUrl, shortBranch);
  applyConfiguredOriginRemote(devRoot, config);

  const baseBranch = config.baseBranchRef;

  const branchName = `adw-${adwId}`;
  const folderName = branchToFolderName(branchName);

  execFileSync("git", ["fetch", "origin"], { cwd: devRoot, stdio: "pipe" });

  if (localBranchExists(devRoot, branchName)) {
    throw new Error(
      `Branch ${branchName} already exists in ${devRoot}. Use another adw_id or delete the branch.`,
    );
  }

  execFileSync("git", ["branch", branchName, baseBranch], {
    cwd: devRoot,
    stdio: "pipe",
  });

  ensureTreesDir(devRoot);
  const workPath = path.join(devRoot, "trees", folderName);
  if (fs.existsSync(workPath)) {
    throw new Error(
      `Worktree already exists at ${workPath}. Use another adw_id or remove it.`,
    );
  }
  execFileSync("git", ["worktree", "add", workPath, branchName], {
    cwd: devRoot,
    stdio: "pipe",
  });

  copyEnvToWorktree(devRoot, workPath);

  return { workPath, branchName };
}
/**
 * Run git add and git commit in the worktree.
 */
export function commitInWorktree(
  workPath: string,
  message: string,
  paths?: string[],
): void {
  const spec = paths && paths.length > 0 ? paths.join(" ") : ".";
  execSync(`git add ${spec}`, { cwd: workPath, stdio: "pipe" });
  execSync(`git commit -m ${JSON.stringify(message)}`, {
    cwd: workPath,
    stdio: "pipe",
  });
}

/**
 * Push the worktree's current branch to origin.
 */
export function pushWork(workPath: string, branchName: string): void {
  execFileSync("git", ["push", "origin", branchName], {
    cwd: workPath,
    stdio: "pipe",
  });
}

/**
 * Derive folder name for worktree from branch name (part after last "/").
 */
export function branchToFolderName(branchName: string): string {
  const lastSlash = branchName.lastIndexOf("/");
  return lastSlash >= 0 ? branchName.slice(lastSlash + 1) : branchName;
}

export function getPrTitleAndDescription(
  prDescriptionPath: string,
): { title: string; description: string } | null {
  if (!fs.existsSync(prDescriptionPath)) {
    return null;
  }
  const prDescription = fs.readFileSync(prDescriptionPath, "utf8").trim();
  const title = prDescription.split("\n")[0].replace("#", "").trim();
  const description = prDescription.slice(title.length + 2).trim();
  return { title, description };
}

const DEFAULT_BASE_BRANCH = "origin/main";

/**
 * Read base branch for new worktree branches (remote ref, e.g. origin/main or origin/main).
 * ADW_BASE_BRANCH. Default: "origin/main".
 */
export function getBaseBranch(): string {
  return process.env.ADW_BASE_BRANCH?.trim() || DEFAULT_BASE_BRANCH;
}

/**
 * Read app repository URL for cloning into development/ when using separate app repo.
 * ADW_APP_REPO_URL. Required when agents work in a separate repo (cloned into development/).
 */
export function getAppRepoUrl(): string {
  return process.env.ADW_APP_REPO_URL?.trim() ?? "";
}

export type RemoteHost = "github" | "bitbucket";

/**
 * Infer remote host from ADW_APP_REPO_URL.
 * Returns "github" if URL contains github.com, "bitbucket" if bitbucket.org, otherwise null.
 */
export function getRemoteHost(): RemoteHost | null {
  const url = getAppRepoUrl();
  if (!url) return null;
  if (url.includes("github.com")) return "github";
  if (url.includes("bitbucket.org")) return "bitbucket";
  return null;
}

/** Prefer resolved config URL (ADW flow); otherwise env-based URL. */
export function getRemoteHostFromResolved(
  config: ResolvedAdwConfig,
): RemoteHost | null {
  const url = config.appRepoUrl?.trim() || getAppRepoUrl();
  if (!url) return null;
  if (url.includes("github.com")) return "github";
  if (url.includes("bitbucket.org")) return "bitbucket";
  return null;
}

/**
 * Parse owner and repo from ADW_APP_REPO_URL for GitHub.
 * Supports https://github.com/owner/repo, https://github.com/owner/repo.git, git@github.com:owner/repo.git.
 * Override with GITHUB_OWNER and GITHUB_REPO if set.
 */
export function getGitHubOwnerRepo(): { owner: string; repo: string } | null {
  const overrideOwner = process.env.GITHUB_OWNER?.trim();
  const overrideRepo = process.env.GITHUB_REPO?.trim();
  if (overrideOwner && overrideRepo) {
    return { owner: overrideOwner, repo: overrideRepo.replace(/\.git$/, "") };
  }
  const url = getAppRepoUrl();
  if (!url || !url.includes("github.com")) return null;
  // git@github.com:owner/repo.git or https://github.com/owner/repo[.git]
  const match =
    url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i) ||
    url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

/**
 * Read GitHub token for API calls. GITHUB_TOKEN or GITHUB_ACCESS_TOKEN.
 */
export function getGitHubToken(): string {
  return (
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_ACCESS_TOKEN?.trim() ||
    ""
  );
}
