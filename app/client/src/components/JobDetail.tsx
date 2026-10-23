import React, { useEffect, useState } from "react";
import type { Job, JobState } from "../types/api";
import FileViewerModal from "./FileViewerModal";
import FileLink from "./FileLink";
import RunsList from "./RunList";
import { ADW_STEPS_DESCRIPTIONS } from "../utils/agents";
import StepDetailSection from "./JobSection";

export default function JobDetail({
  jobId,
  onClose,
  onReload,
}: React.PropsWithChildren<{
  jobId: number;
  onClose: () => void;
  onReload: () => void;
}>) {
  const [job, setJob] = useState<Job | null>(null);
  const [fileViewerPath, setFileViewerPath] = useState<string | null>(null);
  const handleOpenFile = (path: string) => {
    console.log("path", path);
    setFileViewerPath(path);
  };
  const handleStop = async (pid: number, adwId: string) => {
    const res = await fetch("/api/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, adwId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      console.error("Failed to stop", data.error ?? `HTTP ${res.status}`);
    }
    setTimeout(() => onReload(), 1000);
  };
  const handleResume = async (adwId: string) => {
    const res = await fetch("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adwId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      console.error("Failed to resume", data.error ?? `HTTP ${res.status}`);
    }
    setTimeout(() => onReload(), 1000);
  };
  const handleStart = async (id: number) => {
    const res = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      console.error("Failed to start", data.error ?? `HTTP ${res.status}`);
    }
    setTimeout(() => onReload(), 1000);
  };
  const isRunning = job?.state?.status === "running";
  const canResume = job?.state?.status !== "running";

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/job/${job?.id}`)
        .then((res) => res.json())
        .then((data) => {
          setJob(data.job);
        });
    }, 10000);
    return () => clearInterval(interval);
  }, [job?.id]);

  useEffect(() => {
    fetch(`/api/job/${jobId}`)
      .then((res) => res.json())
      .then((data) => {
        setJob(data.job);
      });
  }, [jobId]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/job/${id}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      console.error("Failed to delete", data.error ?? `HTTP ${res.status}`);
      return;
    }
    onClose();
    onReload();
  };

  if (!job) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-white/55">
        <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" />
        Loading job…
      </div>
    );
  }

  const status = (job?.state?.status ?? "").toLowerCase();
  const badgeClass =
    status === "running"
      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
      : status === "error" || status === "failed"
        ? "bg-rose-500/20 text-rose-200 border border-rose-500/30"
        : "bg-white/10 text-white/75 border border-white/15";
  const btnPrimary =
    "rounded-lg border border-[#646cff]/40 bg-[#646cff]/20 px-3 py-1.5 text-xs font-medium text-[#c7d2fe] cursor-pointer transition-colors hover:bg-[#646cff]/30 hover:border-[#646cff]/55";
  const btnDanger =
    "rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 cursor-pointer transition-colors hover:bg-rose-500/25";

  return (
    <div className="min-w-0">
      <h2 className="m-0 mb-3 text-lg font-semibold tracking-tight text-white sm:text-xl">
        <span className="font-mono text-white/60">#{jobId}</span>{" "}
        <span className="text-white/90">{job?.prompt.slice(0, 100)}…</span>
      </h2>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-5 shadow-sm shadow-black/20 sm:px-6 sm:py-6">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
          <button
            type="button"
            className={btnDanger}
            onClick={() => handleDelete(jobId)}
          >
            Delete
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xl leading-none text-white/60 cursor-pointer transition-colors hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Overview */}
        <section className="shrink-0 mt-5">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
            Overview
          </h3>
          <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] items-baseline gap-x-8 gap-y-2 m-0 text-sm">
            <dt className="text-sm font-medium text-white/55">Status</dt>
            <dd className="flex min-h-[1.5em] flex-wrap items-center gap-3 overflow-hidden text-ellipsis m-0">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium lowercase ${badgeClass}`}
              >
                {job?.state_snapshot?.status}
              </span>
              {isRunning && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() =>
                    handleStop(job?.state_snapshot?.pid ?? 0, job?.adw_id ?? "")
                  }
                >
                  Stop
                </button>
              )}
              {canResume && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => handleResume(job?.adw_id ?? "")}
                >
                  Resume
                </button>
              )}
              {!job?.state_snapshot?.status && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => handleStart(jobId)}
                >
                  Start
                </button>
              )}
            </dd>
            <dt className="text-sm font-medium text-white/55">Current step</dt>
            <dd className="min-h-[1.5em] overflow-hidden text-ellipsis m-0">
              {ADW_STEPS_DESCRIPTIONS[
                job?.state_snapshot
                  ?.currentStep as keyof typeof ADW_STEPS_DESCRIPTIONS
              ] ?? "-"}
            </dd>
            <dt className="text-sm font-medium text-white/55">Prompt</dt>
            <dd className="max-h-24 min-h-[1.5em] overflow-y-auto overflow-hidden text-ellipsis whitespace-pre-wrap break-words pr-1 m-0">
              {job?.prompt ?? "-"}
            </dd>
          </dl>
        </section>

        {job?.runs ? <RunsList key={job.runs.name} runs={job.runs} /> : null}

        {/* Paths & branch */}
        <section className="shrink-0 mt-6">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
            Paths & branch
          </h3>
          <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] items-baseline gap-x-8 gap-y-2 m-0 text-sm">
            <dt className="text-sm font-medium text-white/55">Worktree path</dt>
            <dd className="min-h-[1.5em] overflow-hidden text-ellipsis m-0">
              <code className="break-all rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.85em] text-white/85">
                {job?.state?.workPath ?? "-"}
              </code>
            </dd>
            <dt className="text-sm font-medium text-white/55">Branch</dt>
            <dd className="min-h-[1.5em] overflow-hidden text-ellipsis m-0">
              <code className="break-all rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.85em] text-white/85">
                {job?.state?.branchName ?? "-"}
              </code>
            </dd>
            <dt className="text-sm font-medium text-white/55">Output log</dt>
            <dd className="min-h-[1.5em] m-0">
              <FileLink
                path={job?.state?.outputLogPath ?? ""}
                handleOpenFile={handleOpenFile}
              />
            </dd>
            <dt className="text-sm font-medium text-white/55">Error log</dt>
            <dd className="min-h-[1.5em] m-0">
              <FileLink
                path={job?.state?.errorLogPath ?? ""}
                handleOpenFile={handleOpenFile}
              />
            </dd>
          </dl>
        </section>

        {/* Steps */}
        <div className="mt-6 border-t border-white/10 pt-6">
          <StepDetailSection
            key={job?.id ?? ""}
            step={job?.step ?? ""}
            state={
              {
                ...job?.state_snapshot,
                adwId: job?.adw_id ?? "",
                promptPath: job?.state?.promptPath ?? "",
                statePath: job?.state?.statePath ?? "",
                implementationSummaryPath:
                  job?.state?.implementationSummaryPath ?? "",
                prUrl: job?.state?.prUrl ?? "",
                prId: job?.state?.prId ?? 0,
                reviewRetries: job?.state?.reviewRetries ?? 0,
                testResultsPath: job?.state?.testResultsPath ?? "",
                outputLogPath: job?.state?.outputLogPath ?? "",
                errorLogPath: job?.state?.errorLogPath ?? "",
              } as JobState
            }
            handleOpenFile={handleOpenFile}
          />
        </div>

        {fileViewerPath && (
          <FileViewerModal
            path={fileViewerPath ?? ""}
            onClose={() => setFileViewerPath(null)}
          />
        )}
      </div>
    </div>
  );
}
