import { spawn } from "node:child_process";

/**
 * Yield complete lines from a readable stream (NDJSON), buffering split chunks.
 */
export async function* iterateNdjsonLines(
  readable: NodeJS.ReadableStream | null,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!readable) return;
  let buffer = "";
  for await (const chunk of readable) {
    if (signal?.aborted) break;
    buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line.length > 0) yield line;
    }
  }
  const tail = buffer.replace(/\r$/, "");
  if (tail.length > 0) yield tail;
}

/**
 * Runs a CLI process, gathering all output and providing optional incremental callbacks.
 */
export async function runCliProcess(options: {
  cliPath: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { cliPath, args, cwd, timeoutMs, signal, onStdoutChunk, onStderrChunk } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn(cliPath, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const onAbort = () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    };
    signal?.addEventListener("abort", onAbort);

    proc.stdout?.on("data", (d: Buffer) => {
      const chunk = d.toString();
      stdout += chunk;
      onStdoutChunk?.(chunk);
    });

    proc.stderr?.on("data", (d: Buffer) => {
      const chunk = d.toString();
      stderr += chunk;
      onStderrChunk?.(chunk);
    });

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    proc.on("error", (err) => {
      cleanup();
      reject(err);
    });

    proc.on("close", (code, signalName) => {
      cleanup();
      const exitCode = code ?? (signalName ? 128 + 15 : 1);
      resolve({ exitCode, stdout, stderr });
    });
  });
}

/**
 * Runs a CLI process, reading stdout line-by-line via NDJSON iteration.
 */
export async function runCliStream(options: {
  cliPath: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  onLine?: (line: string) => void;
  onStderr?: (chunk: string) => void;
}): Promise<{ exitCode: number; stderr: string }> {
  const { cliPath, args, cwd, timeoutMs, signal, onLine, onStderr } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn(cliPath, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    const onAbort = () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    };
    signal?.addEventListener("abort", onAbort);

    proc.stderr?.on("data", (d: Buffer) => {
      const chunk = d.toString();
      stderr += chunk;
      onStderr?.(chunk);
    });

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    const closePromise = new Promise<number>((res, rej) => {
      proc.once("error", (err) => {
        cleanup();
        rej(err);
      });
      proc.once("close", (code, signalName) => {
        cleanup();
        res(code ?? (signalName ? 128 + 15 : 1));
      });
    });

    const streamPromise = (async () => {
      for await (const line of iterateNdjsonLines(proc.stdout, signal)) {
        onLine?.(line);
      }
    })();

    void (async () => {
      try {
        const [, exitCode] = await Promise.all([streamPromise, closePromise]);
        resolve({ exitCode, stderr });
      } catch (err) {
        reject(err);
      }
    })();
  });
}
