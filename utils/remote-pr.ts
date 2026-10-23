import type { ResolvedAdwConfig } from "./adw-config.js";
import { getGitHubOwnerRepoResolved } from "./adw-config.js";
import {
  getGitHubOwnerRepo,
  getRemoteHost,
  getRemoteHostFromResolved,
} from "./git.js";
import * as bitbucket from "./bitbucket.js";
import * as github from "./github.js";

export interface CreatePullRequestResult {
  id: number;
  html_url?: string;
  title?: string;
}

export type CreatePullRequestParams = {
  title: string;
  description: string | undefined;
  sourceBranch: string;
  destinationBranch: string;
  draft: boolean;
};

/**
 * Create a pull request using the appropriate provider (GitHub or Bitbucket).
 * Pass `adwConfig` from the ADW flow; omit for env-based URL only.
 */
export async function createPullRequest(
  params: CreatePullRequestParams,
  adwConfig?: ResolvedAdwConfig,
): Promise<CreatePullRequestResult> {
  const host = adwConfig
    ? getRemoteHostFromResolved(adwConfig)
    : getRemoteHost();
  if (host === "github") {
    return github.createPullRequest(params, adwConfig);
  }
  if (host === "bitbucket") {
    const raw = await bitbucket.createPullRequest(params, adwConfig);
    const bb = raw as {
      id: number;
      links?: { html?: { href?: string } };
      title?: string;
    };
    return {
      id: bb.id,
      html_url: bb.links?.html?.href,
      title: bb.title,
    };
  }
  throw new Error(
    "No remote host for PR: set ADW_APP_REPO_URL to a GitHub or Bitbucket repository URL"
  );
}

export type PullRequestReviewComment = {
  body: string;
  path?: string;
  line?: number;
};

/**
 * Add a comment to a pull request. Delegates to GitHub or Bitbucket based on ADW_APP_REPO_URL.
 */
export async function addPullRequestComment(
  prId: number,
  content: string,
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const host = adwConfig
    ? getRemoteHostFromResolved(adwConfig)
    : getRemoteHost();
  if (host === "github") {
    return github.addPullRequestComment(prId, content, adwConfig);
  }
  if (host === "bitbucket") {
    return bitbucket.addPullRequestComment(prId, content, adwConfig);
  }
  throw new Error(
    "No remote host for PR: set ADW_APP_REPO_URL to a GitHub or Bitbucket repository URL"
  );
}

/**
 * Add multiple comments to a pull request. Comments with path and line are posted as
 * inline review comments on the given file/line; others are posted as general PR comments.
 */
export async function addPullRequestComments(
  prId: number,
  comments: PullRequestReviewComment[],
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const host = adwConfig
    ? getRemoteHostFromResolved(adwConfig)
    : getRemoteHost();
  if (host === "github") {
    return github.addPullRequestComments(prId, comments, adwConfig);
  }
  if (host === "bitbucket") {
    return bitbucket.addPullRequestComments(prId, comments, adwConfig);
  }
  throw new Error(
    "No remote host for PR: set ADW_APP_REPO_URL to a GitHub or Bitbucket repository URL"
  );
}

/**
 * Merge a pull request. Delegates to GitHub or Bitbucket based on ADW_APP_REPO_URL.
 */
export async function mergePullRequest(
  prId: number,
  message?: string,
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const host = adwConfig
    ? getRemoteHostFromResolved(adwConfig)
    : getRemoteHost();
  if (host === "github") {
    return github.mergePullRequest(prId, message, adwConfig);
  }
  if (host === "bitbucket") {
    return bitbucket.mergePullRequest(prId, message, adwConfig);
  }
  throw new Error(
    "No remote host for PR: set ADW_APP_REPO_URL to a GitHub or Bitbucket repository URL"
  );
}

/**
 * Build the PR URL for the given PR id based on the configured remote host.
 */
export function getPrUrl(prId: number, adwConfig?: ResolvedAdwConfig): string {
  const host = adwConfig
    ? getRemoteHostFromResolved(adwConfig)
    : getRemoteHost();
  if (host === "github") {
    const ownerRepo = adwConfig
      ? getGitHubOwnerRepoResolved(adwConfig)
      : getGitHubOwnerRepo();
    if (!ownerRepo) {
      throw new Error(
        "GitHub owner/repo not found: set ADW_APP_REPO_URL to a GitHub URL or GITHUB_OWNER/GITHUB_REPO"
      );
    }
    return `https://github.com/${ownerRepo.owner}/${ownerRepo.repo}/pull/${prId}`;
  }
  if (host === "bitbucket") {
    const workspace =
      adwConfig?.repoCredentials.bitbucketWorkspace?.trim() ||
      process.env.BITBUCKET_WORKSPACE?.trim();
    const slug =
      adwConfig?.repoCredentials.bitbucketRepoSlug?.trim() ||
      process.env.BITBUCKET_REPO_SLUG?.trim();
    if (!workspace || !slug) {
      throw new Error(
        "Bitbucket workspace/repo not found: set BITBUCKET_WORKSPACE and BITBUCKET_REPO_SLUG"
      );
    }
    return `https://bitbucket.org/${workspace}/${slug}/pull-requests/${prId}`;
  }
  throw new Error(
    "No remote host: set ADW_APP_REPO_URL to a GitHub or Bitbucket repository URL"
  );
}
