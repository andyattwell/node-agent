import { DataSource } from "typeorm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Job } from "./entities/Job.js";
import { Project } from "./entities/Project.js";
import { ChatSession } from "./entities/ChatSession.js";
import { ChatMessage } from "./entities/ChatMessage.js";
import { Issue } from "./entities/Issue.js";
import { Comment } from "./entities/Comment.js";

/**
 * Repo root (node-agent) inferred from this file so DATABASE_PATH resolves
 * before dotenv runs (ESM import order) and without relying on process.cwd().
 */
function inferNodeAgentRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const parentName = path.basename(path.dirname(here));
  return parentName === "dist"
    ? path.resolve(here, "../../..")
    : path.resolve(here, "../..");
}

let cachedDbPath: string | null = null;
let appDataSource: DataSource | null = null;

/**
 * Resolved SQLite path; computed on first use so env and PROJECT_ROOT are
 * loaded before resolution (fixes API vs ADW using different DB files).
 */
export function getDbPath(): string {
  if (!cachedDbPath) {
    const raw = (process.env.DATABASE_PATH ?? ".data/jobs.sqlite").trim();
    const base = (process.env.PROJECT_ROOT ?? inferNodeAgentRoot()).trim();
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(base, raw);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cachedDbPath = resolved;
  }
  return cachedDbPath;
}

export async function getDataSource(): Promise<DataSource> {
  if (!appDataSource) {
    appDataSource = new DataSource({
      type: "better-sqlite3",
      database: getDbPath(),
      entities: [Job, Project, ChatSession, ChatMessage, Issue, Comment],
      synchronize: true,
    });
    await appDataSource.initialize();
  }
  return appDataSource;
}
