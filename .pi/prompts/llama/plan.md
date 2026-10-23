# Feature Plan

Read the user prompt and generate an implementation plan in the specified format.

IMPORTANT: All work must be done in `$WORKING_DIRECTORY` (absolute path below).

## Variables

issue_type: Use the workflow value `$ISSUE_TYPE` (from the project default or issue type).
working_directory: $WORKING_DIRECTORY
project_root: $PROJECT_ROOT

## Objective

**REQUIRED**: Save the plan in `$WORKING_DIRECTORY/docs/features/{descriptive-name}` with the name `IMPLEMENTATION_PLAN.md` (or `IMPLEMENTATION_PLAN_{task-name}.md` if one already exists). `{descriptive-name}` = short name (e.g., `add-agent-logging`, `fix-login-issue`, `removed-unused-deps`). `{task-name}` = more specific if there are multiple plans in the same feature.

## Rules

- **Work directory**: All the work must be done under `$WORKING_DIRECTORY` (the ADW work checkout; same as `$PROJECT_ROOT` when not using a separate git worktree). Do not use the ADW tool/script directory as the work root.

- **Research**: Start with `README.md`; explore patterns in `development/`, `docs/` and `commands/llama`. Ignore the rest.

- **Language**: Plan in Spanish; code names (variables, tables, columns, files) in English.

- **Code in the plan**: Only minimal snippets that illustrate style and patterns; for changes to existing code, only the lines to be modified.

- **Dependencies**: If a new library is needed, indicate `npm install ...` in the **Notes** section of the plan.

- **UI/E2E**: If the feature has a UI or user interaction:

- Include a task to create `docs/e2e/test_<descriptive_name>.md` (based on examples in `docs/e2e/`).

- In "Relevant Files," add: read `commands/test.md` and `docs/e2e/test_basic_query.md`.

- Include E2E validation in **Validation Commands** (read and execute the new E2E test).

- After creating the plan, generate a commit saving the plan and initial prompt.

## Plan Format

```md
# <issue_type>: <name>

## Metadata

prompt: `{prompt}`

## Description

<purpose and value for users>

## User Story

As a <user>, I want to take <action> so that I get <benefit>

## Problem and Solution

- **Problem:** <what it addresses>
- **Solution:** <proposed approach>

## Relevant Files

- <path>: <why>. (Include new files in "New Files" if applicable.)

## Implementation Plan

### Phase 1: Foundation

<necessary pre-work>
### Phase 2: Main Implementation
<core work>
### Phase 3: Integration
<how it integrates with existing systems>

## Step-by-Step Tasks

Execute in order. Last step: Execute **Validation Commands**.

### 1. <Task Name>

- <Action>
- <Minimum code if applicable>

### 2. ...

<Repeat as needed. If there is a UI: include a task to create `docs/e2e/test_<name>.md` and validate with E2E.>

## Test Strategy

- **Unit Tests:** <What to test>
- **Frontend (Vitest):** <What to test>
- **Border Cases:** <List>

## Acceptance Criteria

<Specific and measurable list>

## Validation Commands

All must execute without error.

- <List of validation commands> For example: `npm run test:ci>`
- If there is an E2E connection: read `commands/test.md` and execute `docs/e2e/test_<name>.md`

## Notes

<context, dependencies, new libraries>
```

**REQUIRED**: After generating and saving the plan, ensure that the generated plan file exists in the specified directory. If the file does not exist, create it and save the plan.

## Report

- Returns only the path to the plan file.

## Output

**REQUIRED**: After creating and saving the plan in the specified path, the response must be exactly one line with the path to the created file. Nothing else, no quotes or line breaks.

- **Correct**: `{working_directory}/docs/features/feature-name/IMPLEMENTATION_PLAN_feature-name.md`
- **Incorrect**: Including phrases like "The plan is created", "Absolute path to the file:", or using Markdown formatting (bold, backticks). Do not add text before or after the path.

## Output Format

{working_directory}/path/to/plan/file.md

## User prompt
