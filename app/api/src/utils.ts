import { spawn } from "child_process";
import { readdir } from "fs/promises";
import path, { join } from "path";
import fs from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Project root (where main.ts and package.json "start" script live). */
export const getProjectRoot = (): string => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, "..", "..", "..");
};

/** Resolves the state directory (project root / state when run from repo root). */
export const getStateDir = (): string => {
  return join(getProjectRoot(), "state");
};

export const getPpid = async (
  pid: number,
): Promise<{ ppid: number; code: number; signal: string }> => {
  const child = spawn("ps", ["-o", "ppid=", "-p", pid.toString()]);

  return new Promise((resolve, reject) => {
    child.stdout?.on("data", (data) => {
      console.log(`stdout: ${data}`);
      resolve({ ppid: Number(data.toString().trim()), code: 0, signal: "" });
    });
    child.stderr?.on("data", (data) => {
      console.error(`stderr: ${data}`);
      reject({ ppid: 0, code: 1, signal: data.toString().trim() });
    });
    child.on("close", (code, signal) => {
      console.log(
        `child process exited with code ${code} and signal ${signal}`,
      );
      resolve({ ppid: 0, code: Number(code), signal: signal ?? "" });
    });
  });
};

export const loadState = (adwId: string, repoRoot: string) => {
  const statePath = path.join(repoRoot, "state", adwId, "state.json");
  if (!fs.existsSync(statePath)) {
    return null;
  }
  const raw = fs.readFileSync(statePath, "utf8");
  return JSON.parse(raw);
};

export const saveState = (adwId: string, state: any, repoRoot: string) => {
  const statePath = path.join(repoRoot, "state", adwId, "state.json");
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
};

export const getRuns = async (adwId: string) => {
  const runsDir = path.join(getStateDir(), adwId, "runs");
  if (!fs.existsSync(runsDir)) {
    return [];
  }
  const runEntries = await readdir(runsDir, { withFileTypes: true });
  return runEntries
    .filter((e) => e.isFile())
    .map((e) => {
      const raw = fs.readFileSync(join(runsDir, e.name), "utf-8");
      return { name: e.name, content: JSON.parse(raw).lines };
    })
    .sort();
};

export const log = (message: string) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  if (!fs.existsSync(path.join(process.cwd(), "logs"))) {
    fs.mkdirSync(path.join(process.cwd(), "logs"), { recursive: true });
  }
  fs.appendFileSync(
    path.join(process.cwd(), "logs", "api.log"),
    `${line}\n`,
    "utf8",
  );
};
