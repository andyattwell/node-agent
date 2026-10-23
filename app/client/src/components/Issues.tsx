import { useCallback, useEffect, useState } from "react";
import type { Issue, IssuesResponse } from "../types/api";
import IssueForm from "./IssueForm";
import { priorityStyles, statusStyles, typeStyles } from "../lib/issueStyles";

interface IssuesProps {
  projectId: string;
}

function IconListTodo(props: { className?: string }) {
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
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m3 17 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
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

export default function Issues({ projectId }: IssuesProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Issue | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/issues?project_id=${encodeURIComponent(projectId)}`).then(
        (res) => res.json(),
      ) as Promise<IssuesResponse>,
    ])
      .then(([issuesJson]) => {
        setIssues(issuesJson.issues ?? []);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load issues"),
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (issue: Issue) => {
    if (!window.confirm(`Delete issue “${issue.title}”?`)) return;
    try {
      const res = await fetch(`/api/issues/${issue.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <p className="mb-8 flex items-center gap-2 text-white/70">
        <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" />
        Loading issues…
      </p>
    );
  }
  if (error) {
    return (
      <p className="mb-8 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  return (
    <section className="mb-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left shadow-sm shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-[#646cff]">
            <IconListTodo />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-semibold tracking-tight text-white">
              Issues
            </h2>
            <p className="m-0 mt-0.5 text-xs text-white/45">
              Work items for this project
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 font-mono text-xs font-medium tabular-nums text-white/65">
            {issues.length}
          </span>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <IconPlus className="text-white/70" />
            Add issue
          </button>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center">
            <span className="rounded-full border border-white/10 bg-white/[0.05] p-3 text-white/35">
              <IconListTodo className="h-8 w-8" />
            </span>
            <p className="m-0 text-sm font-medium text-white/70">
              No issues yet
            </p>
            <p className="m-0 max-w-sm text-xs text-white/45">
              Add an issue to track bugs, features, or chores for this project.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="px-3 py-2.5 font-medium text-white/80">
                    Title
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-white/80">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-white/80">
                    Priority
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-white/80">
                    Type
                  </th>
                  <th className="px-3 py-2.5 font-medium text-white/80">
                    adw_id
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-white/80">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="border-b border-white/10 transition-colors last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="max-w-[220px] px-3 py-3 align-top">
                      <a
                        href={`#/projects/${encodeURIComponent(projectId)}/issues/${issue.id}`}
                        className="font-semibold text-[#646cff] no-underline hover:underline"
                      >
                        #{issue.id} - {issue.title}
                      </a>
                      {issue.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-white/50">
                          {issue.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles(issue.status)}`}
                      >
                        {issue.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${priorityStyles(issue.priority)}`}
                      >
                        {issue.priority}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${typeStyles(issue.type)}`}
                      >
                        {issue.type}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-3 align-top font-mono text-xs text-white/65">
                      {issue.adw_id ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-[#646cff] transition-colors hover:border-[#646cff]/35 hover:bg-[#646cff]/10"
                          onClick={() => {
                            setEditing(issue);
                            setDialogOpen(true);
                          }}
                        >
                          <IconPencil className="opacity-80" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-rose-300/90 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10"
                          onClick={() => handleDelete(issue)}
                        >
                          <IconTrash className="opacity-80" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IssueForm
        open={dialogOpen}
        projectId={projectId}
        initial={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSaved={load}
      />
    </section>
  );
}
