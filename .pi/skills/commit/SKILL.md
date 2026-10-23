---
name: commit
description: Commit changes
disable-model-invocation: true
---
# Commit changes

Analize the changes in current staged and unstaged files an commit them.
IMPORTANT: Don't add a trailer.

# Commit message structure

Generate the commit in the following style:

<type>(<scope>): <short descriptive message>

    - <item 1>
    - <item 2>
    - <item 3>
    - ...

Example:

```
feat(adw): sync job on agent step boundaries and persistAdwState in CLI

    - Add Agent.executeStep with updateJobFromState at start/finally
    - Wrap classify, plan, implement, test, pull_request, review in executeStep
    - saveState writes disk + issue sync only; persistAdwState adds job sync for main
    - Include step-helpers updates from working tree
```
