# Fix Review Comments

Apply the corrections suggested in the latest code review. All work must be done in the worktree; do not commit or push (the ADW will do that after this step).

## Variables

- ADW_ID: $ADW_ID
- PROJECT_ROOT: $PROJECT_ROOT
- WORKING_DIRECTORY: $WORKING_DIRECTORY
- REVIEW_RESULT: $REVIEW_RESULT_STR

## Instructions

1. Read the review comments from `$REVIEW_RESULT` (JSON with `approved` and `comments`).
2. For each comment in `comments`, apply the suggested fix or solution in `$WORKING_DIRECTORY`.
3. Edit the relevant files (use `path` and `line` when present for context).
4. Follow project conventions from `.cursorrules`.
5. Do **not** run `git commit` or `git push`; the ADW will commit and push after this step.

## Summary

After applying all fixes, you may output a short summary of what was changed. The ADW does not require a specific output format for this step.
