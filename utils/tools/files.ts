import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Tool } from "../../providers/utils/chat-types.js";

/** Default base path for all file operations (env or cwd). */
export function getBasePath(): string {
  const base = process.env.PROJECT_ROOT ?? process.cwd();
  return path.resolve(base);
}

const BASE_PATH = getBasePath();

/** Max size in bytes for readFile (default 5 MB). */
const MAX_READ_SIZE_BYTES = 5 * 1024 * 1024;

/** Max size in bytes for writeFile/modifyFile (default 5 MB). */
const MAX_WRITE_SIZE_BYTES = 5 * 1024 * 1024;

/** Max entries to return from listDirectoryContents (default 500). */
const MAX_LIST_ENTRIES = 500;

/**
 * Resolve a path segment relative to base and ensure it stays under base (no traversal).
 * If the resolved path exists, resolves symlinks and ensures the canonical path is still under base.
 * @returns The safe absolute path, or an error message string.
 */
export function resolveWithinBase(
  pathSegment: string,
  basePath: string = BASE_PATH,
): string {
  try {
    const baseResolved = path.resolve(basePath);
    const resolved = path.resolve(baseResolved, pathSegment);
    const baseNorm = path.normalize(baseResolved) + path.sep;
    const resolvedNorm = path.normalize(resolved);
    if (
      resolvedNorm !== path.normalize(baseResolved) &&
      !resolvedNorm.startsWith(baseNorm)
    ) {
      return `Error: Path is outside allowed base directory`;
    }
    if (!fs.existsSync(resolved)) {
      return resolved;
    }
    const real = fs.realpathSync(resolved);
    if (!fs.existsSync(baseResolved)) {
      return real;
    }
    const baseReal = fs.realpathSync(baseResolved);
    const baseRealNorm = path.normalize(baseReal) + path.sep;
    const realNorm = path.normalize(real);
    if (
      realNorm !== path.normalize(baseReal) &&
      !realNorm.startsWith(baseRealNorm)
    ) {
      return `Error: Resolved path is outside allowed base directory (symlink escape)`;
    }
    return real;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}

function isErrorResult(r: string): boolean {
  return typeof r === "string" && r.startsWith("Error:");
}

/**
 * List the contents of a directory (under base path).
 * @param directory - The directory to list (relative to base or absolute; must be under base).
 * @returns The contents of the directory or an error message.
 */
export function listDirectoryContents(directory: string): string {
  try {
    const dir = resolveWithinBase(directory);
    if (isErrorResult(dir)) return dir;
    if (!fs.existsSync(dir)) return '{"error": "Directory does not exist"}';
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) return '{"error": "Path is not a directory"}';
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const names = entries.slice(0, MAX_LIST_ENTRIES).map((e) => e.name);
    const more =
      entries.length > MAX_LIST_ENTRIES
        ? `\n... and ${entries.length - MAX_LIST_ENTRIES} more`
        : "";
    return "Files: " + names.join("\n") + more;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}

/**
 * Create a directory (under base path).
 * @param pathArg - The path to the directory to create.
 * @returns Result message or error.
 */
export function createDirectory(pathArg: string): string {
  try {
    const resolved = resolveWithinBase(pathArg);
    if (isErrorResult(resolved)) return resolved;
    if (fs.existsSync(resolved)) return "Directory already exists";
    fs.mkdirSync(resolved, { recursive: true });
    return "Directory created";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}

/** Write contents to a file (under base path). Enforces max write size. */
export function writeFile(pathArg: string, contents: string): string {
  try {
    const resolved = resolveWithinBase(pathArg);
    if (isErrorResult(resolved)) return resolved;
    if (contents.length > MAX_WRITE_SIZE_BYTES) {
      return `Error: Contents exceed max write size (${MAX_WRITE_SIZE_BYTES} bytes)`;
    }

    if (!fs.existsSync(path.dirname(resolved))) {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
    }
    fs.writeFileSync(resolved, contents, "utf8");
    return "File written";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}

/** Read contents from a file (under base path). Enforces max read size. */
export function readFile(pathArg: string): string {
  try {
    const resolved = resolveWithinBase(pathArg);
    if (isErrorResult(resolved)) return resolved;
    if (!fs.existsSync(resolved)) return "Error: File does not exist";
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return "Error: Path is not a file";
    if (stat.size > MAX_READ_SIZE_BYTES) {
      return `Error: File exceeds max read size (${MAX_READ_SIZE_BYTES} bytes)`;
    }
    return fs.readFileSync(resolved, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}

/** Overwrite contents of a file (under base path). Enforces max write size. */
export function modifyFile(pathArg: string, contents: string): string {
  try {
    const resolved = resolveWithinBase(pathArg);
    if (isErrorResult(resolved)) return resolved;
    if (contents.length > MAX_WRITE_SIZE_BYTES) {
      return `{"error": "Contents exceed max write size (${MAX_WRITE_SIZE_BYTES} bytes)"}`;
    }
    fs.writeFileSync(resolved, contents, "utf8");
    return '{"result": "File modified"}';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `{"error": "${message}"}`;
  }
}

/** Delete a file or directory (under base path). recursive: if true, delete directory and contents. */
export function deleteFileOrDirectory(
  pathArg: string,
  recursive: boolean = false,
): string {
  try {
    const resolved = resolveWithinBase(pathArg);
    if (isErrorResult(resolved)) return resolved;
    if (!fs.existsSync(resolved))
      return '{"error": "File or directory does not exist"}';
    const stat = fs.statSync(resolved);
    if (stat.isDirectory() && !recursive) {
      return '{"error": "Path is a directory; set recursive to true to delete it"}';
    }
    fs.rmSync(resolved, { recursive: true });
    return '{"result": "File or directory deleted"}';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `{"error": "${message}"}`;
  }
}

/** Copy a file or directory (under base path). */
export function copyFileOrDirectory(
  source: string,
  destination: string,
): string {
  try {
    const src = resolveWithinBase(source);
    if (isErrorResult(src)) return src;
    const dst = resolveWithinBase(destination);
    if (isErrorResult(dst)) return dst;
    if (!fs.existsSync(src)) return '{"error": "Source does not exist"}';
    fs.cpSync(src, dst, { recursive: true });
    return '{"result": "File or directory copied"}';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `{"error": "${message}"}`;
  }
}

/** Move a file or directory (under base path). */
export function moveFileOrDirectory(
  source: string,
  destination: string,
): string {
  try {
    const src = resolveWithinBase(source);
    if (isErrorResult(src)) return src;
    const dst = resolveWithinBase(destination);
    if (isErrorResult(dst)) return dst;
    if (!fs.existsSync(src)) return '{"error": "Source does not exist"}';
    fs.renameSync(src, dst);
    return '{"result": "File or directory moved"}';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `{"error": "${message}"}`;
  }
}

/** Return the current working base path for tools (no arguments). */
export function getWorkingDirectory(): string {
  return BASE_PATH;
}

/** Check if a path exists and whether it is a file or directory. */
export function fileExists(pathArg: string): string {
  try {
    const resolved = resolveWithinBase(pathArg);
    if (isErrorResult(resolved)) return resolved;
    if (!fs.existsSync(resolved)) return '{"error": "Path does not exist"}';
    const stat = fs.statSync(resolved);
    if (stat.isFile()) return '{"result": "file"}';
    if (stat.isDirectory()) return '{"result": "directory"}';
    return '{"result": "other"}';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `{"error": "${message}"}`;
  }
}

/** Max results for searchInFiles. */
const MAX_SEARCH_RESULTS = 200;

/**
 * Search for a pattern in files under a directory (under base path).
 * @param directory - Directory to search in.
 * @param pattern - String or regex pattern to search for.
 * @param filePattern - Optional glob-like suffix (e.g. "*.ts").
 * @param maxResults - Optional cap (default MAX_SEARCH_RESULTS).
 */
export function searchInFiles(
  directory: string,
  pattern: string,
  filePattern?: string,
  maxResults: number = MAX_SEARCH_RESULTS,
): string {
  try {
    const dir = resolveWithinBase(directory);
    if (isErrorResult(dir)) return dir;
    if (!fs.existsSync(dir)) return '{"error": "Directory does not exist"}';
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) return '{"error": "Path is not a directory"}';

    const suffix = filePattern?.trim().startsWith("*")
      ? filePattern.trim().slice(1)
      : filePattern?.trim();
    const results: string[] = [];
    const limit = Math.min(maxResults, MAX_SEARCH_RESULTS);

    function walk(d: string): void {
      if (results.length >= limit) return;
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (results.length >= limit) return;
        const full = path.join(d, e.name);
        if (e.isDirectory()) {
          walk(full);
          continue;
        }
        if (e.isFile() && (suffix == null || e.name.endsWith(suffix))) {
          try {
            const content = fs.readFileSync(full, "utf8");
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length && results.length < limit; i++) {
              if (new RegExp(pattern, "gi").test(lines[i])) {
                results.push(
                  `${full}:${i + 1}: ${lines[i].trim().slice(0, 120)}`,
                );
              }
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    }

    walk(dir);
    if (results.length === 0) return '{"result": "No matches found"}';
    return results.join("\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `{"error": "${message}"}`;
  }
}

export function findInFiles(
  directory: string,
  pattern: string,
  filePattern?: string,
  maxResults: number = MAX_SEARCH_RESULTS,
): string {
  try {
    const dir = resolveWithinBase(directory);
    if (isErrorResult(dir)) return dir;
    if (!fs.existsSync(dir)) return '{"error": "Directory does not exist"}';
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) return '{"error": "Path is not a directory"}';

    // Find using grep -n
    const result = execSync(
      `grep -rnwl "${pattern}" "${dir}" ${filePattern ? `-e "${filePattern}"` : ""}`,
      {
        cwd: dir,
      },
    );
    return JSON.stringify(result.toString(), null, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `{"error": "${message}"}`;
  }
}

export const FILE_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "listDirectoryContents",
      description:
        "List the files in a given directory (under the allowed base path)",
      parameters: {
        type: "object",
        required: ["directory"],
        properties: {
          directory: {
            type: "string",
            description:
              "The path to the directory (relative to base or absolute; must be under base)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createDirectory",
      description: "Create a directory",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "The path of the directory to create",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "writeFile",
      description: "Write contents to a file (overwrites if exists)",
      parameters: {
        type: "object",
        required: ["path", "contents"],
        properties: {
          path: {
            type: "string",
            description: "The path of the file to write",
          },
          contents: {
            type: "string",
            description: "The contents to write",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Read contents from a file",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "The path of the file to read",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "copyFileOrDirectory",
      description: "Copy a file or directory to a destination",
      parameters: {
        type: "object",
        required: ["source", "destination"],
        properties: {
          source: {
            type: "string",
            description: "The path of the source file or directory",
          },
          destination: {
            type: "string",
            description: "The path of the destination",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveFileOrDirectory",
      description: "Move a file or directory to a destination",
      parameters: {
        type: "object",
        required: ["source", "destination"],
        properties: {
          source: {
            type: "string",
            description: "The path of the source file or directory",
          },
          destination: {
            type: "string",
            description: "The path of the destination",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modifyFile",
      description: "Overwrite the contents of an existing file",
      parameters: {
        type: "object",
        required: ["path", "contents"],
        properties: {
          path: {
            type: "string",
            description: "The path of the file to modify",
          },
          contents: {
            type: "string",
            description: "The new contents",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getWorkingDirectory",
      description:
        "Return the current base path (working directory) for file operations. Use this to know the sandbox root. Call with empty string for the single parameter.",
      parameters: {
        type: "object",
        required: ["_"],
        properties: {
          _: {
            type: "string",
            description: "Ignored. Pass empty string.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fileExists",
      description:
        "Check if a path exists and return whether it is a file, directory, or other",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "The path to check",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchInFiles",
      description: "Search for a text pattern in files under a directory",
      parameters: {
        type: "object",
        required: ["directory", "pattern"],
        properties: {
          directory: {
            type: "string",
            description: "The directory to search in",
          },
          pattern: {
            type: "string",
            description: "The string or regex pattern to search for",
          },
          filePattern: {
            type: "string",
            description:
              "Optional file suffix filter (e.g. *.ts for TypeScript files)",
          },
          maxResults: {
            type: "number",
            description: "Optional maximum number of matches to return",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteFileOrDirectory",
      description:
        "Delete a file or directory. For directories, set recursive to true.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "The path of the file or directory to delete",
          },
          recursive: {
            type: "boolean",
            description:
              "If true, delete a directory and its contents; default false",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findInFiles",
      description: "Search for a text pattern in files under a directory",
      parameters: {
        type: "object",
        required: ["directory", "pattern"],
        properties: {
          directory: {
            type: "string",
            description: "The directory to search in",
          },
          pattern: {
            type: "string",
            description: "The string or regex pattern to search for",
          },
          filePattern: {
            type: "string",
            description:
              "Optional file suffix filter (e.g. *.ts for TypeScript files)",
          },
          maxResults: {
            type: "number",
            description: "Optional maximum number of matches to return",
          },
        },
      },
    },
  },
];

export default {
  TOOLS: FILE_TOOLS,
  toolFunctions: {
    listDirectoryContents,
    createDirectory,
    writeFile,
    readFile,
    copyFileOrDirectory,
    moveFileOrDirectory,
    modifyFile,
    getWorkingDirectory,
    fileExists,
    searchInFiles,
    findInFiles,
    deleteFileOrDirectory,
  },
};
