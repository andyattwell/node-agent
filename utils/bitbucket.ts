import type { ResolvedAdwConfig } from "./adw-config.js";

function bitbucketAuth(adwConfig?: ResolvedAdwConfig): {
  workspace: string;
  slug: string;
  token: string;
} {
  if (adwConfig) {
    const c = adwConfig.repoCredentials;
    return {
      workspace:
        c.bitbucketWorkspace.trim() ||
        process.env.BITBUCKET_WORKSPACE?.trim() ||
        "",
      slug:
        c.bitbucketRepoSlug.trim() ||
        process.env.BITBUCKET_REPO_SLUG?.trim() ||
        "",
      token:
        c.bitbucketAccessToken.trim() ||
        process.env.BITBUCKET_ACCESS_TOKEN?.trim() ||
        "",
    };
  }
  return {
    workspace: process.env.BITBUCKET_WORKSPACE?.trim() ?? "",
    slug: process.env.BITBUCKET_REPO_SLUG?.trim() ?? "",
    token: process.env.BITBUCKET_ACCESS_TOKEN?.trim() ?? "",
  };
}

/**
 * Create a pull request via Bitbucket REST API 2.0
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post
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
): Promise<unknown> {
  const { workspace, slug, token } = bitbucketAuth(adwConfig);
  const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${slug}/pullrequests`;

  const payload: {
    title: string;
    source: { branch: { name: string } };
    destination: { branch: { name: string } };
    description?: string;
    draft?: boolean;
  } = {
    title,
    source: {
      branch: { name: sourceBranch },
    },
    destination: {
      branch: { name: destinationBranch },
    },
  };

  if (description?.trim()) {
    payload.description = description.trim();
  }
  if (draft) {
    payload.draft = true;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorBody: { error?: { message?: string }; message?: string };
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = { message: text };
    }
    throw new Error(
      `Bitbucket API error ${response.status}: ${errorBody.error?.message || errorBody.message || response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Add a comment to a pull request via Bitbucket REST API 2.0
 */
export async function addPullRequestComment(
  prId: number,
  content: string,
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const { workspace, slug, token } = bitbucketAuth(adwConfig);
  const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${slug}/pullrequests/${prId}/comments`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: { raw: content } }),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorBody: { error?: { message?: string }; message?: string };
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = { message: text };
    }
    throw new Error(
      `Bitbucket API error ${response.status}: ${errorBody.error?.message || errorBody.message || response.statusText}`,
    );
  }
}

export type PullRequestReviewComment = {
  body: string;
  path?: string;
  line?: number;
};

/**
 * Add multiple comments to a pull request.
 */
export async function addPullRequestComments(
  prId: number,
  comments: PullRequestReviewComment[],
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const { workspace, slug, token } = bitbucketAuth(adwConfig);
  const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${slug}/pullrequests/${prId}/comments`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  for (const c of comments) {
    const hasInline = typeof c.path === "string" && typeof c.line === "number";
    const payload: {
      content: { raw: string };
      inline?: { path: string; from: number; to: number };
    } = {
      content: { raw: c.body },
    };
    if (hasInline) {
      payload.inline = { path: c.path!, from: c.line!, to: c.line! };
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(
          hasInline
            ? `Failed to post inline comment on ${c.path}:${c.line}:`
            : "Failed to post PR comment:",
          response.status,
          text,
        );
      }
    } catch (err) {
      console.error(
        hasInline
          ? `Error posting inline comment on ${c.path}:${c.line}:`
          : "Error posting PR comment:",
        (err as Error).message,
      );
    }
  }
}

/**
 * Merge a pull request via Bitbucket REST API 2.0
 */
export async function mergePullRequest(
  prId: number,
  message?: string,
  adwConfig?: ResolvedAdwConfig,
): Promise<void> {
  const { workspace, slug, token } = bitbucketAuth(adwConfig);
  const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${slug}/pullrequests/${prId}/merge`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(message ? { message } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorBody: { error?: { message?: string }; message?: string };
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = { message: text };
    }
    throw new Error(
      `Bitbucket API error ${response.status}: ${errorBody.error?.message || errorBody.message || response.statusText}`,
    );
  }
}
