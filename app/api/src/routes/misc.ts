import { Router } from "express";
import { readdir, readFile } from "fs/promises";
import fs from "node:fs";
import path from "node:path";
import { getStateDir } from "../utils.js";

const router = Router();

router.get("/states", async (_req, res) => {
  const stateDir = getStateDir();
  try {
    const entries = await readdir(stateDir, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory());
    const results = await Promise.all(
      subdirs.map(async (dir) => {
        const statePath = path.join(stateDir, dir.name, "state.json");
        let runs: { name: string; content: unknown }[] = [];
        try {
          const runsDir = path.join(stateDir, dir.name, "runs");
          const runEntries = await readdir(runsDir, { withFileTypes: true });
          runs = runEntries
            .filter((e) => e.isFile())
            .map((e) => {
              const raw = fs.readFileSync(path.join(runsDir, e.name), "utf-8");
              return { name: e.name, content: JSON.parse(raw).lines };
            })
            .sort();
        } catch {
          // runs directory may not exist
        }
        try {
          const raw = await readFile(statePath, "utf-8");
          const state = JSON.parse(raw) as unknown;
          (state as { outputLogPath: string }).outputLogPath = path.join(
            stateDir,
            dir.name,
            `output.log`,
          );
          (state as { errorLogPath: string }).errorLogPath = path.join(
            stateDir,
            dir.name,
            `error.log`,
          );
          (state as { statePath: string }).statePath = statePath;
          return { id: dir.name, state, runs };
        } catch {
          return { id: dir.name, state: null, path: statePath, runs };
        }
      }),
    );
    res.json({ states: results });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read state directory";
    res.status(500).json({ error: message });
  }
});

router.post("/open-file", (req, res) => {
  const filePath = req.body?.path;
  if (typeof filePath !== "string" || !filePath.trim()) {
    res
      .status(400)
      .json({ error: 'Missing or invalid "path" in request body' });
    return;
  }
  // resolve to state/adwId/filePath
  const resolvedPath = path.resolve(getStateDir(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: "File not found", path: filePath });
    return;
  }
  const contents = fs.readFileSync(resolvedPath, "utf-8");
  res.status(200).json({ status: "opened", message: "File opened", contents });
});

export default router;
