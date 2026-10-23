import { useState, useEffect } from "react";
import type { Run } from "../types/api";
import { modalWideDialogClass } from "../lib/uiClasses";

const runCost = (run: Run[]) => {
  return run
    .reduce(
      (acc, r) =>
        acc +
        ("modelUsage" in r && r.modelUsage
          ? Object.values(r.modelUsage).reduce((sum, m) => sum + m.costUSD, 0)
          : 0),
      0,
    )
    .toFixed(6);
};

export default function RunDetailModal({
  run,
  name,
  onClose,
}: {
  run: Run[];
  name: string;
  onClose: () => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set<string>(),
  );

  const runKey = run?.map((r) => r.uuid).join(",") ?? "";
  useEffect(() => {
    if (run?.length) {
      setExpandedIds(new Set());
    }
  }, [runKey]);

  const toggleRun = (uuid: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  if (!run) {
    return null;
  }
  return (
    <dialog
      className={modalWideDialogClass}
      open={!!run}
      onClose={() => {
        onClose();
      }}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
        <div>
          <h3 className="m-0 text-lg font-semibold tracking-tight text-white">
            Run <span className="font-mono text-white/80">{name}</span>
          </h3>
          <p className="m-0 mt-0.5 text-xs text-white/45">
            Line-by-line output and usage
          </p>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] p-2 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          onClick={() => {
            onClose();
          }}
          aria-label="Close"
        >
          ×
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-5 text-sm text-white/85 sm:px-6">
        <h4 className="m-0 mb-1 text-xs font-medium uppercase tracking-wide text-white/45">
          Usage
        </h4>
        <h5 className="m-0 mb-3 text-xs font-medium uppercase tracking-wide text-white/45">
          Model usage
        </h5>
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="m-0 font-mono text-sm">Cost: {runCost(run)} USD</p>
        </div>
        {run.map((r) => (
          <div key={r.uuid} className="mb-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm font-semibold text-white/90 cursor-pointer hover:bg-white/[0.08]"
              onClick={() => toggleRun(r.uuid)}
              aria-expanded={expandedIds.has(r.uuid)}
            >
              <span
                className="shrink-0 text-[0.7rem] opacity-80"
                aria-hidden="true"
              >
                {expandedIds.has(r.uuid) ? "▼" : "▶"}
              </span>
              <span className="min-w-0 flex-1">
                {r.uuid} - {r.type}
                {"subtype" in r && r.subtype ? ` ${r.subtype}` : ""}
              </span>
            </button>
            {expandedIds.has(r.uuid) && (
              <ul className="list-disc pl-6">
                <li>Type: {r.type}</li>
                {"subtype" in r && <li>Subtype: {r.subtype}</li>}
                {"is_error" in r && (
                  <li>Is error: {r.is_error ? "Yes" : "No"}</li>
                )}
                {"duration_ms" in r && (
                  <>
                    <li>Duration: {r.duration_ms}ms</li>
                    <li>Duration API: {r.duration_api_ms}ms</li>
                    <li>Num turns: {r.num_turns}</li>
                  </>
                )}
                {"result" in r && (
                  <>
                    <li>Result: {r.result}</li>
                    <li>Stop reason: {r.stop_reason}</li>
                  </>
                )}
                {"skills" in r && r.skills && (
                  <li>Skills: {r.skills.join(", ")}</li>
                )}
                {"agents" in r && r.agents && (
                  <li>Agents: {r.agents.join(", ")}</li>
                )}
                {"slash_commands" in r && r.slash_commands && (
                  <li>Slash commands: {r.slash_commands.join(", ")}</li>
                )}
                {"mcp_servers" in r && r.mcp_servers && (
                  <li>MCP servers: {r.mcp_servers.join(", ")}</li>
                )}
                {"model" in r && r.model && <li>Model: {r.model}</li>}
                {"permissionMode" in r && r.permissionMode && (
                  <li>Permission mode: {r.permissionMode}</li>
                )}
                {"message" in r && r.message && (
                  <>
                    <li>Message stop reason: {r.message.stop_reason ?? "-"}</li>
                    <li>
                      Message stop sequence: {r.message.stop_sequence ?? "-"}
                    </li>
                  </>
                )}
                {"usage" in r && r.usage && (
                  <>
                    {"input_tokens" in r.usage && (
                      <>
                        <li>
                          Usage input tokens: {r.usage.input_tokens ?? "-"}
                        </li>
                        <li>
                          Cache creation input tokens:{" "}
                          {r.usage.cache_creation_input_tokens ?? "-"}
                        </li>
                        <li>
                          Cache read input tokens:{" "}
                          {r.usage.cache_read_input_tokens ?? "-"}
                        </li>
                        {r.usage.cache_creation && (
                          <>
                            <li>
                              Cache creation 5m:{" "}
                              {r.usage.cache_creation.ephemeral_5m_input_tokens}
                            </li>
                            <li>
                              Cache creation 1h:{" "}
                              {r.usage.cache_creation.ephemeral_1h_input_tokens}
                            </li>
                          </>
                        )}
                      </>
                    )}
                    {"total_tokens" in r.usage && (
                      <li>
                        Task usage: {r.usage.total_tokens} tokens,{" "}
                        {r.usage.tool_uses} tool uses, {r.usage.duration_ms}ms
                      </li>
                    )}
                  </>
                )}
                {"description" in r && r.description && (
                  <li>Description: {r.description}</li>
                )}
                {"last_tool_name" in r && (
                  <li>Last tool: {r.last_tool_name}</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
    </dialog>
  );
}
