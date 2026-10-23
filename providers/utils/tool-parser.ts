/**
 * When the model returns tool call as content (e.g. {"name": "description", "parameters": {...}}),
 * parse it and convert to tool_calls format. Returns null if content is not a tool call.
 */
export function parseContentAsToolCall(
  content: string,
  toolDescriptionToName: Record<string, string>,
): { name: string; arguments: Record<string, unknown> } | null {
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
  const name =
    parsed.name && toolDescriptionToName[parsed.name]
      ? toolDescriptionToName[parsed.name]
      : parsed.name;
  const args = parsed.parameters ?? {};
  if (!name || typeof args !== "object") return null;
  return { name, arguments: args };
}

function parseOneXmlishToolCallInner(
  inner: string,
  toolDescriptionToName: Record<string, string>,
): { name: string; arguments: Record<string, unknown> } | null {
  const fnMatch = inner.match(/<function\s*=\s*([^>]+?)>/i);
  if (!fnMatch) return null;
  let fnName = fnMatch[1].trim();
  if (!fnName) return null;
  if (toolDescriptionToName[fnName]) fnName = toolDescriptionToName[fnName];

  const afterFn = inner.slice(
    (fnMatch.index ?? 0) + fnMatch[0].length,
  );
  const closeMatch = afterFn.match(/<\/function\s*>/i);
  const fnBody = closeMatch
    ? afterFn.slice(0, closeMatch.index!)
    : afterFn;

  const args: Record<string, unknown> = {};
  const paramRegex = /<parameter\s*=\s*([^>]+?)>([\s\S]*?)<\/parameter>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = paramRegex.exec(fnBody)) !== null) {
    args[pm[1].trim()] = pm[2].trim();
  }

  return { name: fnName, arguments: args };
}

/**
 * Parse tool-call blocks from model text; removes successfully parsed blocks from the returned remainder.
 */
export function extractXmlishToolCalls(
  text: string,
  toolDescriptionToName: Record<string, string>,
): {
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  remainder: string;
} {
  const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> =
    [];
  const re = /<tool_call\s*>([\s\S]*?)<\/tool_call\s*>/gi;
  const toRemove: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const full = m[0];
    const parsed = parseOneXmlishToolCallInner(
      m[1],
      toolDescriptionToName,
    );
    if (parsed) {
      toolCalls.push(parsed);
      toRemove.push(full);
    }
  }
  let remainder = text;
  for (const chunk of toRemove) {
    remainder = remainder.split(chunk).join("");
  }
  remainder = remainder.replace(/\n{3,}/g, "\n\n").trimEnd();
  return { toolCalls, remainder };
}
