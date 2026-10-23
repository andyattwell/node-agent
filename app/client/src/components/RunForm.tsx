import React, { useState } from "react";
import { cardSurfaceClass } from "../lib/uiClasses";

function IconPlay(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export default function RunForm({
  onSuccess,
  projectId,
  issueId,
}: React.PropsWithChildren<{
  onSuccess?: () => void;
  projectId: string;
  issueId?: string;
}>) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setMessage(null);
    let success = false;
    try {
      const body: Record<string, string | number> = {
        prompt: trimmed,
        project_id: Number(projectId),
      };
      if (issueId != null && issueId.trim() !== "") {
        body.issue_id = Number(issueId);
      }
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? `HTTP ${res.status}` });
        return;
      }
      success = true;
      setMessage({ type: "success", text: data.message ?? "Run started." });
      setPrompt("");
      setTimeout(() => {
        setSubmitting(false);
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      if (!success) setSubmitting(false);
    }
  };

  const inputClass =
    "min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2.5 text-base text-inherit outline-none placeholder:text-white/40 focus:border-[#646cff]/50 focus:ring-1 focus:ring-[#646cff]/30 disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <section
      className={`mb-8 overflow-hidden ${cardSurfaceClass}`}
      aria-label="Start a new run"
    >
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-[#646cff]">
            <IconPlay />
          </span>
          <div>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-white">
              New run
            </h2>
            <p className="m-0 mt-0.5 text-xs text-white/45">
              Queue a prompt for the agent on this issue
            </p>
          </div>
        </div>
      </div>
      <form className="px-5 py-5 sm:px-6" onSubmit={handleSubmit}>
        <label
          htmlFor="run-prompt"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/45"
        >
          Prompt
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            id="run-prompt"
            type="text"
            className={inputClass}
            placeholder="e.g. feat: add login page"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={submitting}
            aria-describedby={message ? "run-form-message" : undefined}
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 bg-[#646cff] px-5 py-2.5 text-sm font-medium text-white cursor-pointer hover:enabled:bg-[#535bf2] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || !prompt.trim()}
          >
            {submitting ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                  aria-hidden
                />
                Starting…
              </>
            ) : (
              "Run"
            )}
          </button>
        </div>
        {message && (
          <p
            id="run-form-message"
            className={`mt-3 m-0 rounded-lg border px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/25 bg-rose-500/10 text-rose-200"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>
    </section>
  );
}
