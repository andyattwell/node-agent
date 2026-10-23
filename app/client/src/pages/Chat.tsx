import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getWsUrl(): string {
  const { protocol, host } = window.location;
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${host}/api/ws`;
}

const API_BASE = "/api";

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatProviderLabel(id: string): string {
  switch (id) {
    case "ollama":
      return "Ollama";
    case "llama_cpp":
      return "llama.cpp";
    case "cursor":
      return "Cursor";
    case "claude":
      return "Claude";
    case "gemini":
      return "Gemini";
    case "none":
      return "None";
    default:
      return id.trim() || "-";
  }
}

/** Chat-capable provider ids (must match ADW / API validation; excludes `none`). */
const CHAT_PROVIDER_IDS = [
  "ollama",
  "llama_cpp",
  "cursor",
  "claude",
  "gemini",
] as const;

interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessageFromApi {
  role: string;
  content: string;
  thinking?: string;
  tool_calls?: unknown[];
  tool_name?: string;
  /** Base64 payloads (Ollama vision), from API / history. */
  images?: string[];
}

interface WsMessage {
  type: "chunk" | "stderr" | "done" | "error" | "context" | "meta";
  text?: string;
  message?: string;
  code?: number;
  sessionId?: string;
  chunkType?: "thinking" | "content" | "tool_call" | "tool_response";
  promptTokens?: number;
  completionTokens?: number;
  contextLimit?: number;
  /** From chat subprocess `meta` event (ADW_AI_PROVIDER / model id). */
  provider?: string;
  model?: string;
}

type SegmentType =
  | "thinking"
  | "content"
  | "tool_call"
  | "tool_response"
  | "stderr"
  | "user";

interface OutputSegment {
  chunkType: SegmentType;
  text: string;
  /** Set when known from history; streaming segments infer from `text` via {@link extractToolNameFromToolCallText}. */
  toolName?: string;
  /** User message images (base64, no data-URL prefix). */
  images?: string[];
}

function base64ToImageSrc(b64: string): string {
  const t = b64.trim();
  if (t.startsWith("data:")) return t;
  const head = t.slice(0, 12);
  if (head.startsWith("iVBOR")) return `data:image/png;base64,${t}`;
  if (head.startsWith("/9j/")) return `data:image/jpeg;base64,${t}`;
  if (head.startsWith("R0lGOD")) return `data:image/gif;base64,${t}`;
  if (head.startsWith("UklGR")) return `data:image/webp;base64,${t}`;
  return `data:image/png;base64,${t}`;
}

function extractToolNameFromToolCallText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { tool?: unknown };
    if (typeof parsed.tool === "string" && parsed.tool.length > 0) {
      return parsed.tool;
    }
  } catch {
    // e.g. streamed chunks concatenated - fall through
  }
  const m = trimmed.match(/"tool"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

/** Streamed tool_response chunks use `{ tool, result }`; history may be plain JSON from the API. */
function formatToolResponseSegmentText(text: string): string {
  try {
    const p = JSON.parse(text) as { tool?: unknown; result?: unknown };
    if (typeof p.tool === "string" && "result" in p) {
      const r = p.result;
      return typeof r === "string" ? r : JSON.stringify(r, null, 2);
    }
  } catch {
    // incomplete stream or legacy body
  }
  return text;
}

function toolNameFromToolResponseText(text: string): string | null {
  try {
    const p = JSON.parse(text) as { tool?: unknown };
    if (typeof p.tool === "string" && p.tool.length > 0) return p.tool;
  } catch {
    // ignore
  }
  return null;
}

const SEGMENT_LABELS: Record<SegmentType, string> = {
  thinking: "Thinking",
  content: "Content",
  tool_call: "Tool call",
  tool_response: "Tool response",
  stderr: "Stderr",
  user: "You",
};

const DROPPABLE_TYPES: SegmentType[] = [
  "thinking",
  "tool_call",
  "tool_response",
];

function messagesToSegments(messages: ChatMessageFromApi[]): OutputSegment[] {
  const out: OutputSegment[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({
        chunkType: "user",
        text: m.content,
        ...(m.images?.length ? { images: m.images } : {}),
      });
      continue;
    }
    if (m.role === "assistant") {
      if (m.thinking) {
        out.push({ chunkType: "thinking", text: m.thinking });
      }
      if (m.content) {
        out.push({ chunkType: "content", text: m.content });
      }
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          const t = tc as { function?: { name?: string } };
          const name = t.function?.name ?? "tool";
          out.push({
            chunkType: "tool_call",
            text: JSON.stringify({ tool: name }),
            toolName: name,
          });
        }
      }
      continue;
    }
    if (m.role === "tool") {
      out.push({
        chunkType: "tool_response",
        text: m.content,
        ...(m.tool_name ? { toolName: m.tool_name } : {}),
      });
    }
  }
  return out;
}

interface ChatProps {
  initialSessionId?: string;
}

function Chat({ initialSessionId }: ChatProps) {
  const [segments, setSegments] = useState<OutputSegment[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  /** Indices of thinking / tool_call / tool_response segments whose body is collapsed. */
  const [collapsedIndices, setCollapsedIndices] = useState<Set<number>>(
    () => new Set(),
  );
  const prevSegmentCountRef = useRef(0);
  const [input, setInput] = useState("");
  /** Pending attachments for the next send (Ollama vision); base64 without data-URL prefix. */
  const [pendingImages, setPendingImages] = useState<
    { preview: string; base64: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [contextPromptTokens, setContextPromptTokens] = useState<number | null>(
    null,
  );
  const [contextCompletionTokens, setContextCompletionTokens] = useState<
    number | null
  >(null);
  const [contextLimit, setContextLimit] = useState<number | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("ollama");
  const [selectedModel, setSelectedModel] = useState<string>("gemma4:e4b");
  const wsRef = useRef<WebSocket | null>(null);
  const chatLogContainerRef = useRef<HTMLDivElement>(null);

  const contextPercent = useMemo(() => {
    if (
      contextPromptTokens == null ||
      contextLimit == null ||
      contextLimit <= 0
    ) {
      return null;
    }
    return Math.min(100, (contextPromptTokens / contextLimit) * 100);
  }, [contextPromptTokens, contextLimit]);

  const contextBarFillClass = useMemo(() => {
    if (contextPercent == null) return "bg-white/25";
    if (contextPercent >= 95) return "bg-red-500";
    if (contextPercent >= 80) return "bg-amber-500";
    return "bg-[#646cff]";
  }, [contextPercent]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/chats`);
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: ChatSession[] };
      setSessions(data.sessions ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        session: ChatSession;
        messages: ChatMessageFromApi[];
      };
      const segs = messagesToSegments(data.messages);
      setSegments(segs);
      setCollapsedIndices(
        new Set(
          segs
            .map((s, i) => (DROPPABLE_TYPES.includes(s.chunkType) ? i : -1))
            .filter((i): i is number => i >= 0),
        ),
      );
      prevSegmentCountRef.current = segs.length;
      setSessionId(data.session.id);
      setContextPromptTokens(null);
      setContextCompletionTokens(null);
      setContextLimit(null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId, loadSession]);

  const startNewChat = useCallback(() => {
    setSessionId(null);
    setSegments([]);
    setCollapsedIndices(new Set());
    prevSegmentCountRef.current = 0;
    setContextPromptTokens(null);
    setContextCompletionTokens(null);
    setContextLimit(null);
    setPendingImages([]);
  }, []);

  const addImagesFromFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const max = 8;
    const added: { preview: string; base64: string }[] = [];
    for (const file of list) {
      if (added.length >= max) break;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const comma = dataUrl.indexOf(",");
      added.push({
        preview: dataUrl,
        base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
      });
    }
    if (!added.length) return;
    setPendingImages((prev) => [...prev, ...added].slice(0, max));
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) return;
        await fetchSessions();
        if (sessionId === id) {
          startNewChat();
        }
      } catch {
        // ignore
      }
    },
    [fetchSessions, sessionId, startNewChat],
  );

  useEffect(() => {
    const el = chatLogContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments]);

  /** New appended droppable segments default to collapsed; prune indices when the list shrinks. */
  useEffect(() => {
    const n = segments.length;
    const prev = prevSegmentCountRef.current;
    if (n > prev) {
      setCollapsedIndices((c) => {
        const next = new Set(c);
        for (let i = prev; i < n; i++) {
          if (DROPPABLE_TYPES.includes(segments[i].chunkType)) {
            next.add(i);
          }
        }
        return next;
      });
    } else if (n < prev) {
      setCollapsedIndices((c) => {
        const next = new Set<number>();
        for (const idx of c) {
          if (idx < n) next.add(idx);
        }
        return next;
      });
    }
    prevSegmentCountRef.current = n;
  }, [segments]);

  useEffect(() => {
    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionError(null);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnectionError("WebSocket error");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        switch (msg.type) {
          case "chunk": {
            const text = msg.text;
            if (text !== undefined) {
              const chunkType = msg.chunkType ?? "content";
              setSegments((prev) => {
                const last = prev[prev.length - 1];
                if (last?.chunkType === chunkType) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: last.text + text },
                  ];
                }
                return [...prev, { chunkType, text }];
              });
            }
            break;
          }
          case "stderr": {
            const text = msg.text;
            if (text !== undefined) {
              setSegments((prev) => {
                const last = prev[prev.length - 1];
                if (last?.chunkType === "stderr") {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: last.text + text },
                  ];
                }
                return [...prev, { chunkType: "stderr", text }];
              });
            }
            break;
          }
          case "context": {
            const m = msg as WsMessage;
            if (typeof m.promptTokens === "number") {
              setContextPromptTokens(m.promptTokens);
            }
            if (typeof m.completionTokens === "number") {
              setContextCompletionTokens(m.completionTokens);
            }
            if (typeof m.contextLimit === "number" && m.contextLimit > 0) {
              setContextLimit(m.contextLimit);
            }
            break;
          }
          case "meta": {
            const m = msg as WsMessage;
            if (typeof m.provider === "string" && m.provider.length > 0) {
              setAiProvider(m.provider);
            }
            if (typeof m.model === "string" && m.model.length > 0) {
              setAiModel(m.model);
            }
            break;
          }
          case "done": {
            setStreaming(false);
            const sid = (msg as WsMessage & { sessionId?: string }).sessionId;
            if (sid) setSessionId(sid);
            fetchSessions();
            break;
          }
          case "error":
            setSegments((prev) => [
              ...prev,
              {
                chunkType: "stderr",
                text: `[Error: ${msg.message ?? "Unknown"}]`,
              },
            ]);
            setStreaming(false);
            break;
          default:
            break;
        }
      } catch {
        setSegments((prev) => [
          ...prev,
          { chunkType: "stderr", text: "[Invalid message]" },
        ]);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const handleSend = (message?: string) => {
    const content = message ? message.trim() : input.trim();
    const imgs = pendingImages.map((p) => p.base64);
    if (
      (!content && imgs.length === 0) ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    if (imgs.length > 0 && selectedProvider !== "ollama") {
      setSegments((prev) => [
        ...prev,
        {
          chunkType: "stderr",
          text: "[Images are only sent when the provider is Ollama. Switch provider or remove attachments.]",
        },
      ]);
      return;
    }
    const displayText =
      content ||
      (imgs.length > 0 ? `(${imgs.length} image${imgs.length > 1 ? "s" : ""})` : "");
    setSegments((prev) => [
      ...prev,
      {
        chunkType: "user",
        text: displayText,
        ...(imgs.length > 0 ? { images: imgs } : {}),
      },
    ]);
    setInput("");
    setPendingImages([]);
    setStreaming(true);
    wsRef.current.send(
      JSON.stringify({
        type: "message",
        content: content || "",
        provider: selectedProvider,
        model: selectedModel,
        ...(sessionId ? { sessionId } : {}),
        ...(imgs.length > 0 ? { images: imgs } : {}),
      }),
    );
  };

  const getSegmentLabelClass = useMemo(
    () => (chunkType: SegmentType) => {
      switch (chunkType) {
        case "content":
          return "text-green-400 text-xs";
        case "tool_call":
          return "text-amber-400 text-xs";
        case "tool_response":
          return "text-emerald-400 text-xs";
        case "stderr":
          return "text-gray-400 text-xs";
        case "thinking":
          return "text-blue-400 text-xs";
        case "user":
          return "text-purple-400 text-xs";
      }
    },
    [],
  );
  const getSegmentContentClass = useMemo(
    () => (chunkType: SegmentType) => {
      switch (chunkType) {
        case "content":
          return "text-white";
        case "tool_call":
          return "bg-black text-amber-400 text-xs";
        case "tool_response":
          return "bg-black text-emerald-400 text-xs";
        case "stderr":
          return "text-red-400";
        case "thinking":
          return "bg-black text-blue-400 text-xs";
        case "user":
          return "";
      }
    },
    [],
  );

  const toggleCollapsed = (index: number) => {
    setCollapsedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const isCollapsed = (index: number, chunkType: SegmentType) =>
    DROPPABLE_TYPES.includes(chunkType) && collapsedIndices.has(index);

  const handleSendCustomCommand = (command: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setInput(command);
      setTimeout(() => {
        handleSend(command);
      }, 200);
    }
  };

  const messageClass = useMemo(
    () => (chunkType: SegmentType) => {
      if (chunkType === "user") {
        return "gap-1 my-2 text-right justify-end bg-blue-500/20 p-2 rounded-lg";
      }

      if (
        chunkType === "tool_call" ||
        chunkType === "tool_response" ||
        chunkType === "thinking"
      ) {
        return "mt-0 text-left justify-start rounded-lg";
      }

      if (chunkType === "stderr") {
        return "text-left justify-start bg-red-500/20 p-2 rounded-lg";
      }

      return "text-left justify-start bg-gray-500/20 p-2 mt-2 rounded-lg";
    },
    [],
  );

  const formatSessionDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full flex-row text-left">
      {/* Left sidebar – conversation list */}
      <aside
        className="w-56 flex-shrink-0 overflow-y-auto border-r border-white/10 bg-[#1a1a1a]/90 p-3 backdrop-blur-sm"
        aria-label="Conversations"
      >
        <button
          type="button"
          className="mb-3 w-full rounded-lg border border-[#646cff]/40 bg-[#646cff] px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#535bf2]"
          onClick={startNewChat}
        >
          New chat
        </button>
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-1 group">
              <button
                type="button"
                className={`min-w-0 flex-1 truncate rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  sessionId === s.id
                    ? "border-[#646cff]/35 bg-[#646cff]/15 text-white"
                    : "border-transparent text-white/80 hover:border-white/10 hover:bg-white/[0.06]"
                }`}
                onClick={() => loadSession(s.id)}
                title={s.title ?? s.id}
              >
                {s.title || "Chat"} - {formatSessionDate(s.updated_at)}
              </button>
              <button
                type="button"
                className={`rounded p-1.5 text-white/50 hover:text-red-400 hover:bg-red-500/20 transition-opacity ${
                  sessionId === s.id
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                }}
                aria-label={`Delete chat ${s.title || s.id}`}
                title="Delete chat"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Chat column – centered, fixed max width */}
      <div className="flex flex-col h-full w-full max-w-3xl flex-shrink-0 text-left">
        {/* Chat log container – scrollable, owns the scrollbar */}
        <div
          ref={chatLogContainerRef}
          id="chat-log-container"
          className="flex-1 min-h-0 overflow-y-auto mt-2"
        >
          <div
            className="my-2 mx-0 rounded-xl border border-white/10 bg-white/[0.03] p-4 font-mono text-sm whitespace-pre-wrap shadow-sm"
            role="log"
            aria-live="polite"
            id="chat-log"
          >
            {segments.length === 0 ? (
              "Send a message to start."
            ) : (
              <div className="">
                {segments.map((seg, i) => {
                  const collapsed = isCollapsed(i, seg.chunkType);
                  const label = SEGMENT_LABELS[seg.chunkType];
                  const sectionCollapsedHint =
                    seg.chunkType === "tool_call"
                      ? (seg.toolName ??
                        extractToolNameFromToolCallText(seg.text))
                      : seg.chunkType === "tool_response"
                        ? (seg.toolName ??
                          toolNameFromToolResponseText(seg.text))
                        : null;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${messageClass(seg.chunkType)}`}
                    >
                      {DROPPABLE_TYPES.includes(seg.chunkType) && (
                        <button
                          type="button"
                          onClick={() => toggleCollapsed(i)}
                          className={`flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider hover:text-white/90 ${getSegmentLabelClass(seg.chunkType)}`}
                          aria-expanded={!collapsed}
                          aria-label={`${label}: ${collapsed ? "Show" : "Hide"}`}
                        >
                          <span aria-hidden="true">
                            {collapsed ? "▶" : "▼"}
                          </span>
                          {label}
                          {collapsed && (
                            <span className="normal-case font-normal opacity-80">
                              {sectionCollapsedHint != null
                                ? `(${sectionCollapsedHint})`
                                : ""}
                            </span>
                          )}
                        </button>
                      )}
                      {!collapsed && (
                        <>
                          {seg.chunkType === "user" &&
                            seg.images &&
                            seg.images.length > 0 && (
                              <div className="flex flex-wrap justify-end gap-2 p-2">
                                {seg.images.map((b64, j) => (
                                  <img
                                    key={j}
                                    src={base64ToImageSrc(b64)}
                                    alt=""
                                    className="max-h-40 max-w-[min(100%,280px)] rounded-md border border-white/15 object-contain"
                                  />
                                ))}
                              </div>
                            )}
                          <span
                            className={`whitespace-pre-wrap break-words p-2 ${getSegmentContentClass(seg.chunkType)}`}
                          >
                            {seg.chunkType === "tool_response"
                              ? formatToolResponseSegmentText(seg.text)
                              : seg.text}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: input area only */}
        <footer className="sticky bottom-0 z-10 flex-shrink-0 border-t border-white/10 bg-[#1a1a1a]/95 pt-3 pb-4 backdrop-blur-sm">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label
                htmlFor="chat-provider"
                className="text-xs font-medium uppercase tracking-wide text-white/60"
              >
                Provider
              </label>
              <div className="relative w-full max-w-xs">
                <select
                  id="chat-provider"
                  className="scheme-dark w-full cursor-pointer appearance-none rounded-lg border border-white/20 bg-[#2a2a2e] py-2 pl-3 pr-9 text-sm font-medium text-white shadow-inner shadow-black/20 transition-colors hover:border-white/30 hover:bg-[#323236] focus:border-[#646cff]/70 focus:outline-none focus:ring-2 focus:ring-[#646cff]/35 disabled:cursor-not-allowed disabled:opacity-45"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  disabled={!connected || streaming}
                >
                  {CHAT_PROVIDER_IDS.map((id) => (
                    <option
                      key={id}
                      value={id}
                      className="bg-[#2a2a2e] text-white"
                    >
                      {formatProviderLabel(id)}
                    </option>
                  ))}
                </select>
                <span
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/55"
                  aria-hidden
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="block"
                  >
                    <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label
                htmlFor="chat-model"
                className="text-xs font-medium uppercase tracking-wide text-white/60"
              >
                Model
              </label>
              <input
                id="chat-model"
                type="text"
                className="scheme-dark w-full rounded-lg border border-white/20 bg-[#2a2a2e] px-3 py-2 text-sm text-white shadow-inner shadow-black/20 placeholder:text-white/40 transition-colors hover:border-white/30 focus:border-[#646cff]/70 focus:outline-none focus:ring-2 focus:ring-[#646cff]/35 disabled:cursor-not-allowed disabled:opacity-45"
                placeholder="e.g. llama3.2, gemini-2.5-flash, GGUF path"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!connected || streaming}
              />
            </div>
          </div>
          <div className="mb-2 flex justify-between gap-2 text-xs text-white/60">
            <span className="font-medium uppercase tracking-wide">
              Last response
            </span>
            <span className="tabular-nums text-right text-white/80">
              {aiProvider != null || aiModel != null ? (
                <>
                  {aiProvider != null ? (
                    <span className="text-[#646cff]">
                      {formatProviderLabel(aiProvider)}
                    </span>
                  ) : null}
                  {aiProvider != null && aiModel != null ? (
                    <span className="text-white/45"> · </span>
                  ) : null}
                  {aiModel != null ? (
                    <span className="break-all">{aiModel}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-white/35">-</span>
              )}
            </span>
          </div>
          <div className="mb-3 space-y-1.5">
            <div className="flex justify-between gap-2 text-xs text-white/60">
              <span className="font-medium uppercase tracking-wide">
                Context
              </span>
              <span className="tabular-nums">
                {contextPromptTokens != null &&
                contextLimit != null &&
                contextLimit > 0 ? (
                  <>
                    {formatTokenCount(contextPromptTokens)} /{" "}
                    {formatTokenCount(contextLimit)}
                    {contextCompletionTokens != null ? (
                      <span className="text-white/45 ml-1">
                        · out {formatTokenCount(contextCompletionTokens)}
                      </span>
                    ) : null}
                  </>
                ) : (
                  "-"
                )}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                contextPercent != null ? Math.round(contextPercent) : undefined
              }
              aria-label="Model context usage"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${contextBarFillClass}`}
                style={{
                  width: contextPercent != null ? `${contextPercent}%` : "0%",
                }}
              />
            </div>
          </div>
          <div className="flex justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              {streaming && (
                <>
                  <div className="animate-spin rounded-full border-2 border-white/35 border-t-white w-4 h-4"></div>
                  <span className="text-white/60 text-sm mt-1">Working...</span>
                </>
              )}
            </div>

            <p className="text-sm text-white/70">
              {connected ? (
                <span className="text-green-400">Connected</span>
              ) : (
                <span className="text-amber-400">Disconnected</span>
              )}
              {connectionError && (
                <span className="ml-2 text-red-400">{connectionError}</span>
              )}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addImagesFromFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {pendingImages.map((img, i) => (
                <div
                  key={`${img.preview.slice(0, 48)}-${i}`}
                  className="relative inline-block"
                >
                  <img
                    src={img.preview}
                    alt=""
                    className="h-16 w-16 rounded-md border border-white/15 object-cover"
                  />
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-xs text-white shadow hover:bg-zinc-700"
                    onClick={() =>
                      setPendingImages((prev) => prev.filter((_, j) => j !== i))
                    }
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={
                !connected ||
                streaming ||
                selectedProvider !== "ollama" ||
                pendingImages.length >= 8
              }
              onClick={() => fileInputRef.current?.click()}
              title={
                selectedProvider !== "ollama"
                  ? "Switch to Ollama to attach images"
                  : "Attach images (vision models)"
              }
            >
              Attach images
            </button>
            {selectedProvider === "ollama" && (
              <span className="text-xs text-white/45">
                Ollama vision: base64 in API per{" "}
                <a
                  href="https://ollama.com/blog/vision-models"
                  className="text-[#646cff] underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  docs
                </a>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <textarea
              className="min-h-[80px] flex-1 rounded-lg border border-white/12 bg-white/[0.06] p-3 text-sm text-white placeholder-white/45 focus:border-[#646cff]/50 focus:ring-1 focus:ring-[#646cff]/30 focus:outline-none"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={!connected || streaming}
              rows={3}
            />
            <button
              type="button"
              className="rounded-lg border border-[#646cff]/40 bg-[#646cff] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#535bf2] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleSend()}
              disabled={
                !connected ||
                streaming ||
                (!input.trim() && pendingImages.length === 0)
              }
            >
              {streaming ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-rose-500/40 bg-transparent px-4 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: "stop" }));
                  setStreaming(false);
                }
              }}
              disabled={!connected || !streaming}
              title="Stop the current response"
            >
              Stop
            </button>
          </div>
        </footer>
      </div>

      {/* Right spacer + actions column – full height, scrollable */}
      <div className="flex-1 min-w-0 flex">
        <aside
          className="h-full w-72 flex-shrink-0 overflow-y-auto border-l border-white/10 bg-[#1a1a1a]/90 p-4 backdrop-blur-sm"
          aria-label="Chat actions"
        >
          <p className="mb-3 m-0 text-xs font-medium uppercase tracking-wide text-white/45">
            Quick actions
          </p>
          <div className="flex flex-col gap-2" id="chat-actions">
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand(
                    "Fetch my tasks from the ClickUp list with the ID 901414359810 ",
                  );
                }
              }}
            >
              Fetch ClickUp tasks
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand(
                    "List the contents of the working directory",
                  );
                }
              }}
            >
              List directory contents
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand(
                    "Find the word 'console' in the files under the directory /home/andy/Projects/node-agent/",
                  );
                }
              }}
            >
              Find in files
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand("Get the list of projects");
                }
              }}
            >
              Get projects
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand("Create a new project called 'test'");
                }
              }}
            >
              Create project
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand(
                    "/test El vínculo de Manuel Adorni con la productora de su amigo Marcelo Grandio sigue engrosando la lista de irregularidades que jaquean al jefe de gabinete tras la revelación de su viaje a Punta del Este en un avión privado.",
                  );
                }
              }}
            >
              Test command
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand("/help");
                }
              }}
            >
              Help
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
              disabled={!connected || streaming}
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  handleSendCustomCommand(
                    "/plan Create a new express POST endpoint that receives a json object with name, age and gender and returns a string saying 'Hi <name>!, your age is <age>'. The app is located at development/apps/api",
                  );
                }
              }}
            >
              Plan
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Chat;
