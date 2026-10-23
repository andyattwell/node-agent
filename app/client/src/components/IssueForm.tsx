import { useRef, useState, useEffect, type CSSProperties } from "react";
import type { Issue } from "../types/api";
import { formFieldCaptionClass, inputClass } from "../lib/uiClasses";

const STATUSES: Issue["status"][] = [
  "open",
  "started",
  "planning",
  "implementing",
  "testing",
  "pr",
  "reviewing",
  "completed",
  "error",
  "cancelled",
  "draft",
];

const PRIORITIES: Issue["priority"][] = ["low", "medium", "high"];

const TYPES: Issue["type"][] = ["feature", "bug", "chore"];

const SELECT_CHEVRON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a8a8a8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E";
const selectDarkStyle: CSSProperties = {
  backgroundColor: "#2a2a2a",
  backgroundImage: `url("${SELECT_CHEVRON}")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.65rem center",
  backgroundSize: "1.125rem",
};

function IssueForm({
  open,
  projectId,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  initial: Issue | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Issue["status"]>("open");
  const [priority, setPriority] = useState<Issue["priority"]>("medium");
  const [type, setType] = useState<Issue["type"]>("feature");
  const [worktree, setWorktree] = useState(true);
  const [adwId, setAdwId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description);
      setStatus(initial.status);
      setPriority(initial.priority);
      setType(initial.type);
      setWorktree(initial.worktree !== false);
      setAdwId(initial.adw_id ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStatus("open");
      setPriority("medium");
      setType("feature");
      setWorktree(true);
      setAdwId("");
    }
    setError(null);
  }, [initial, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const id = requestAnimationFrame(() => {
        if (!dialog.open) dialog.showModal();
      });
      return () => cancelAnimationFrame(id);
    }
    dialog.close();
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  /** Native selects need explicit dark colors + color-scheme; chevron via style so fill + icon don’t fight. */
  const selectFieldClass =
    "w-full cursor-pointer appearance-none rounded-lg border border-white/12 bg-white/[0.06] py-2.5 pl-3 pr-10 text-left text-sm leading-snug text-white/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] outline-none [color-scheme:dark] focus:border-[#646cff]/55 focus:ring-1 focus:ring-[#646cff]/30 disabled:cursor-not-allowed disabled:opacity-60";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const pid = Number(projectId);
      const adwResolved = adwId.trim() === "" ? null : adwId.trim();
      const body = {
        title: trimmedTitle,
        description,
        status,
        priority,
        type,
        worktree,
        adw_id: adwResolved,
        project_id: pid,
      };
      const url = initial ? `/api/issues/${initial.id}` : "/api/issues";
      const res = await fetch(url, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial
            ? {
                title: body.title,
                description: body.description,
                status: body.status,
                priority: body.priority,
                type: body.type,
                worktree: body.worktree,
                adw_id: body.adw_id,
                project_id: body.project_id,
              }
            : body,
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      onSaved();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="issues-form-dialog z-[1000] w-[90%] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] p-0 text-inherit shadow-xl shadow-black/40"
      onCancel={(ev) => {
        ev.preventDefault();
        handleClose();
      }}
    >
      <form onSubmit={handleSubmit} className="p-0">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h3 className="m-0 text-lg font-semibold tracking-tight text-white">
              {initial ? "Edit issue" : "New issue"}
            </h3>
            <p className="m-0 mt-0.5 text-xs text-white/45">
              {initial ? "Update fields and save" : "Describe the work item"}
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] p-2 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="space-y-3 p-5 sm:px-6">
          {error && (
            <p
              className="m-0 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
              role="alert"
            >
              {error}
            </p>
          )}
          <label className="block">
            <span className={formFieldCaptionClass}>Title</span>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className={formFieldCaptionClass}>Description</span>
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={formFieldCaptionClass}>Status</span>
              <select
                className={selectFieldClass}
                style={selectDarkStyle}
                value={status}
                onChange={(e) => setStatus(e.target.value as Issue["status"])}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={formFieldCaptionClass}>Priority</span>
              <select
                className={selectFieldClass}
                style={selectDarkStyle}
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as Issue["priority"])
                }
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={formFieldCaptionClass}>Type</span>
              <select
                className={selectFieldClass}
                style={selectDarkStyle}
                value={type}
                onChange={(e) => setType(e.target.value as Issue["type"])}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 accent-[#646cff]"
              checked={worktree}
              onChange={(e) => setWorktree(e.target.checked)}
            />
            <span className="text-sm text-white/85">
              <span className="font-medium text-white">Git worktree</span>
              <span className="mt-0.5 block text-xs text-white/50">
                When off, ADW checks out branch <code className="text-white/70">adw-…</code> directly in
                the project repo (no separate worktree folder).
              </span>
            </span>
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4 sm:px-6">
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-lg border-0 bg-[#646cff] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#535bf2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : initial ? "Save" : "Create"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default IssueForm;
