import { Router } from "express";
import { getDB } from "../db.js";
import type { Project } from "../types.js";
import { parsePositiveInt } from "../lib/job-api.js";

const router = Router();

router.get("/projects", async (_req, res) => {
  const { projectRepo } = await getDB();
  const projects = (await projectRepo.find()) as Project[];
  res.json({ projects });
});

router.get("/projects/:id", async (req, res) => {
  const projectId = parsePositiveInt(req.params.id);
  if (projectId === null) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const { projectRepo } = await getDB();
  const project = (await projectRepo.findOne({ where: { id: projectId } })) as
    | Project
    | undefined
    | null;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ project });
});

router.post("/projects", async (req, res) => {
  const {
    name,
    workdir,
    repository,
    base_branch,
    credentials,
    ai_provider,
    ai_path,
    ai_model,
  } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res
      .status(400)
      .json({ error: "Missing or invalid 'name' in request body" });
    return;
  }
  const { projectRepo } = await getDB();
  const created = await projectRepo.save({
    name: name.trim(),
    workdir: workdir ?? null,
    repository: repository ?? null,
    base_branch: base_branch ?? null,
    credentials: credentials ?? null,
    ai_provider: ai_provider ?? null,
    ai_path: ai_path ?? null,
    ai_model: ai_model ?? null,
  });
  res.status(201).json({ project: created });
});

router.put("/projects/:id", async (req, res) => {
  const projectId = parsePositiveInt(req.params.id);
  if (projectId === null) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const { projectRepo } = await getDB();
  const existing = (await projectRepo.findOne({ where: { id: projectId } })) as
    | Project
    | undefined
    | null;
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const {
    name,
    workdir,
    repository,
    base_branch,
    credentials,
    ai_provider,
    ai_path,
    ai_model,
  } = req.body ?? {};
  const partial: Record<string, unknown> = {};
  if (typeof name === "string") {
    if (!name.trim()) {
      res.status(400).json({ error: "Invalid 'name' in request body" });
      return;
    }
    partial.name = name.trim();
  }
  if (workdir !== undefined) partial.workdir = workdir ?? null;
  if (repository !== undefined) partial.repository = repository ?? null;
  if (base_branch !== undefined) partial.base_branch = base_branch ?? null;
  if (credentials !== undefined) partial.credentials = credentials ?? null;
  if (ai_provider !== undefined) partial.ai_provider = ai_provider ?? null;
  if (ai_path !== undefined) partial.ai_path = ai_path ?? null;
  if (ai_model !== undefined) partial.ai_model = ai_model ?? null;
  if (Object.keys(partial).length === 0) {
    res
      .status(400)
      .json({ error: "At least one field must be provided to update" });
    return;
  }
  await projectRepo.update(projectId, partial);
  const project = (await projectRepo.findOne({
    where: { id: projectId },
  })) as Project;
  res.json({ project });
});

router.delete("/projects/:id", async (req, res) => {
  const projectId = parsePositiveInt(req.params.id);
  if (projectId === null) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const { projectRepo, jobRepo, issueRepo } = await getDB();
  await issueRepo.delete({ project_id: projectId });
  await jobRepo.update({ project_id: projectId }, { project_id: null });
  const result = await projectRepo.delete({ id: projectId });
  if ((result.affected ?? 0) === 0) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ status: "deleted", id: projectId });
});

export default router;
