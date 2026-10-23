import type { ResolvedAdwConfig } from "./adw-config.js";
import {
  getGitHubApiToken,
  getGitHubOwnerRepoResolved,
} from "./adw-config.js";
import { getGitHubOwnerRepo, getGitHubToken } from "./git.js";

function resolveGitHubAuth(adwConfig?: ResolvedAdwConfig): {
  ownerRepo: { owner: string; repo: string } | null;
  token: string;
} {
  if (adwConfig) {
    return {
      ownerRepo: getGitHubOwnerRepoResolved(adwConfig),
      token: getGitHubApiToken(adwConfig),
    };
  }
  return {
    ownerRepo: getGitHubOwnerRepo(),
    token: getGitHubToken(),
  };
}

/**
 * Common shape for createPullRequest result (id matches Bitbucket, html_url/title from API).
 */
export interface CreatePullRequestResult {
  id: number;
  html_url?: string;
  title?: string;
}

/**
 * Create a pull request via GitHub REST API.
 * @see https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
 */
export async function createPullRequest(
  {
    title,
    description,
    sourceBranch,
    destinationBranch,
    draft,
  }: {
    title: string;
    description: string | undefined;
    sourceBranch: string;
    destinationBranch: string;
    draft: boolean;
  },
  adwConfig?: ResolvedAdwConfig,
): Promise<CreatePullRequestResult> {
  const { ownerRepo, token } = resolveGitHubAuth(adwConfig);
  if (!ownerRepo || !token) {
    throw new Error(
      "GitHub: set ADW_APP_REPO_URL to a GitHub URL (or GITHUB_OWNER/GITHUB_REPO) and GITHUB_TOKEN or GITHUB_ACCESS_TOKEN"
    );
  }
  const { owner, repo } = ownerRepo;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls`;
  console.log({apiUrl})
  const payload: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  } = {
    title,
    head: sourceBranch,
    base: destinationBranch.split("/")[1] ?? destinationBranch,
  };
  if (description?.trim()) {
    payload.body = description.trim();
  }
  if (draft) {
    payload.draft = true;
  }
  console.log({payload})
  console.log({token})
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorBody: { message?: string };
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = { message: text };
    }
    throw new Error(
      `GitHub API error ${response.status}: ${errorBody.message || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    number: number;
    html_url?: string;
    title?: string;
  };
  return {
    id: data.number,
    html_url: data.html_url,
    title: data.title,
  };
}

/**
 * Add a comment to a pull request via GitHub REST API (issues comments endpoint).
 * @see https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
 */
export async function addPullRequestComment(
  prId: number,
  content: string,
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const { ownerRepo, token } = resolveGitHubAuth(adwConfig);
  if (!ownerRepo || !token) {
    throw new Error(
      "GitHub: set GITHUB_TOKEN or GITHUB_ACCESS_TOKEN and owner/repo (ADW_APP_REPO_URL or GITHUB_OWNER/GITHUB_REPO)"
    );
  }
  const { owner, repo } = ownerRepo;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prId}/comments`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ body: content }),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorBody: { message?: string };
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = { message: text };
    }
    throw new Error(
      `GitHub API error ${response.status}: ${errorBody.message || response.statusText}`
    );
  }
}

export type PullRequestReviewComment = {
  body: string;
  path?: string;
  line?: number;
};

async function getPullRequestHeadSha(
  prId: number,
  adwConfig?: ResolvedAdwConfig,
): Promise<string> {
  const { ownerRepo, token } = resolveGitHubAuth(adwConfig);
  if (!ownerRepo || !token) {
    throw new Error(
      "GitHub: set GITHUB_TOKEN or GITHUB_ACCESS_TOKEN and owner/repo (ADW_APP_REPO_URL or GITHUB_OWNER/GITHUB_REPO)"
    );
  }
  const { owner, repo } = ownerRepo;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    let errorBody: { message?: string };
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = { message: text };
    }
    throw new Error(
      `GitHub API error ${response.status}: ${errorBody.message || response.statusText}`
    );
  }
  const data = (await response.json()) as { head?: { sha?: string } };
  const sha = data.head?.sha;
  if (!sha) {
    throw new Error("GitHub PR response missing head.sha");
  }
  return sha;
}

/**
 * Add multiple comments to a pull request. Comments with path and line are posted as
 * review comments on the diff; others are posted as issue comments.
 * @see https://docs.github.com/en/rest/pulls/comments#create-a-review-comment-for-a-pull-request
 * @see https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
 */
export async function addPullRequestComments(
  prId: number,
  comments: PullRequestReviewComment[],
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const { ownerRepo, token } = resolveGitHubAuth(adwConfig);
  if (!ownerRepo || !token) {
    throw new Error(
      "GitHub: set GITHUB_TOKEN or GITHUB_ACCESS_TOKEN and owner/repo (ADW_APP_REPO_URL or GITHUB_OWNER/GITHUB_REPO)"
    );
  }
  const { owner, repo } = ownerRepo;
  const baseHeaders = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const inlineComments = comments.filter(
    (c): c is { body: string; path: string; line: number } =>
      typeof c.path === "string" && typeof c.line === "number"
  );
  const generalComments = comments.filter(
    (c) => !(typeof c.path === "string" && typeof c.line === "number")
  );

  let headSha: string | undefined;
  if (inlineComments.length > 0) {
    headSha = await getPullRequestHeadSha(prId, adwConfig);
  }

  const reviewCommentsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/comments`;
  const issueCommentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prId}/comments`;

  for (const c of inlineComments) {
    if (!headSha) continue;
    try {
      const response = await fetch(reviewCommentsUrl, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          body: c.body,
          commit_id: headSha,
          path: c.path,
          line: c.line,
          side: "RIGHT",
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(
          `Failed to post review comment on ${c.path}:${c.line}:`,
          response.status,
          text
        );
      }
    } catch (err) {
      console.error(
        `Error posting review comment on ${c.path}:${c.line}:`,
        (err as Error).message
      );
    }
  }

  for (const c of generalComments) {
    try {
      const response = await fetch(issueCommentsUrl, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ body: c.body }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("Failed to post PR comment:", response.status, text);
      }
    } catch (err) {
      console.error("Error posting PR comment:", (err as Error).message);
    }
  }
}

/**
 * Merge a pull request via GitHub REST API.
 * @see https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
 */
export async function mergePullRequest(
  prId: number,
  message?: string,
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const { ownerRepo, token } = resolveGitHubAuth(adwConfig);
  if (!ownerRepo || !token) {
    throw new Error(
      "GitHub: set GITHUB_TOKEN or GITHUB_ACCESS_TOKEN and owner/repo"
    );
  }
  const { owner, repo } = ownerRepo;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/merge`;

  const payload: { commit_title?: string } = {};
  if (message?.trim()) {
    payload.commit_title = message.trim();
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorBody: { message?: string };
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = { message: text };
    }
    throw new Error(
      `GitHub API error ${response.status}: ${errorBody.message || response.statusText}`
    );
  }
}
