# Report Agent

Generate a short report of the work done in the current workflow. Execute from the **worktree** directory.

## Variables

worktree: $WORKING_DIRECTORY

## Instructions

1. Change to the worktree directory (the path where the development was done).
2. Run the following and include the results in your output:
   - **Branch**: `git rev-parse --abbrev-ref HEAD`
   - **Worktree path**: current working directory (e.g. `pwd` or the path you were given)
   - **PR URL**: if a pull request was created, include its URL (from environment variable, file left by pull_request command, or context)
   - **Diff summary**: `git diff origin/main --stat` (run from the worktree)

## Output format

Return a single block (text or markdown) with:

- **Branch**: \<branch name\>
- **Worktree path**: \<absolute path\>
- **PR URL**: \<url or "N/A"\>
- **Diff (origin/main)**:
  ```
  <output of git diff origin/main --stat>
  ```

Do not add extra commentary; only this report block.
