import type { Tool } from "../../providers/utils/chat-types.js";
import DB, { getDataSource } from "../db.js";
import type { Job, Project } from "../db.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { WorkflowState } from "../workflow-state.js";
import { Project as ProjectEntity } from "../entities/Project.js";

/** Project root (where main.ts and package.json "start" script live). */
export const getProjectRoot = (): string => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, "..");
};

const DEFAULT_BASE_BRANCH = "main";
const DEFAULT_WORKDIR = join(getProjectRoot(), "development");

export async function getProjects(): Promise<
  Record<string, unknown>[] | string
> {
  const result = await DB.getAllRecords("projects");
  if (result instanceof Error) {
    return `Error getting projects: ${result.message}`;
  }
  return (result as Record<string, unknown>[]).map((project) => {
    return {
      id: project.id,
      name: project.name,
    };
  });
}

function getJobState(adwId: string): WorkflowState | null {
  const repoRoot = getProjectRoot();
  const statePath = join(repoRoot, "state", adwId, "state.json");
  if (!fs.existsSync(statePath)) {
    return null;
  }
  const raw = fs.readFileSync(statePath, "utf8");
  const jobState = JSON.parse(raw) as WorkflowState;
  return {
    currentStep: jobState.currentStep,
    workPath: jobState.workPath,
    useGitWorktree: jobState.useGitWorktree,
    branchName: jobState.branchName,
    adwId: jobState.adwId,
    prompt: jobState.prompt,
    promptPath: jobState.promptPath,
    testRetries: jobState.testRetries,
    issueClass: jobState.issueClass,
    planPath: jobState.planPath,
    implementationSummaryPath: jobState.implementationSummaryPath,
    currentPromptPath: jobState.currentPromptPath,
    prUrl: jobState.prUrl,
    prId: jobState.prId,
    reviewRetries: jobState.reviewRetries,
    errorDocumentPath: jobState.errorDocumentPath,
    testResultsPath: jobState.testResultsPath,
  };
}

async function getProjectJobs(
  projectId: number,
): Promise<Record<string, unknown>[] | Error> {
  const projectJobs = await DB.findRecords("jobs", "project_id", projectId);
  if (projectJobs instanceof Error) {
    return projectJobs;
  }
  return (projectJobs as Record<string, unknown>[]).map(
    (job: Record<string, unknown>) => {
      const prompt =
        (job.prompt as string).slice(0, 100) +
        ((job.prompt as string).length > 100 ? "..." : "");
      return {
        id: job.id,
        adw_id: job.adw_id,
        step: job.step,
        status: job.status,
        prompt: prompt,
      };
    },
  );
}

export async function getJob(
  field: string,
  value: string,
): Promise<Record<string, unknown> | string> {
  const result = await DB.findRecordBy("jobs", field, value);
  if (result instanceof Error) {
    return `Error getting job: ${result.message}`;
  }
  if (!result) {
    return "Job not found";
  }
  const job = result as unknown as Record<string, unknown>;
  return {
    id: job.id,
    adw_id: job.adw_id,
    step: job.step,
    status: job.status,
    prompt: job.prompt,
    created_at: job.created_at,
    started_at: job.started_at,
    updated_at: job.updated_at,
    process_id: job.process_id,
    state: getJobState(job.adw_id as string),
  };
}

export async function getProject(
  field: string,
  value: string,
): Promise<Project | string> {
  const result = await DB.findRecordBy("projects", field, value);
  if (result instanceof Error) {
    return `Error getting project: ${result.message}`;
  }
  if (!result) {
    return "Project not found";
  }
  const project = result as unknown as Project;
  let projectJobs = await getProjectJobs(project.id);
  if (projectJobs instanceof Error) {
    projectJobs = [
      { error: `Error getting project jobs: ${projectJobs.message}` },
    ];
  }

  return {
    id: project.id,
    name: project.name,
    jobs: projectJobs as unknown as Job[],
    workdir: project.workdir,
    repository: project.repository,
    base_branch: project.base_branch,
    credentials: project.credentials ? "******" : null,
    ai_provider: project.ai_provider,
    ai_path: project.ai_path,
    ai_model: project.ai_model,
    created_at: project.created_at,
  };
}

export async function createProject(
  name: string,
  workdir?: string,
  repository?: string,
  base_branch?: string,
  credentials?: string,
  ai_provider?: string,
  ai_path?: string,
  ai_model?: string,
): Promise<Project | string> {
  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(ProjectEntity);
    const created = await repo.save({
      name,
      workdir: workdir ?? DEFAULT_WORKDIR,
      repository: repository ?? "",
      base_branch: base_branch ?? DEFAULT_BASE_BRANCH,
      credentials: credentials ?? "",
      ai_provider: ai_provider ?? null,
      ai_path: ai_path ?? null,
      ai_model: ai_model ?? null,
    } as Partial<ProjectEntity>);
    return created;
  } catch (error) {
    fs.writeFileSync("error1.log", JSON.stringify(error, null, 2));
    return `Error creating project: ${error}`;
  }
}

export async function updateProject(project: Project): Promise<Project> {
  const result = await DB.updateRecord(
    "projects",
    project.id,
    project as unknown as Record<string, unknown>,
  );
  if (result instanceof Error || result === undefined) {
    throw result instanceof Error ? result : new Error("Update failed");
  }
  return result as unknown as Project;
}

export async function deleteProject(
  field: string,
  value: string,
): Promise<string> {
  const result = await DB.deleteRecordByField("projects", field, value);
  if (result instanceof Error) {
    return result.message;
  }
  return result as string;
}

export const PROJECTS_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "getProjects",
      description: "Return the list of projects",
      parameters: {
        type: "object",
        required: ["_"],
        properties: {
          _: {
            type: "string",
            description: "Random string.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProject",
      description: "Return a project by a field and value",
      parameters: {
        type: "object",
        required: ["field", "value"],
        properties: {
          field: {
            type: "string",
            description: "The field of the project to get by",
            enum: ["id", "name"],
          },
          value: {
            type: "string",
            description: "The value of the field to get by",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProjectJobs",
      description: "Return the jobs of a project by a field and value",
      parameters: {
        type: "object",
        required: ["field", "value"],
        properties: {
          field: {
            type: "string",
            description: "The field of the project to get the jobs by",
            enum: ["id", "name"],
          },
          value: {
            type: "string",
            description: "The value of the field to get the jobs by",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createProject",
      description: "Create a new project",
      parameters: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            description: "The name of the project",
          },
          workdir: {
            type: "string",
            description: "The work directory of the project",
          },
          repository: {
            type: "string",
            description: "The repository of the project",
          },
          base_branch: {
            type: "string",
            description: "The base branch of the project",
          },
          credentials: {
            type: "string",
            description: "The credentials of the project",
          },
          ai_provider: {
            type: "string",
            description:
              "ADW AI provider override (cursor, ollama, claude, llama_cpp, gemini, none)",
          },
          ai_path: {
            type: "string",
            description: "ADW_AI_PATH equivalent (CLI path or base URL)",
          },
          ai_model: {
            type: "string",
            description: "ADW_AI_MODEL equivalent",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateProject",
      description: "Update a project",
      parameters: {
        type: "object",
        required: [
          "id",
          "name",
          "workdir",
          "repository",
          "base_branch",
          "credentials",
        ],
        properties: {
          id: {
            type: "number",
            description: "The id of the project",
          },
          name: {
            type: "string",
            description: "The name of the project",
          },
          workdir: {
            type: "string",
            description: "The work directory of the project",
          },
          repository: {
            type: "string",
          },
          base_branch: {
            type: "string",
            description: "The base branch of the project",
          },
          credentials: {
            type: "string",
            description: "The credentials of the project",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteProject",
      description:
        "Delete a project by a field and value. The field can be id or name. ",
      parameters: {
        type: "object",
        required: ["field", "value"],
        properties: {
          field: {
            type: "string",
            description: "The field of the project to delete by",
            enum: ["id", "name"],
          },
          value: {
            type: "string",
            description: "The value of the field to delete by",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getJob",
      description: "Return a project's job by a field and value",
      parameters: {
        type: "object",
        required: ["field", "value"],
        properties: {
          field: {
            type: "string",
            description: "The field of the job to get by",
            enum: ["id", "adw_id"],
          },
          value: {
            type: "string",
            description: "The value of the field to get by",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getJobState",
      description: "Return the state of a project's job by adw_id",
      parameters: {
        type: "object",
        required: ["adw_id"],
        properties: {
          adw_id: {
            type: "string",
            description: "The adw_id of the project's job to get the state by",
          },
        },
      },
    },
  },
];

export default {
  TOOLS: PROJECTS_TOOLS,
  toolFunctions: {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    getJob,
    getJobState,
    getProjectJobs,
  },
};
