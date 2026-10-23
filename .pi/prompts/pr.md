# Generating Pull Request Title and Description

## Description

Generates a **title** for the pull request in the format: `<issue_type>: #<issue_number> - <issue_title>`

Generates a **description** for the pull request based on the commits of the current working branch, referencing @pull_request_template.md.

**IMPORTANT**: All work must be done in $WORKING_DIRECTORY.

**REQUIRED**: The generated description **must be saved** in the path:
`$STATE_DIR/pull_request/pr_description.md`
Do not finish until you have written the file to this path.

## Generation Process

### 1. Commit Analysis

- Review the commit history and modified files of the current branch

1. Run `git diff origin/main...HEAD --stat` to see a summary of modified files

2. Run `git log origin/main..HEAD --oneline` to see the commits to be included

3. Run `git diff origin/main...HEAD --name-only` to get a list of modified files.

4. Run `git push -u origin <branch_name>` to push the branch.

- Identify the type of changes made
- Categorize the modifications by area (frontend, backend, etc.)

### 2. Description Structure

- Follow the pull request template format
- Complete all relevant sections
- Include specific information about the changes

### 3. Change Categorization

- Determine the main type of change
- Identify modified components and files
- Document new features or fixes

## Pull Request Template

### Required Sections

- **Description**: Clear summary of the changes
- **Type of Change**: Main category (feat, fix, refactor, etc.)
- **Changes Made**: Detailed list of modifications
- **Testing**: Status of tests performed
- **Checklist**: Quality checks

### Optional Sections

- **Screenshots/Videos**: Visual evidence of changes
- \*\*Notes Additional Information: Supplementary Information
- Related Issues: References to tickets or problems

## Commit Analysis

### Types of Commits to Consider

- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Maintenance tasks

### Categorization by Area

- **Frontend:** React components, pages, hooks
- **Backend:** APIs, migrations, functions
- **Infrastructure:** Configuration, deployment
- **Documentation:** README, ADRs, comments

## Example of a Generated Description

```markdown
# <issue_title>

## 📋 Description

Implementation of the authentication system, including login form, validations, and redirection to the dashboard.

## 🔄 Changes Made

### Frontend

- [x] LoginForm component created with Ant Design
- [x] Email and password field validation
- [x] Integration with OAuth

### Backend

- [x] Auth configuration
- [x] Environment variables configured
```

## References

### pull_request_template.md

- Standard structure for pull requests.

- Required and optional sections.

## Output

**REQUIRED**: The command output must be **exclusively** valid JSON with exactly two fields: `title` and `description_path`. Do not include any Markdown formatting (bold, backticks). Do not include any additional text before or after the JSON.

- **title**: The generated title for the pull request.

- **description_path**: The path where the description was saved (relative to $PROJECT_ROOT). It must match the path where you wrote the file, e.g., `$STATE_DIR/pull_resquest/pr_description.md`.

### Output Format

{
"title": "feat: #42 - Implement login with auth",
"description_path": "state/adw-123/pull_request/pr_description.md"
}
