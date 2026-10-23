import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CommentsResponse, Issue, IssueComment } from "../types/api";
import { inputClass } from "../lib/uiClasses";

function formatCommentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function IconMessageSquare(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconPlus(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function IconCalendar(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function IconPencil(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function IconTrash(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function CommentBody({ text }: { text: string }) {
  const pRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = pRef.current;
    if (!el || expanded) return;
    setCanToggle(el.scrollHeight > el.clientHeight + 1);
  }, [expanded, text]);

  useLayoutEffect(() => {
    checkOverflow();
  }, [checkOverflow, text]);

  useEffect(() => {
    const el = pRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => checkOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkOverflow]);

  return (
    <div className="mt-2">
      <p
        ref={pRef}
        className={`m-0 whitespace-pre-wrap text-sm leading-relaxed text-white/75 ${
          expanded ? "" : "line-clamp-4"
        }`}
      >
        {text}
      </p>
      {canToggle ? (
        <button
          type="button"
          className="mt-1.5 cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-[#646cff] hover:underline"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

export default function IssueComments({ issue }: { issue: Issue }) {
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commenter, setCommenter] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCommenter, setEditCommenter] = useState("");
  const [editBody, setEditBody] = useState("");
  const [addFormOpen, setAddFormOpen] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issue.id}/comments`);
      const data = (await res.json()) as CommentsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setComments(data.comments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [issue.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commenter.trim();
    if (!trimmed) {
      setError("Commenter is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commenter: trimmed, comment: commentBody }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setCommenter("");
      setCommentBody("");
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: IssueComment) => {
    setEditingId(c.id);
    setEditCommenter(c.commenter);
    setEditBody(c.comment);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCommenter("");
    setEditBody("");
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const trimmed = editCommenter.trim();
    if (!trimmed) {
      setError("Commenter is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commenter: trimmed, comment: editBody }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      cancelEdit();
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: IssueComment) => {
    if (!window.confirm("Delete this comment?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/comments/${c.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      if (editingId === c.id) cancelEdit();
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left shadow-sm shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-[#646cff]">
            <IconMessageSquare />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 text-lg font-semibold tracking-tight text-white">
              Comments
            </h3>
            <p className="m-0 mt-0.5 text-xs text-white/45">
              Discussion on this issue
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && (
            <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 font-mono text-xs font-medium tabular-nums text-white/65">
              {comments.length}
            </span>
          )}
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            aria-expanded={addFormOpen}
            onClick={() => setAddFormOpen((o) => !o)}
          >
            <IconPlus className="text-white/70" />
            {addFormOpen ? "Close" : "Add comment"}
          </button>
        </div>
      </div>

      <div className="max-h-[min(50vh,480px)] overflow-y-auto px-5 py-5 sm:px-6">
        {error && (
          <p className="mb-4 m-0 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="m-0 flex items-center gap-2 text-sm text-white/55">
            <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" />
            Loading comments…
          </p>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center">
            <span className="rounded-full border border-white/10 bg-white/[0.05] p-3 text-white/35">
              <IconMessageSquare className="h-8 w-8" />
            </span>
            <p className="m-0 text-sm font-medium text-white/70">
              No comments yet
            </p>
            <p className="m-0 max-w-sm text-xs text-white/45">
              Start the thread with the button above, or leave a note for your
              team.
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
              >
                {editingId === c.id ? (
                  <div className="space-y-3">
                    <p className="m-0 text-xs font-medium uppercase tracking-wide text-white/40">
                      Edit comment
                    </p>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-white/55">
                        Commenter
                      </span>
                      <input
                        className={inputClass}
                        value={editCommenter}
                        onChange={(e) => setEditCommenter(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-white/55">
                        Comment
                      </span>
                      <textarea
                        className={`${inputClass} min-h-[88px] resize-y`}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#646cff] px-3 py-2 text-sm font-medium text-white hover:bg-[#535bf2] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void saveEdit()}
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        className="inline-flex cursor-pointer items-center rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-gradient-to-br from-[#646cff]/25 to-violet-500/20 text-xs font-semibold text-white/90"
                      aria-hidden
                    >
                      {initials(c.commenter)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <span className="font-semibold text-white/90">
                          {c.commenter}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.65rem] font-medium tabular-nums text-white/45">
                          #{c.id}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-white/45">
                          <IconCalendar className="text-white/35" />
                          <time dateTime={c.created_at}>
                            {formatCommentDate(c.created_at)}
                          </time>
                        </span>
                      </div>
                      <CommentBody text={c.comment} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-[#646cff] transition-colors hover:border-[#646cff]/35 hover:bg-[#646cff]/10"
                          onClick={() => startEdit(c)}
                        >
                          <IconPencil className="opacity-80" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-rose-300/90 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10"
                          onClick={() => void handleDelete(c)}
                        >
                          <IconTrash className="opacity-80" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {addFormOpen ? (
        <form
          onSubmit={(e) => void handleSubmitNew(e)}
          className="border-t border-white/10 bg-white/[0.02] px-5 py-5 sm:px-6"
        >
          <p className="mb-4 m-0 text-xs font-medium uppercase tracking-wide text-white/40">
            New comment
          </p>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/55">
                Commenter
              </span>
              <input
                className={inputClass}
                value={commenter}
                onChange={(e) => setCommenter(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/55">
                Comment
              </span>
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={4}
                placeholder="Write your message…"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-[#646cff] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#535bf2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Posting…
                </>
              ) : (
                <>
                  <IconPlus className="h-4 w-4" />
                  Post comment
                </>
              )}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
