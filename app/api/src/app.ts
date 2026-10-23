import "reflect-metadata";
import { join } from "path";
import { config } from "dotenv";
import express from "express";
import cors from "cors";
import { corsOptions } from "./config.js";
import { getProjectRoot } from "./utils.js";
import healthRouter from "./routes/health.js";
import chatsRouter from "./routes/chats.js";
import miscRouter from "./routes/misc.js";
import projectsRouter from "./routes/projects.js";
import issuesRouter from "./routes/issues.js";
import jobsRouter from "./routes/jobs.js";
import agentRouter from "./routes/agent.js";
import adwRouter from "./routes/adw.js";

config({ path: join(getProjectRoot(), ".env") });
config({ path: join(process.cwd(), ".env") });

if (!process.env.PROJECT_ROOT) {
  process.env.PROJECT_ROOT = getProjectRoot();
}

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use(cors(corsOptions));

  app.use(healthRouter);
  app.use(chatsRouter);
  app.use(miscRouter);
  app.use(projectsRouter);
  app.use(issuesRouter);
  app.use(jobsRouter);
  app.use(agentRouter);
  app.use(adwRouter);
  return app;
}
