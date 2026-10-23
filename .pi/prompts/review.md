# Code Review

Review the pull request and produce a structured result: either approve it or list comments with suggested fixes.

## Variables

- PR_URL: $PR_URL
- PR_ID: $PR_ID
- ADW_ID: $ADW_ID
- PROJECT_ROOT: $PROJECT_ROOT
- WORKING_DIRECTORY: $WORKING_DIRECTORY

## Instructions

1. Review the pull request at $PR_URL (or use the PR diff and changed files in $WORKING_DIRECTORY).
2. Consider: project conventions (.cursorrules), code quality, obvious errors, tests, and consistency.
3. If the PR is correct and meets the criteria, set `approved` to `true` and omit or leave `comments` empty.
4. If you find issues, set `approved` to `false` and add one object per comment to `comments`. Each comment must include a **solution or concrete suggestion** (how to fix the issue), not only the problem. Optionally include `path` (file path relative to repo) and `line` (line number) for context; omit them for general PR-level comments.

## Output

**REQUIRED**: Write the result to this exact path:

`$STATE_DIR/review_result.json`

## Format of review_result.json

```json
{
  "approved": false,
  "comments": [
    {
      "body": "Description of the issue and suggested fix or solution.",
      "path": "apps/client/src/foo.ts",
      "line": 10
    }
  ]
}
```

- `approved`: boolean. `true` if the PR is ready to merge; `false` if changes are needed.
- `comments`: array of objects. Each object has:
  - `body` (required): string, the comment text including the suggested fix.
  - `path` (optional): string, file path relative to repository root. When provided together with `line`, the comment is posted on that file and line in the PR.
  - `line` (optional): number, line number in the file.

If `approved` is `true`, `comments` may be an empty array or omitted.

Do not finish until you have written the file to the path above.
