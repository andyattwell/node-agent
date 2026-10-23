import path from "path";
import fs from "fs";
import type { Tool } from "../../providers/utils/chat-types.js";
import logger from "../logger.js";

export function listCommands(): string[] {
  const commandsDir = path.join(process.cwd(), "commands", "llama");
  const commands = fs.readdirSync(commandsDir);
  return commands
    .filter((command) => command.endsWith(".md"))
    .map((command) => command.replace(".md", ""));
}

export function identifyCommand(prompt: string): string | undefined {
  // regex to find if the prompt starts with a slash and the command name
  const firstWord = prompt.split(" ")[0];
  const command = firstWord.match(/^\/(.*)$/)?.[1];
  if (!command) {
    return;
  }
  logger.logMessage(
    `command: ${command} found in ${listCommands().join(", ")}`,
  );
  if (!listCommands().includes(command)) {
    return undefined;
  }
  return command;
}

export function expandCommand(
  command: string,
  prompt: string,
): string | undefined {
  const commandPath = path.join(
    process.cwd(),
    "adw",
    "commands",
    "llama",
    command + ".md",
  );
  if (!fs.existsSync(commandPath)) {
    return;
  }
  const commandContent = fs.readFileSync(commandPath, "utf8");
  return commandContent + "\n\n" + prompt.replace("/" + command, "");
}

export const COMMAND_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "listCommands",
      description: "Get a list of available commands.",
      parameters: {
        type: "object",
        required: [],
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
      name: "identifyCommand",
      description: "Identify and return a command from the user's prompt",
      parameters: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description:
              "The user's prompt to get the command from: Example: '/test Hello, how are you?'",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "expandCommand",
      description:
        "Build a prompt for a slash command using the command file as a template",
      parameters: {
        type: "object",
        required: ["command", "prompt"],
        properties: {
          command: {
            type: "string",
            description: "The command to run (e.g. 'test')",
          },
          prompt: {
            type: "string",
            description: "The prompt to run the command with",
          },
        },
      },
    },
  },
];

export default {
  TOOLS: COMMAND_TOOLS,
  toolFunctions: {
    listCommands,
    identifyCommand,
    expandCommand,
  },
};
