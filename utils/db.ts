import path from "node:path";
import fs from "node:fs";
import { getDataSource, getDbPath } from "./data-source.js";
import { Job as JobEntity } from "./entities/Job.js";
import { Project as ProjectEntity } from "./entities/Project.js";

export { getDbPath, getDataSource } from "./data-source.js";
export {
  Job as JobEntityClass,
  Project as ProjectEntityClass,
  Issue as IssueEntityClass,
  Comment as CommentEntityClass,
  ChatSession,
  ChatMessage,
} from "./entities/index.js";

export interface JobState {
  statePath: string;
  pid: number;
  status?: "running" | "stopped";
  currentStep: string;
  workPath: string;
  branchName: string;
  adwId: string;
  prompt: string;
  promptPath: string;
  testRetries: number;
  issueClass: string;
  planPath: string;
  implementationSummaryPath: string;
  currentPromptPath: string;
  prUrl: string;
  prId: number;
  reviewRetries: number;
  testResultsPath: string;
  outputLogPath: string;
  errorLogPath: string;
}

export interface Run {
  name: string;
  content: RunContent[];
}

export interface RunContent {
  type: "text" | "tool_use" | "tool_result" | "result";
  id: string;
  name: string;
  input: { command: string; description: string };
  content: string;
}

export interface Job {
  id: number;
  adw_id: string;
  step: string | null;
  status: string;
  prompt: string;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  process_id: number | null;
  project_id: number | null;
  issue_id: number | null;
  state_snapshot: string | null;
  state?: JobState;
  runs?: { name: string; content: Run[] }[];
}

export interface JobUpdateFields {
  adw_id?: string | null;
  step?: string | null;
  status?: string;
  started_at?: string | null;
  process_id?: number | null;
  project_id?: number | null;
  issue_id?: number | null;
  prompt?: string;
  state_snapshot?: string | null;
}

export interface Project {
  id: number;
  name: string;
  workdir: string | null;
  repository: string | null;
  base_branch: string | null;
  credentials: string | null;
  ai_provider: string | null;
  ai_path: string | null;
  ai_model: string | null;
  created_at: string;
  jobs?: Job[];
}

function logSql(line: string): void {
  const dir = path.join(path.dirname(getDbPath()), "logs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(
    path.join(dir, "sql.log"),
    `${new Date().toISOString()} - ${line}\n`,
  );
}

function entityToRecord(
  entity: Record<string, unknown>,
): Record<string, unknown> {
  return { ...entity };
}

export async function createRecord(
  table: string,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined | Error> {
  const ds = await getDataSource();
  try {
    if (table === "jobs") {
      const repo = ds.getRepository(JobEntity);
      const created = await repo.save(fields as Partial<JobEntity>);
      logSql(`INSERT jobs: ${JSON.stringify(created)}`);
      return entityToRecord(created as unknown as Record<string, unknown>);
    }
    if (table === "projects") {
      const repo = ds.getRepository(ProjectEntity);
      const created = await repo.save(fields as Partial<ProjectEntity>);
      logSql(`INSERT projects: ${JSON.stringify(created)}`);
      return entityToRecord(created as unknown as Record<string, unknown>);
    }
    throw new Error(`Unknown table: ${table}`);
  } catch (error: unknown) {
    logSql(`ERROR: ${JSON.stringify(error, null, 2)}`);
    return error as Error;
  }
}

export async function updateRecord(
  table: string,
  id: number,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined | Error> {
  const ds = await getDataSource();
  try {
    if (table === "jobs") {
      const repo = ds.getRepository(JobEntity);
      await repo.update(id, fields as Partial<JobEntity>);
      const found = await repo.findOne({ where: { id } });
      if (!found) return undefined;
      logSql(`UPDATE jobs id=${id}`);
      return entityToRecord(found as unknown as Record<string, unknown>);
    }
    if (table === "projects") {
      const repo = ds.getRepository(ProjectEntity);
      await repo.update(id, fields as Partial<ProjectEntity>);
      const found = await repo.findOne({ where: { id } });
      if (!found) return undefined;
      logSql(`UPDATE projects id=${id}`);
      return entityToRecord(found as unknown as Record<string, unknown>);
    }
    throw new Error(`Unknown table: ${table}`);
  } catch (error: unknown) {
    logSql(`ERROR: ${JSON.stringify(error, null, 2)}`);
    return error as Error;
  }
}

export async function findRecordBy(
  table: string,
  key: string,
  value: unknown,
): Promise<Record<string, unknown> | unknown> {
  const ds = await getDataSource();
  try {
    if (table === "jobs") {
      const repo = ds.getRepository(JobEntity);
      const found = await repo.findOne({
        where: { [key]: value } as Record<string, unknown>,
      });
      logSql(`RECORD: ${JSON.stringify(found, null, 2)}`);
      return found
        ? entityToRecord(found as unknown as Record<string, unknown>)
        : undefined;
    }
    if (table === "projects") {
      const repo = ds.getRepository(ProjectEntity);
      const found = await repo.findOne({
        where: { [key]: value } as Record<string, unknown>,
      });
      logSql(`RECORD: ${JSON.stringify(found, null, 2)}`);
      return found
        ? entityToRecord(found as unknown as Record<string, unknown>)
        : undefined;
    }
    throw new Error(`Unknown table: ${table}`);
  } catch (error: unknown) {
    logSql(`ERROR: ${JSON.stringify(error, null, 2)}`);
    return error;
  }
}

export async function findRecord(
  table: string,
  field: string,
  id: number,
): Promise<Record<string, unknown> | unknown> {
  return findRecordBy(table, field, id);
}

export async function getAllRecords(
  table: string,
): Promise<Record<string, unknown>[] | Error> {
  const ds = await getDataSource();
  try {
    if (table === "jobs") {
      const repo = ds.getRepository(JobEntity);
      const all = await repo.find();
      return all as unknown as Record<string, unknown>[];
    }
    if (table === "projects") {
      const repo = ds.getRepository(ProjectEntity);
      const all = await repo.find();
      return all as unknown as Record<string, unknown>[];
    }
    throw new Error(`Unknown table: ${table}`);
  } catch (error: unknown) {
    logSql(`ERROR: ${JSON.stringify(error, null, 2)}`);
    return error as Error;
  }
}

export async function findRecords(
  table: string,
  field: string,
  value: unknown,
): Promise<Record<string, unknown>[] | Error> {
  const ds = await getDataSource();
  try {
    if (table === "jobs") {
      const repo = ds.getRepository(JobEntity);
      const list = await repo.find({
        where: { [field]: value } as Record<string, unknown>,
      });
      logSql(`RECORDS: ${JSON.stringify(list, null, 2)}`);
      return list as unknown as Record<string, unknown>[];
    }
    if (table === "projects") {
      const repo = ds.getRepository(ProjectEntity);
      const list = await repo.find({
        where: { [field]: value } as Record<string, unknown>,
      });
      logSql(`RECORDS: ${JSON.stringify(list, null, 2)}`);
      return list as unknown as Record<string, unknown>[];
    }
    throw new Error(`Unknown table: ${table}`);
  } catch (error: unknown) {
    logSql(`ERROR: ${JSON.stringify(error, null, 2)}`);
    return error as Error;
  }
}

export async function deleteRecordByField(
  table: string,
  field: string,
  value: unknown,
): Promise<string | Error> {
  if (field === undefined || field === null) {
    return "Error: Field is undefined";
  }
  if (value === undefined || value === null) {
    return "Error: Value is null";
  }
  const ds = await getDataSource();
  try {
    if (table === "jobs") {
      const repo = ds.getRepository(JobEntity);
      const result = await repo.delete({ [field]: value } as Record<
        string,
        unknown
      >);
      logSql(`DELETE FROM ${table} WHERE ${field} = ${value}`);
      const affected = result.affected ?? 0;
      if (affected === 0)
        return `Failed to delete record from ${table} with ${field} ${value}: No changes made`;
      return `Record deleted from ${table} with ${field} ${value}: ${affected} rows affected`;
    }
    if (table === "projects") {
      const repo = ds.getRepository(ProjectEntity);
      const result = await repo.delete({ [field]: value } as Record<
        string,
        unknown
      >);
      logSql(`DELETE FROM ${table} WHERE ${field} = ${value}`);
      const affected = result.affected ?? 0;
      if (affected === 0)
        return `Failed to delete record from ${table} with ${field} ${value}: No changes made`;
      return `Record deleted from ${table} with ${field} ${value}: ${affected} rows affected`;
    }
    throw new Error(`Unknown table: ${table}`);
  } catch (error: unknown) {
    logSql(`ERROR: ${JSON.stringify(error, null, 2)}`);
    return error as Error;
  }
}

export default {
  createRecord,
  updateRecord,
  findRecord,
  findRecordBy,
  findRecords,
  deleteRecordByField,
  getAllRecords,
};
