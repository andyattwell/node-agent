# ADW – Automated Development Workflow

CLI that orchestrates the full development cycle from a prompt to a pull request, running all work in a new Git worktree. It coordinates five agents (Planner, Implementer, Tester, Pull Request, Reporter), each mapped to an existing Cursor command.

## Requirements

- **Node.js** 18+
- **Git** (repository with a default branch; see `ADW_BASE_BRANCH` below)

Run the CLI from the **ADW project root** (the repo where this code lives). The agents work in a **separate app repository**, which is cloned into `app/` when missing (see `ADW_APP_REPO_URL` below). Worktrees are created in `trees/` at the project root (linked to the app repo in `app/`).

## Installation

From the repository root:

```bash
npm install
```

## Usage

### Start a new workflow

```bash
# From repo root (recommended)
npm run dev -- --prompt "feat: add X"

# Start from an issue (SQLite): uses the issue description as the prompt
npm run dev -- --issue-id 42

# Resume after a stop (same shell or later)
npm run dev -- --resume --adw-id=<id>

# Restart from a job row (requires both; loads step from that job)
npm run dev -- --job-id 5 --issue-id 42
```

Entry points are **`--prompt`**, **`--issue-id`**, **`--job-id` with `--issue-id`**, or **`--resume` with `--adw-id`**. Prompt-only runs use `ADW_PROJECT_ID` (or `1`) for merged repo/AI config; issue-driven runs use the issue’s project. If both `--issue-id` and `--prompt` are passed, the issue wins.

This will:

1. Ensure the app repo exists at `development/` (clone from `ADW_APP_REPO_URL` or the matching SQLite project row if missing).
2. Create a new branch from the base branch (default `origin/main`, overridable with `ADW_BASE_BRANCH` or the project’s `base_branch`).
3. Create a worktree in `trees/<folder>` at project root (folder name derived from the branch; git metadata lives in `development/`).
4. Copy `.env` and optional feature document from the app repo into the worktree.
5. Save state under `state/<adw_id>/` in the ADW project.
6. Print the instruction to run the **classify** step (Cursor command) and then resume.

### Resume after an agent step

After you run the Cursor command indicated by the CLI (classify, plan, implement, test, or pull_request), run:

```bash
npm run dev -- --resume --adw-id=<id>
```

Use the same `adw_id` that was printed when you started. The CLI loads state from `state/<adw_id>/`, runs the next step (or completes the workflow).

### Flow summary

| Step         | What you do                                                                          | Resume reads / writes                              |
| ------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Classify     | Run `commands/classify_issue.md` (or provider); then `--resume --adw-id=…` if paused | Classification stored in state JSON (`issueClass`) |
| Plan         | Run the plan command (feature/chore/bug) and save plan in `docs/features/...`        | Finds latest plan in `docs/features`, commits      |
| Implement    | Run `commands/implement.md` with the plan path                                       | Commits pending changes, then instructs test       |
| Test         | Run `commands/test.md`; write `pass` or `fail` to `state/<id>-test-result.txt`       | Retries up to 3 times; on 3 failures, no PR        |
| Pull Request | Run `commands/pr.md`; write PR URL to `state/<id>-pr-url.txt`                        | Saves `prUrl`, then report                         |
| Report       | CLI prints branch, worktree path, PR URL, and `git diff origin/main --stat`          | -                                                  |

## State and worktree location

- **ADW project**: Where you run the CLI (this repo). State and Cursor command files live here.
- **App repo**: Cloned into `app/` when missing (set `ADW_APP_REPO_URL`). All agent work (plan, implement, test, PR) happens in this repo.
- **State**: `state/<adw_id>/` in the ADW project (e.g. `state.json`, sidecar files for test results, PR description).
- **Worktree**: `trees/<folder>` at project root (e.g. `trees/adw-abc12345` for branch `adw-abc12345`). Each worktree is linked to the app repo in `app/`.

## Build and run (compiled)

```bash
npm run build
npm run start -- --prompt "feat: example"
```

## Database and API

The project uses **TypeORM** with SQLite (same file as before: `DATABASE_PATH` / `PROJECT_ROOT`). Entities and the shared DataSource live in `utils/entities/` and `utils/data-source.ts`. Build the **root** first (`npm run build` at project root) so that `dist/utils/` exists. The **API** (`app/api`) uses this shared layer by loading it from the root build; run the API from the **project root** (e.g. `node app/api/dist/index.js`) so the shared DB module and driver resolve correctly.

### Cron: open issues → ADW

`scripts/cron-issues.ts` picks the oldest issue with status `open`, claims it (so concurrent runs do not start duplicate workflows), and spawns `npm run dev -- --issue-id <id>` in the background. Logs append to `logs/cron-issues.log` (directory is created if missing).

```bash
npm run cron-issues
```

Run it every five minutes from cron, for example (adjust the path):

```cron
*/5 * * * * cd /path/to/node-agent && /usr/bin/npm run cron-issues
```

## AI provider integration

With an AI provider configured, the ADW can invoke the tool from Node (as a child process), wait for output, and process it (e.g. save classification to state JSON after classify).

### Environment variables

| Variable                             | Description                                                                                                                                                                                                                                        | Default                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --- | --- |
| `ADW_AI_PROVIDER`                    | Provider to use: `cursor`, `ollama`, `claude`, `llama_cpp`, or `none`.                                                                                                                                                                             | `none`                     |
| `ADW_AI_PATH`                        | Path to Cursor CLI binary (e.g. `cursor` or `agent`). Must be on `PATH` or absolute.                                                                                                                                                               | `cursor`                   |
| `ADW_CURSOR_TIMEOUT_MS`              | Timeout in ms for the Cursor process.                                                                                                                                                                                                              | `600000` (10 min)          |
| `CLAUDE_CLI_PATH`                    | Path to Claude Code CLI binary. Must be on `PATH` or absolute.                                                                                                                                                                                     | `claude`                   |
| `ADW_CLAUDE_TIMEOUT_MS`              | Timeout in ms for the Claude Code process (ADW steps and `chat.ts`).                                                                                                                                                                               | `600000` (10 min)          |
| `ADW_AI_MODEL`                       | Unified model id: Ollama model name, llama-server `model` in `/v1/chat/completions`, or Cursor/Claude CLI `--model` when set. If unset, Ollama and `llama_cpp` default to `llama3.2`; Cursor/Claude omit `--model` (CLI default).                  | -                          |
| `ADW_OLLAMA_TIMEOUT_MS`              | Timeout in ms for Ollama API calls.                                                                                                                                                                                                                | `600000` (10 min)          |
| `ADW_CHAT_CONTEXT_WINDOW`            | Token context window for the web chat fullness indicator (denominator). Match Ollama `num_ctx` / llama-server `-c`.                                                                                                                                | `16384`                    |     | -   |
| `ADW_AI_PATH`                        | If set, do not spawn a child: use this base URL (no trailing slash). Best for avoiding cold start.                                                                                                                                                 | -                          |
| `LLAMA_SERVER_PORT`                  | Port when the app spawns `llama-server`.                                                                                                                                                                                                           | `8088`                     |
| `LLAMA_CHAT_TEMPLATE_FILE`           | Optional Jinja override (relative paths resolve from `PROJECT_ROOT` / repo root). See [vllm/qwen3-chat-template-patched.jinja](vllm/qwen3-chat-template-patched.jinja).                                                                            | -                          |
| `LLAMA_CHAT_TEMPLATE_KWARGS`         | JSON for server `--chat-template-kwargs` (e.g. `{"enable_thinking":false}`).                                                                                                                                                                       | -                          |
| `LLAMA_CHAT_REQUEST_TEMPLATE_KWARGS` | JSON merged into each chat request as `chat_template_kwargs`. Invalid JSON falls back to `{"enable_thinking":true}`.                                                                                                                               | `{"enable_thinking":true}` |
| `LLAMA_SERVER_N_GPU_LAYERS`          | Passed as `-ngl` when spawning (e.g. `0` for CPU-only).                                                                                                                                                                                            | `-1`                       |
| `LLAMA_SERVER_EXTRA_ARGS`            | Extra `llama-server` argv (space-separated).                                                                                                                                                                                                       | -                          |
| `LLAMA_SERVER_PING_ON_START`         | If `1`/`true`, send a tiny completion after the server is healthy.                                                                                                                                                                                 | off                        |
| `LLAMA_CPP_TIMEOUT_MS`               | Timeout for HTTP calls and server boot wait.                                                                                                                                                                                                       | `600000` (10 min)          |
| `LLAMA_SERVER_LOG_STDERR`            | If `1`, forward spawned server stderr to the process stderr.                                                                                                                                                                                       | off                        |
| `ADW_BASE_BRANCH`                    | Remote ref to branch from (e.g. `origin/develop`, `origin/main`). Used for new ADW branches, worktrees, and as the PR base. Same ref is used when cloning the app repo into `development/` (short branch name, e.g. `main`, is derived from this). | `origin/main`              |
| `ADW_APP_REPO_URL`                   | URL of the app repository to clone into `development/`. Required when that folder does not exist.                                                                                                                                                  | -                          |
| `ADW_PROJECT_ID`                     | Default SQLite `projects.id` for merging repo/AI/credentials into prompt-only ADW runs. Issue-driven runs use the issue’s project.                                                                                                                 | `1`                        |

### Requirements for Cursor provider

- Cursor CLI installed and available as `cursor` (or the path set in `ADW_AI_PATH`). See [Cursor CLI](https://cursor.com/docs/cli/overview).
- Non-interactive usage: the CLI is invoked with `-p` (prompt) and `-f` (force) so it can run in scripts.
- If `ADW_AI_PROVIDER` is unset or `none`, behaviour is unchanged: only instructions are printed and the user runs commands manually.

### Requirements for Ollama provider

- Ollama running locally (or at the URL set in `ADW_AI_PATH`). See [Ollama](https://ollama.com).
- Model pulled (e.g. `ollama pull llama3.2`).
- The provider uses the same workflow steps (classify, plan, implement, test, pull_request) and expects the same output format as the Cursor provider (e.g. classify must output `feature`, `bug`, `chore`, or `0`).

### Requirements for llama.cpp (`llama_cpp`) provider

- Build [llama.cpp](https://github.com/ggml-org/llama.cpp) and use the **`llama-server`** binary. The sample [vllm/llama-cpp.sh](vllm/llama-cpp.sh) uses `llama-cli`; that binary is **not** enough for chat/tools-use `llama-server`. Use a **recent** llama.cpp for Qwen3 tools and reasoning ([function calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)).
- Either set **`ADW_AI_PATH`** to an already-running server (recommended to avoid cold start) or let the app spawn `llama-server` with `--jinja`, `--warmup`, `-c 16384`, `-t 4`, `-b 1`, `-ngl`, `--reasoning-format auto`, `--sleep-idle-seconds -1`, plus optional `--chat-template-file` when `LLAMA_CHAT_TEMPLATE_FILE` is set.
- Optional template: [vllm/qwen3-chat-template-patched.jinja](vllm/qwen3-chat-template-patched.jinja) is the `chat_template` from [Qwen/Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) `tokenizer_config.json` for minja compatibility with tool formatting. Set `LLAMA_CHAT_TEMPLATE_FILE=vllm/qwen3-chat-template-patched.jinja` if the embedded GGUF template errors.
- **`npm run chat` / `chat.ts`:** With `ADW_AI_PROVIDER=llama_cpp`, chat uses the same HTTP stack (tools, streaming, `reasoning_content` → thinking).

### Chat with Cursor or Claude CLI

- Set `ADW_AI_PROVIDER=cursor` or `ADW_AI_PROVIDER=claude` and run `npm run chat` (or `tsx chat.ts`). The script flattens conversation history into a single prompt and runs the respective CLI with `stream-json` (and partial streaming where supported).
- **Local tool loop:** The in-repo tool definitions in `tools/` are **not** executed by Node for these providers; the Cursor/Claude agent runs its own tools internally. Streamed JSON lines that look like tool use or tool result are forwarded to the client as display-only chunks when possible.
- **Workspace:** CLI chat uses `PROJECT_ROOT` if set, otherwise `process.cwd()`, matching `chat.ts` working directory.

### Adding other providers

The system uses an `AIProvider` interface (`providers/ai-provider.ts`). New providers (e.g. Ollama, Claude) can be added by implementing that interface and registering in `providers/index.ts`.

## Notes

- **Project row (SQLite `projects`)**: Optional fields `repository`, `base_branch`, `credentials` (JSON with `GITHUB_TOKEN`, `BITBUCKET_*`, etc., or a plain token string), and `ai_provider` / `ai_path` / `ai_model` override the corresponding environment defaults for that project’s ADW runs. Prompt-only runs use `ADW_PROJECT_ID` (issues use the issue’s `project_id`). Configuration is passed through the process explicitly (not via mutating `process.env`).
- **Pull requests** (creation, comments): The app repository can be on **Bitbucket** or **GitHub**. Set `ADW_APP_REPO_URL` to the repo URL (e.g. `https://github.com/owner/repo` or a Bitbucket URL). For **Bitbucket**, set `BITBUCKET_WORKSPACE`, `BITBUCKET_REPO_SLUG`, and `BITBUCKET_ACCESS_TOKEN`. For **GitHub**, set `GITHUB_TOKEN` (or `GITHUB_ACCESS_TOKEN`); owner/repo are inferred from `ADW_APP_REPO_URL` unless you set `GITHUB_OWNER` and `GITHUB_REPO`.
- Without `ADW_AI_PROVIDER` or with `ADW_AI_PROVIDER=none`, the ADW only prints instructions; a human (or external runner) runs the indicated command and then runs the CLI again with `--resume --adw-id=<id>`.
- With `ADW_AI_PROVIDER=cursor`, `ollama`, `claude`, or `llama_cpp`, the classify step is run automatically when possible; the result is saved to state JSON (`issueClass`) and the workflow advances to the plan step.
- If classification returns `0`, the workflow ends without creating a plan or PR.
- If tests fail 3 times, the error is documented (e.g. in `state/<id>-test-error.md`) and no PR is created.
