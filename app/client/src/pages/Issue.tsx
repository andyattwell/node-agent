import { useEffect, useState } from "react";
import type { Issue as IssueModel } from "../types/api";
import IssueComments from "../components/IssueComments";
import Jobs from "../components/Jobs";
import {
  formatShortDate,
  priorityStyles,
  statusStyles,
  typeStyles,
} from "../lib/issueStyles";

interface IssuePageProps {
  projectId: string;
  issueId: string;
}

interface IssueResponse {
  issue: IssueModel;
}

export default function Issue({ projectId, issueId }: IssuePageProps) {
  const [issue, setIssue] = useState<IssueModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pid = projectId.trim();
    const iid = issueId.trim();
    if (!pid || !iid) {
      setError("Invalid project or issue ID");
      setLoading(false);
      return;
    }
    const n = Number(iid);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      setError("Invalid issue ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setIssue(null);
    fetch(`/api/issues/${encodeURIComponent(iid)}`)
      .then((res) =>
        res.json().then((data: IssueResponse & { error?: string }) => {
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          return data.issue;
        }),
      )
      .then((loaded) => {
        if (String(loaded.project_id) !== pid) {
          throw new Error("Issue does not belong to this project");
        }
        setIssue(loaded);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load issue"),
      )
      .finally(() => setLoading(false));
  }, [projectId, issueId]);

  if (loading) {
    return <p className="text-white/70">Loading issue…</p>;
  }
  if (error) {
    return (
      <div className="text-left">
        <p className="text-white/70 text-red-400">{error}</p>
        <a
          href={`#/projects/${encodeURIComponent(projectId.trim())}`}
          className="mb-4 inline-block text-sm text-[#646cff] no-underline hover:underline"
        >
          Back to project
        </a>
      </div>
    );
  }
  if (!issue) {
    return null;
  }

  const backHref = `#/projects/${encodeURIComponent(projectId.trim())}`;

  return (
    <div className="text-left">
      <a
        href={backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/65 no-underline transition-colors hover:text-[#646cff]"
      >
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
          aria-hidden
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to project
      </a>

      <header className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-sm shadow-black/20 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <span className="inline-flex shrink-0 items-center rounded-md border border-white/12 bg-white/[0.06] px-2 py-1 font-mono text-xs font-medium tabular-nums text-white/70">
            #{issue.id}
          </span>
          <h1 className="m-0 min-w-0 flex-1 text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
            {issue.title}
          </h1>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles(issue.status)}`}
          >
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
              className="opacity-90"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
            </svg>
            {issue.status.replace(/_/g, " ")}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${priorityStyles(issue.priority)}`}
          >
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
              className="opacity-90"
              aria-hidden
            >
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" x2="4" y1="22" y2="15" />
            </svg>
            {issue.priority}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${typeStyles(issue.type)}`}
          >
            {issue.type === "bug" ? (
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
                className="opacity-90"
                aria-hidden
              >
                <path d="m8 2 1.88 1.88" />
                <path d="M14.12 3.88 16 2" />
                <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
                <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
                <path d="M12 20v-9" />
                <path d="M6.53 9C4.6 8.75 3 7.05 3 5" />
                <path d="M6 13H2" />
                <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
                <path d="M20.97 5c0 2.1-1.6 3.85-3.55 4" />
                <path d="M22 13h-4" />
                <path d="M17 21c0-2.1 1.7-3.9 3.8-4" />
              </svg>
            ) : issue.type === "feature" ? (
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
                className="opacity-90"
                aria-hidden
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            ) : (
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
                className="opacity-90"
                aria-hidden
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            )}
            {issue.type}
          </span>
        </div>

        {issue.description ? (
          <p className="m-0 mb-5 whitespace-pre-wrap border-t border-white/10 pt-4 text-sm leading-relaxed text-white/75">
            {issue.description}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 text-xs text-white/55 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2">
          <span className="inline-flex items-center gap-2">
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
              className="shrink-0 text-white/40"
              aria-hidden
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            <span className="font-medium uppercase tracking-wide text-white/40">
              Created
            </span>
            <span className="text-white/75">
              {formatShortDate(issue.created_at)}
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
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
              className="shrink-0 text-white/40"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="font-medium uppercase tracking-wide text-white/40">
              Updated
            </span>
            <span className="text-white/75">
              {formatShortDate(issue.updated_at)}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-2 sm:max-w-full">
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
              className="shrink-0 text-white/40"
              aria-hidden
            >
              <line x1="4" x2="20" y1="9" y2="9" />
              <line x1="4" x2="20" y1="15" y2="15" />
              <line x1="10" x2="8" y1="3" y2="21" />
              <line x1="16" x2="14" y1="3" y2="21" />
            </svg>
            <span className="font-medium uppercase tracking-wide text-white/40">
              Latest run
            </span>
            <code className="truncate font-mono text-[0.7rem] text-white/80">
              {issue.adw_id ?? "-"}
            </code>
          </span>
        </div>
      </header>
      <IssueComments issue={issue} />
      <Jobs projectId={projectId} issueId={issueId} />
    </div>
  );
}
