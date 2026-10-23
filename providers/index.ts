import type { ResolvedAdwConfig } from "../utils/adw-config.js";
import { resolveAdwConfig } from "../utils/adw-config.js";
import {
  TOOL_DESCRIPTION_TO_NAME,
  TOOLS,
} from "../utils/tools/index.js";
import type { AIProvider } from "./ai-provider.js";
import { createClaudeProvider } from "./claude-provider.js";
import { createCursorProvider } from "./cursor-provider.js";
import { createCustomProvider } from "./custom-provider.js";
import { createPiProvider } from "./pi-provider.js";

export type { AIProvider, InstructionContext, InstructionResult, InstructionStep } from "./ai-provider.js";

/**
 * Return the AI provider for the given kind using merged ADW config (env + optional project).
 */
export function getProvider(
  kind: string,
  config: ResolvedAdwConfig,
): AIProvider | null {
  switch (kind) {
    case "cursor":
      return createCursorProvider(config);
    case "claude":
      return createClaudeProvider(config);
    case "custom":
      return createCustomProvider(config, {
        tools: TOOLS,
        toolDescriptionToName: TOOL_DESCRIPTION_TO_NAME,
      });
    case "pi":
      return createPiProvider(config);
    case "none":
    default:
      return null;
  }
}

/**
 * Return the configured provider from merged config (use `resolveAdwConfig(null)` for env-only).
 */
export function getConfiguredProvider(
  config: ResolvedAdwConfig,
): AIProvider | null {
  return getProvider(config.aiProvider, config);
}

/** Env-only ADW defaults (no project row). */
export function getConfiguredProviderFromEnv(): AIProvider | null {
  return getConfiguredProvider(resolveAdwConfig(null));
}
