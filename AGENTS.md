## Project Architecture

Architectural decisions affect how the project structure and logic work together.

- **Architectural decisions** are made that affect the project structure
- [ ] Code follows project conventions
- Maintain README as the primary source of truth for project setup

## Environment Configuration

### .env (Project Configuration)
The following variables are configured to connect to your ClickUp instance and manage project state.

```bash
# ClickUp Configuration
CLICKUP_PROJECT_ID=your-project-id
CLICKUP_API_TOKEN=your-api-token

# Project Configuration
PROJECT_ROOT=<project-root>

# Database Configuration
DATABASE_PATH=<project-root>/app/api/data/jobs.sqlite
```

## Project Structure

### Main Project

- **Project Root**: `<project-root>` (where CLI and API scripts live)
- **API Route**: `<project-root>/app/api` (handles API requests)
- **Client Application**: `<project-root>/app/client` (React frontend)

### ClickUp Integration

- **Task Management**: ClickUp tasks are managed via ClickUp Personal Token
- **Task IDs**: Retrieved from list ID (number after `/li` in ClickUp list URL)
- **Include Options**: Can include closed tasks (`includeClosed`) or subtasks (`subtasks`)

## Database Schema

### Jobs Table

The `jobs` table in the SQLite database manages:

- **project_id**: Links each job to a specific project
- **adw_id**: AdHoc Work ID tracking the project reference
- **status**: Task status (pending, completed, etc.)
- **prompt**: The prompt text for the task
- **created_at** / **updated_at**: Timestamps for tracking job lifecycle

## Environment Configuration

### Node Project Configuration

- **Scripts Directory**: Contains entry point scripts for CLI execution
- **State Directory**: Stores project state under `state/<adw_id>/`
- **Dist Directory**: Contains compiled JavaScript for the API
- **main.ts**: Entry point for the project execution

### API Server Configuration

- **getProjectRoot()**: Returns the root directory where main.ts lives
- **DATABASE_PATH**: Ensures database paths are resolved relative to project root when API runs

## Testing

- **Vitest Configuration**: Configured for testing (vitest.config.ts)
- **TypeScript Configuration**: Type definitions and testing configuration (tsconfig.json)
