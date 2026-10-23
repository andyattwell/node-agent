import path from "path";
import { getProjectRoot } from "./utils.js";

export interface ApiRepositories {
  jobRepo: {
    find: (opts?: {
      where?: Record<string, unknown>;
      order?: Record<string, "ASC" | "DESC">;
    }) => Promise<unknown[]>;
    findOne: (opts: {
      where: Record<string, unknown>;
    }) => Promise<unknown | null>;
    save: (entity: unknown) => Promise<unknown>;
    create: (entity: unknown) => unknown;
    update: (
      idOrCriteria: number | Record<string, unknown>,
      partial: Record<string, unknown>,
    ) => Promise<unknown>;
    delete: (
      criteria: Record<string, unknown>,
    ) => Promise<{ affected?: number }>;
  };
  projectRepo: {
    find: (opts?: { where?: Record<string, unknown> }) => Promise<unknown[]>;
    findOne: (opts: {
      where: Record<string, unknown>;
    }) => Promise<unknown | null>;
    save: (entity: unknown) => Promise<unknown>;
    update: (id: number, partial: Record<string, unknown>) => Promise<unknown>;
    delete: (
      criteria: Record<string, unknown>,
    ) => Promise<{ affected?: number }>;
  };
  issueRepo: {
    find: (opts?: { where?: Record<string, unknown> }) => Promise<unknown[]>;
    findOne: (opts: {
      where: Record<string, unknown>;
    }) => Promise<unknown | null>;
    save: (entity: unknown) => Promise<unknown>;
    update: (id: number, partial: Record<string, unknown>) => Promise<unknown>;
    delete: (
      criteria: Record<string, unknown>,
    ) => Promise<{ affected?: number }>;
  };
  commentRepo: {
    find: (opts?: {
      where?: Record<string, unknown>;
      order?: Record<string, string>;
    }) => Promise<unknown[]>;
    findOne: (opts: {
      where: Record<string, unknown>;
    }) => Promise<unknown | null>;
    save: (entity: unknown) => Promise<unknown>;
    update: (id: number, partial: Record<string, unknown>) => Promise<unknown>;
    delete: (
      criteria: Record<string, unknown>,
    ) => Promise<{ affected?: number }>;
  };
  chatSessionRepo: {
    find: (opts?: { order?: Record<string, string> }) => Promise<unknown[]>;
    findOne: (opts: {
      where: Record<string, unknown>;
    }) => Promise<unknown | null>;
    save: (entity: unknown) => Promise<unknown>;
    create: (entity: unknown) => unknown;
    update: (
      criteria: Record<string, unknown>,
      partial: Record<string, unknown>,
    ) => Promise<unknown>;
    delete: (
      criteria: Record<string, unknown>,
    ) => Promise<{ affected?: number }>;
  };
  chatMessageRepo: {
    find: (opts: {
      where: Record<string, unknown>;
      order?: Record<string, string>;
    }) => Promise<unknown[]>;
    save: (
      entityOrEntities: unknown | unknown[],
    ) => Promise<unknown | unknown[]>;
    delete: (criteria: Record<string, unknown>) => Promise<unknown>;
  };
}

let dbPromise: Promise<ApiRepositories> | null = null;

export async function getDB(): Promise<ApiRepositories> {
  if (!dbPromise) {
    const root = getProjectRoot();
    const dbPath = path.join(root, "adw", "dist", "utils", "db.js");
    const mod = await import(dbPath);
    const ds = await mod.getDataSource();
    dbPromise = Promise.resolve({
      jobRepo: ds.getRepository(mod.JobEntityClass),
      projectRepo: ds.getRepository(mod.ProjectEntityClass),
      issueRepo: ds.getRepository(mod.IssueEntityClass),
      commentRepo: ds.getRepository(mod.CommentEntityClass),
      chatSessionRepo: ds.getRepository(mod.ChatSession),
      chatMessageRepo: ds.getRepository(mod.ChatMessage),
    });
  }
  return dbPromise;
}
