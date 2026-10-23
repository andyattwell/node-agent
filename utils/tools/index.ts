import type { Tool } from "../../providers/utils/chat-types.js";
import FILE from "./files.js";
import CLICKUP from "./clickup.js";
import TIME from "./time.js";
import PROJECTS from "./projects.js";
import COMMANDS from "./commands.js";

export const toolFunctions = {
  ...FILE.toolFunctions,
  ...CLICKUP.toolFunctions,
  ...TIME.toolFunctions,
  ...PROJECTS.toolFunctions,
  ...COMMANDS.toolFunctions,
};

/**
 * Tools available to the AI (Ollama-compatible schema).
 */
export const TOOLS: Tool[] = [
  ...FILE.TOOLS,
  ...CLICKUP.TOOLS,
  ...TIME.TOOLS,
  ...PROJECTS.TOOLS,
  ...COMMANDS.TOOLS,
];

/** Map tool description (or name) to our function name for content-parsed tool calls. */
export const TOOL_DESCRIPTION_TO_NAME: Record<string, string> =
  Object.fromEntries(
    TOOLS.map((t) => [
      (t.function as { description?: string }).description ?? t.function.name,
      (t.function as { name?: string }).name ?? "",
    ]).filter(([, name]) => name),
  );

/**
 * Validate tool arguments: required params present and correct type.
 * @returns Error message string if invalid, null if valid.
 */
export function validateToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  toolDef: (typeof TOOLS)[number] | undefined,
): string | null {
  if (!toolDef?.function?.parameters) return null;
  const params = toolDef.function.parameters as {
    required?: string[];
    properties?: Record<string, { type?: string }>;
  };
  const required = params.required ?? [];
  const properties = params.properties ?? {};
  for (const key of required) {
    const val = args[key];
    if (val === undefined || val === null) {
      return `Error: Missing required argument "${key}" for tool ${toolName}`;
    }
    const expectedType = properties[key]?.type;
    if (expectedType === "string" && typeof val !== "string") {
      return `Error: Argument "${key}" for tool ${toolName} must be a string`;
    }
    if (expectedType === "number" && typeof val !== "number") {
      return `Error: Argument "${key}" for tool ${toolName} must be a number`;
    }
    if (expectedType === "boolean" && typeof val !== "boolean") {
      return `Error: Argument "${key}" for tool ${toolName} must be a boolean`;
    }
  }
  return null;
}

/**
 * When the model returns tool call as content (e.g. {"name": "description", "parameters": {...}}),
 * parse it and convert to tool_calls format. Returns null if content is not a tool call.
 */
export function parseContentAsToolCall(content: string): {
  name: string;
  arguments: Record<string, unknown>;
} | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  let parsed: { name?: string; parameters?: Record<string, unknown> };
  try {
    parsed = JSON.parse(trimmed) as {
      name?: string;
      parameters?: Record<string, unknown>;
    };
  } catch {
    return null;
  }
  const name = parsed.name && TOOL_DESCRIPTION_TO_NAME[parsed.name];
  const args = parsed.parameters ?? {};
  if (!name || typeof args !== "object") return null;
  return { name, arguments: args };
}

export default {
  toolFunctions,
  TOOLS,
  TOOL_DESCRIPTION_TO_NAME,
  validateToolArgs,
  parseContentAsToolCall,
};
