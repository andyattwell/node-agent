import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDataSource } from "./data-source.js";
import { Project as ProjectEntity } from "./entities/Project.js";
import {
  type ProviderName,
  getProviderName,
} from "../providers/utils/provider-common.js";
import { getRepoRoot } from "./git.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** ADW project root (where this script and development/ live). Not the current cwd. */

export const ADW_PROJECT_ROOT = path.resolve(
  __dirname,
  path.basename(__dirname) === "dist" ? "../.." : "..",
);

const DEFAULT_BASE_BRANCH_REF = "origin/main";

export type RepoCredentials = {
  githubToken: string;
  githubAccessToken: string;
  bitbucketAccessToken: string;
  bitbucketWorkspace: string;
  bitbucketRepoSlug: string;
};

/**
 * Merged ADW configuration: project row overrides env for non-empty fields.
 * Do not mutate process.env; pass this object through the ADW flow.
 */
export type ResolvedAdwConfig = {
  /** Absolute path to the app repository working copy (clone root, `trees/` lives under it). */
  repoRoot: string;
  appRepoUrl: string;
  baseBranchRef: string;
  githubOwner: string | null;
  githubRepo: string | null;
  repoCredentials: RepoCredentials;
  aiProvider: ProviderName;
  aiPath: string;
  aiModel: string;
};

/**
 * Normalize stored branch values (e.g. `main`, `develop`) to a remote ref (e.g. `origin/main`).
 */
export function normalizeBaseBranchRef(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) return DEFAULT_BASE_BRANCH_REF;
  if (s.includes("/")) return s;
  return `origin/${s}`;
}

/**
 * Branch name for `git clone -b` (short name, not `origin/main`).
 */
export function refToShortBranchForClone(baseBranchRef: string): string {
  const s = baseBranchRef.trim();
  if (s.startsWith("origin/")) return s.slice("origin/".length);
  const slash = s.lastIndexOf("/");
  return slash >= 0 ? s.slice(slash + 1) : s;
}

function parseGitHubOwnerRepoFromUrl(url: string): {
  owner: string;
  repo: string;
} | null {
  if (!url || !url.includes("github.com")) return null;
  const match =
    url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i) ||
    url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function parseProviderFromProject(
  raw: string | null | undefined,
): ProviderName | null {
  const r = raw?.toLowerCase().trim();
  if (!r) return null;
  if (r === "cursor") return "cursor";
  if (r === "claude") return "claude";
  if (r === "custom") return "custom";
  if (r === "none") return "none";
  return null;
}

/**
 * Parse `projects.credentials`: JSON object with known keys, or plain string as GitHub token.
 */
export function parseProjectCredentialsRaw(
  raw: string | null | undefined,
): Partial<RepoCredentials> {
  const trimmed = raw?.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{")) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>;
      const pick = (k: string): string => {
        const v = o[k];
        return typeof v === "string" ? v.trim() : "";
      };
      return {
        githubToken: pick("GITHUB_TOKEN"),
        githubAccessToken: pick("GITHUB_ACCESS_TOKEN"),
        bitbucketAccessToken: pick("BITBUCKET_ACCESS_TOKEN"),
        bitbucketWorkspace: pick("BITBUCKET_WORKSPACE"),
        bitbucketRepoSlug: pick("BITBUCKET_REPO_SLUG"),
      };
    } catch {
      return {};
    }
  }
  return { githubToken: trimmed };
}

function envRepoCredentials(): RepoCredentials {
  return {
    githubToken: process.env.GITHUB_TOKEN?.trim() ?? "",
    githubAccessToken: process.env.GITHUB_ACCESS_TOKEN?.trim() ?? "",
    bitbucketAccessToken: process.env.BITBUCKET_ACCESS_TOKEN?.trim() ?? "",
    bitbucketWorkspace: process.env.BITBUCKET_WORKSPACE?.trim() ?? "",
    bitbucketRepoSlug: process.env.BITBUCKET_REPO_SLUG?.trim() ?? "",
  };
}

function mergeRepoCredentials(
  env: RepoCredentials,
  fromProject: Partial<RepoCredentials>,
): RepoCredentials {
  const pick = (k: keyof RepoCredentials): string => {
    const p = fromProject[k]?.trim();
    if (p) return p;
    return env[k];
  };
  return {
    githubToken: pick("githubToken"),
    githubAccessToken: pick("githubAccessToken"),
    bitbucketAccessToken: pick("bitbucketAccessToken"),
    bitbucketWorkspace: pick("bitbucketWorkspace"),
    bitbucketRepoSlug: pick("bitbucketRepoSlug"),
  };
}

/**
 * Merge environment and optional project row into a single ADW config.
 */
export function resolveAdwConfig(
  project: ProjectEntity | null,
): ResolvedAdwConfig {
  const workdir = project?.workdir?.trim();
  const repoRoot = workdir
    ? path.resolve(workdir)
    : path.join(getRepoRoot(), "development");
  const envUrl = process.env.ADW_APP_REPO_URL?.trim() ?? "";
  const envBase = process.env.ADW_BASE_BRANCH?.trim() ?? "";
  const appRepoUrl = (project?.repository?.trim() || envUrl).trim();
  const baseBranchRef = normalizeBaseBranchRef(
    project?.base_branch?.trim() || envBase || DEFAULT_BASE_BRANCH_REF,
  );

  const envOwner = process.env.GITHUB_OWNER?.trim();
  const envRepo = process.env.GITHUB_REPO?.trim()?.replace(/\.git$/, "");
  let githubOwner = envOwner ?? null;
  let githubRepo = envRepo ?? null;
  if (!githubOwner || !githubRepo) {
    const parsed = parseGitHubOwnerRepoFromUrl(appRepoUrl);
    if (parsed) {
      githubOwner = parsed.owner;
      githubRepo = parsed.repo;
    }
  }

  const fromProjectCreds = parseProjectCredentialsRaw(project?.credentials);
  const repoCredentials = mergeRepoCredentials(
    envRepoCredentials(),
    fromProjectCreds,
  );

  const envProvider = getProviderName();
  const aiProvider =
    parseProviderFromProject(project?.ai_provider) ?? envProvider;

  const envPath = process.env.ADW_AI_PATH?.trim() ?? "";
  const envModel = process.env.ADW_AI_MODEL?.trim() ?? "";
  const aiPath = project?.ai_path?.trim() || envPath;
  const aiModel = project?.ai_model?.trim() || envModel;

  return {
    repoRoot,
    appRepoUrl,
    baseBranchRef,
    githubOwner,
    githubRepo,
    repoCredentials,
    aiProvider,
    aiPath,
    aiModel,
  };
}

export async function loadProjectById(
  id: number,
): Promise<ProjectEntity | null> {
  const ds = await getDataSource();
  return ds.getRepository(ProjectEntity).findOne({ where: { id } });
}

export function getGitHubApiToken(config: ResolvedAdwConfig): string {
  return (
    config.repoCredentials.githubToken ||
    config.repoCredentials.githubAccessToken ||
    ""
  );
}

export function getGitHubOwnerRepoResolved(
  config: ResolvedAdwConfig,
): { owner: string; repo: string } | null {
  if (config.githubOwner && config.githubRepo) {
    return { owner: config.githubOwner, repo: config.githubRepo };
  }
  return null;
}
