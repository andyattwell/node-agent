import { Router } from "express";
import { getDB } from "../db.js";
import type { Issue, IssueComment, Project } from "../types.js";
import {
  isIssuePriority,
  isIssueStatus,
  isIssueType,
} from "../lib/issue-constants.js";
import {
  jobExistsForProjectIssue,
  parseOptionalAdwId,
  parsePositiveInt,
} from "../lib/job-api.js";

const router = Router();

router.get("/issues", async (req, res) => {
  const projectIdParam = req.query.project_id;
  if (projectIdParam === undefined || projectIdParam === "") {
    res.status(400).json({ error: "Missing 'project_id' query parameter" });
    return;
  }
  const projectId = parsePositiveInt(projectIdParam);
  if (projectId === null) {
    res.status(400).json({ error: "Invalid 'project_id' query parameter" });
    return;
  }
  const { issueRepo } = await getDB();
  const issues = (await issueRepo.find({
    where: { project_id: projectId },
  })) as Issue[];
  res.json({ issues });
});

router.get("/issues/:issueId/comments", async (req, res) => {
  const issueId = parsePositiveInt(req.params.issueId);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issue id" });
    return;
  }
  const { issueRepo, commentRepo } = await getDB();
  const issue = (await issueRepo.findOne({
    where: { id: issueId },
  })) as Issue | null;
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  const comments = (await commentRepo.find({
    where: { issue_id: issueId },
    order: { created_at: "DESC" },
  })) as IssueComment[];
  res.json({ comments });
});

router.post("/issues/:issueId/comments", async (req, res) => {
  const issueId = parsePositiveInt(req.params.issueId);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issue id" });
    return;
  }
  const body = req.body ?? {};
  const { commenter, comment } = body;
  if (typeof commenter !== "string" || !commenter.trim()) {
    res
      .status(400)
      .json({ error: "Missing or invalid 'commenter' in request body" });
    return;
  }
  if (typeof comment !== "string") {
    res
      .status(400)
      .json({ error: "Missing or invalid 'comment' in request body" });
    return;
  }
  const { issueRepo, commentRepo } = await getDB();
  const issue = (await issueRepo.findOne({
    where: { id: issueId },
  })) as Issue | null;
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  const created = await commentRepo.save({
    commenter: commenter.trim(),
    comment,
    issue_id: issueId,
  });
  res.status(201).json({ comment: created as IssueComment });
});

router.get("/issues/:id", async (req, res) => {
  const issueId = parsePositiveInt(req.params.id);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issue id" });
    return;
  }
  const { issueRepo } = await getDB();
  const issue = (await issueRepo.findOne({
    where: { id: issueId },
  })) as Issue | null;
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  res.json({ issue });
});

router.post("/issues", async (req, res) => {
  const body = req.body ?? {};
  const {
    title,
    description,
    status,
    priority,
    type,
    adw_id: adwIdRaw,
    project_id: projectIdRaw,
    worktree: worktreeRaw,
  } = body;
  const projectId = parsePositiveInt(projectIdRaw);
  if (projectId === null) {
    res
      .status(400)
      .json({ error: 'Invalid or missing "project_id" in request body' });
    return;
  }
  if (typeof title !== "string" || !title.trim()) {
    res
      .status(400)
      .json({ error: "Missing or invalid 'title' in request body" });
    return;
  }
  if (typeof description !== "string") {
    res
      .status(400)
      .json({ error: "Missing or invalid 'description' in request body" });
    return;
  }
  if (typeof status !== "string" || !isIssueStatus(status)) {
    res.status(400).json({ error: "Invalid 'status' in request body" });
    return;
  }
  if (typeof priority !== "string" || !isIssuePriority(priority)) {
    res.status(400).json({ error: "Invalid 'priority' in request body" });
    return;
  }
  if (typeof type !== "string" || !isIssueType(type)) {
    res.status(400).json({ error: "Invalid 'type' in request body" });
    return;
  }
  const parsedAdw = parseOptionalAdwId(adwIdRaw);
  if (!parsedAdw.ok) {
    res.status(400).json({ error: 'Invalid "adw_id" in request body' });
    return;
  }
  const adw_id = parsedAdw.value;
  const { projectRepo, issueRepo } = await getDB();
  const project = (await projectRepo.findOne({
    where: { id: projectId },
  })) as Project | null;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (adw_id !== null) {
    const ok = await jobExistsForProjectIssue(projectId, adw_id);
    if (!ok) {
      res.status(400).json({
        error: "No job with this adw_id exists for this project",
      });
      return;
    }
  }
  const worktree =
    typeof worktreeRaw === "boolean" ? worktreeRaw : true;
  const now = new Date().toISOString();
  const created = await issueRepo.save({
    title: title.trim(),
    description,
    status,
    priority,
    type,
    adw_id,
    project_id: projectId,
    worktree,
    updated_at: now,
  });
  res.status(201).json({ issue: created as Issue });
});

router.put("/issues/:id", async (req, res) => {
  const issueId = parsePositiveInt(req.params.id);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issue id" });
    return;
  }
  const { issueRepo, projectRepo } = await getDB();
  const existing = (await issueRepo.findOne({
    where: { id: issueId },
  })) as Issue | null;
  if (!existing) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  const body = req.body ?? {};
  const partial: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      res.status(400).json({ error: "Invalid 'title' in request body" });
      return;
    }
    partial.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      res.status(400).json({ error: "Invalid 'description' in request body" });
      return;
    }
    partial.description = body.description;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isIssueStatus(body.status)) {
      res.status(400).json({ error: "Invalid 'status' in request body" });
      return;
    }
    partial.status = body.status;
  }
  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !isIssuePriority(body.priority)) {
      res.status(400).json({ error: "Invalid 'priority' in request body" });
      return;
    }
    partial.priority = body.priority;
  }
  if (body.type !== undefined) {
    if (typeof body.type !== "string" || !isIssueType(body.type)) {
      res.status(400).json({ error: "Invalid 'type' in request body" });
      return;
    }
    partial.type = body.type;
  }
  if (body.worktree !== undefined) {
    if (typeof body.worktree !== "boolean") {
      res.status(400).json({ error: "Invalid 'worktree' in request body" });
      return;
    }
    partial.worktree = body.worktree;
  }
  let nextProjectId = existing.project_id;
  if (body.project_id !== undefined) {
    const pid = parsePositiveInt(body.project_id);
    if (pid === null) {
      res.status(400).json({ error: 'Invalid "project_id" in request body' });
      return;
    }
    const project = (await projectRepo.findOne({
      where: { id: pid },
    })) as Project | null;
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    partial.project_id = pid;
    nextProjectId = pid;
  }
  let nextAdwId: string | null = existing.adw_id;
  if (body.adw_id !== undefined) {
    const parsed = parseOptionalAdwId(body.adw_id);
    if (!parsed.ok) {
      res.status(400).json({ error: 'Invalid "adw_id" in request body' });
      return;
    }
    partial.adw_id = parsed.value;
    nextAdwId = parsed.value;
  }
  if (Object.keys(partial).length === 0) {
    res
      .status(400)
      .json({ error: "At least one field must be provided to update" });
    return;
  }
  if (nextAdwId !== null) {
    const ok = await jobExistsForProjectIssue(nextProjectId, nextAdwId);
    if (!ok) {
      res.status(400).json({
        error: "No job with this adw_id exists for this project",
      });
      return;
    }
  }
  partial.updated_at = new Date().toISOString();
  await issueRepo.update(issueId, partial);
  const issue = (await issueRepo.findOne({ where: { id: issueId } })) as Issue;
  res.json({ issue });
});

router.delete("/issues/:id", async (req, res) => {
  const issueId = parsePositiveInt(req.params.id);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issue id" });
    return;
  }
  const { issueRepo } = await getDB();
  const result = await issueRepo.delete({ id: issueId });
  if ((result.affected ?? 0) === 0) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  res.json({ status: "deleted", id: issueId });
});

router.get("/comments/:id", async (req, res) => {
  const commentId = parsePositiveInt(req.params.id);
  if (commentId === null) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }
  const { commentRepo } = await getDB();
  const comment = (await commentRepo.findOne({
    where: { id: commentId },
  })) as IssueComment | null;
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  res.json({ comment });
});

router.put("/comments/:id", async (req, res) => {
  const commentId = parsePositiveInt(req.params.id);
  if (commentId === null) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }
  const { commentRepo } = await getDB();
  const existing = (await commentRepo.findOne({
    where: { id: commentId },
  })) as IssueComment | null;
  if (!existing) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  const body = req.body ?? {};
  const partial: Record<string, unknown> = {};
  if (body.commenter !== undefined) {
    if (typeof body.commenter !== "string" || !body.commenter.trim()) {
      res.status(400).json({ error: "Invalid 'commenter' in request body" });
      return;
    }
    partial.commenter = body.commenter.trim();
  }
  if (body.comment !== undefined) {
    if (typeof body.comment !== "string") {
      res.status(400).json({ error: "Invalid 'comment' in request body" });
      return;
    }
    partial.comment = body.comment;
  }
  if (Object.keys(partial).length === 0) {
    res
      .status(400)
      .json({ error: "At least one field must be provided to update" });
    return;
  }
  await commentRepo.update(commentId, partial);
  const comment = (await commentRepo.findOne({
    where: { id: commentId },
  })) as IssueComment;
  res.json({ comment });
});

router.delete("/comments/:id", async (req, res) => {
  const commentId = parsePositiveInt(req.params.id);
  if (commentId === null) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }
  const { commentRepo } = await getDB();
  const result = await commentRepo.delete({ id: commentId });
  if ((result.affected ?? 0) === 0) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  res.json({ status: "deleted", id: commentId });
});

export default router;
