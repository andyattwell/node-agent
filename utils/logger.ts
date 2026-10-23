import fs from "node:fs";
import path from "node:path";

function getLogPath(): string {
  const dir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function logMessage(message: string, type: "system" | "chat" | "adw" | "chunk" = "system"): void {
  fs.appendFileSync(
    path.join(getLogPath(), `${type}-message.log`),
    `${new Date().toISOString()} - ${message}\n`,
  );
}

export function logError(error: string, type: "system" | "chat" | "adw" | "chunk" = "system"): void {
  fs.appendFileSync(
    path.join(getLogPath(), `${type}-error.log`),
    `${new Date().toISOString()} - ${error}\n`,
  );
}

export default {
  logMessage,
  logError,
};
