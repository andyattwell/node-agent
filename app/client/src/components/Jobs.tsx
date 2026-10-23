import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type {
  AdwStateEntry,
  AdwsForIssueResponse,
  Job,
  JobsResponse,
} from "../types/api";
import RunForm from "./RunForm";
import JobDetail from "./JobDetail";
import { cardSurfaceClass } from "../lib/uiClasses";

function IconTrashSmall() {
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
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

const JOB_STEP_COLORS: Record<string, string> = {
  unknown: "text-red-600 dark:text-red-500",
  await_classify: "text-[rgb(221,191,59)]",
  await_plan: "text-[rgb(183,221,59)]",
  await_implement: "text-[rgb(123,204,99)]",
  await_test: "text-[rgb(99,176,204)]",
  await_pr: "text-[rgb(118,124,237)]",
  await_review: "text-[rgb(179,118,237)]",
  report: "text-[rgb(237,118,201)]",
};

const jobStatusIcon = (status: string, step: string) => {
  if (step === "report") {
    return "🏁";
  }
  switch (status) {
    case "done":
      return "✅";
    case "failed":
      return "❌";
    case "error":
      return "❌";
    case "pending":
      return "⏳";
    case "running":
      return "⏳";
    case "stopped":
      return "🛑";
    case "unknown":
      return "❓";
  }
  return "❌";
};

function JobRow({
  job,
  isSelected,
  onSelect,
  onDelete,
  deleteDisabled,
}: {
  job: Job;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: MouseEvent) => void;
  deleteDisabled: boolean;
}) {
  const step = job.step ?? "unknown";
  const stepColor = JOB_STEP_COLORS[step] ?? JOB_STEP_COLORS.unknown;
  return (
    <li
      role="button"
      tabIndex={0}
      className={`grid grid-cols-[30px_auto_1fr_auto_2rem] items-center gap-4 rounded-lg border px-3 py-2.5 mb-1.5 cursor-pointer transition-[background,border-color] duration-150 focus:outline focus:outline-2 focus:outline-[#646cff] focus:outline-offset-2 ${
        isSelected
          ? "border-[#646cff]/40 bg-[#646cff]/12"
          : "border-white/10 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
      }`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="text-center lowercase [&>span]:inline-block [&>span]:size-4 [&>span]:rounded-full">
        <span title={job.status ?? "Unknown"}>
          {jobStatusIcon(job.status ?? "unknown", job.step ?? "unknown")}
        </span>
      </span>
      <span className="text-[0.85rem]">#{job.id}</span>
      <span
        className="max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.85rem] text-white/65"
        title={job.prompt}
      >
        {job.prompt.slice(0, 20)}…
      </span>
      <span
        className={`overflow-hidden text-ellipsis whitespace-nowrap text-xs text-white/70 ${stepColor}`}
      >
        {step.replace("await_", "") ?? "-"}
      </span>
      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-rose-300/90 transition-[color,background] duration-150 hover:bg-rose-500/15 hover:border-rose-500/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label={`Delete job ${job.id}`}
        disabled={deleteDisabled}
        onClick={onDelete}
      >
        <IconTrashSmall />
      </button>
    </li>
  );
}

function AdwRow({
  group,
  isSelected,
  onSelect,
}: {
  group: AdwStateEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const display =
    group.adwId.length > 28
      ? `${group.adwId.slice(0, 14)}…${group.adwId.slice(-10)}`
      : group.adwId;
  const step = group.currentStep;
  return (
    <li
      role="button"
      tabIndex={0}
      className={`rounded-lg border px-3 py-2.5 mb-1.5 cursor-pointer transition-[background,border-color] duration-150 focus:outline focus:outline-2 focus:outline-[#646cff] focus:outline-offset-2 ${
        isSelected
          ? "border-[#646cff]/40 bg-[#646cff]/12"
          : "border-white/10 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
      }`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div
        className="font-mono text-[0.8rem] text-white/85 overflow-hidden text-ellipsis whitespace-nowrap"
        title={group.currentStep}
      >
        {display}
      </div>
      <div className="text-xs text-white/50 mt-0.5">
        {step ? (
          <span className="block mt-0.5 text-white/45 truncate" title={step}>
            {step}
          </span>
        ) : null}
      </div>
    </li>
  );
}

interface JobsProps {
  projectId: string;
  issueId?: string;
}

export default function Jobs({ projectId, issueId }: JobsProps) {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [adws, setAdws] = useState<AdwStateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAdwKey, setSelectedAdwKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const issueIdTrimmed = issueId?.trim() ?? "";

  useEffect(() => {
    setData(null);
    setAdws([]);
    setError(null);
    setSelectedAdwKey(null);
    setSelectedId(null);
    setLoading(true);
  }, [issueIdTrimmed]);

  const loadAdws = useCallback(() => {
    if (!issueIdTrimmed) {
      setLoading(false);
      setError("Missing issue ID");
      return;
    }
    const q = encodeURIComponent(issueIdTrimmed);
    fetch(`/api/adw/${q}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`ADW list request failed (${res.status})`);
        }
        return res.json() as Promise<AdwsForIssueResponse>;
      })
      .then((adwsJson) => {
        setAdws(Array.isArray(adwsJson.adws) ? adwsJson.adws : []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load ADWs");
      })
      .finally(() => setLoading(false));
  }, [issueIdTrimmed]);

  useEffect(() => {
    loadAdws();
    const interval = setInterval(() => {
      loadAdws();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadAdws]);

  const loadJobs = useCallback(() => {
    if (!selectedAdwKey) {
      setLoading(false);
      return;
    }
    const q = encodeURIComponent(selectedAdwKey);
    Promise.all([fetch(`/api/jobs?adw_id=${q}`)])
      .then(async ([jobsRes]) => {
        const jobsJson = (await jobsRes.json()) as JobsResponse & {
          error?: string;
        };
        if (!jobsRes.ok) {
          throw new Error(
            jobsJson.error ?? `Jobs request failed (${jobsRes.status})`,
          );
        }
        setData(jobsJson);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load jobs"),
      )
      .finally(() => setLoading(false));
  }, [selectedAdwKey]);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(() => {
      loadJobs();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const jobs = data?.jobs ?? [];

  useEffect(() => {
    if (adws.length === 0) {
      setSelectedAdwKey(null);
      setSelectedId(null);
      return;
    }
    const keys = new Set(adws.map((g) => g.adwId));
    if (selectedAdwKey == null || !keys.has(selectedAdwKey)) {
      setSelectedAdwKey(adws[0].adwId);
    }
  }, [adws, selectedAdwKey]);

  // const jobsForSelectedAdw = useMemo(() => {
  //   if (selectedAdwKey == null) return [];
  //   const g = adwRows.find((x) => x.key === selectedAdwKey);
  //   return g?.jobs ?? [];
  // }, [adwRows, selectedAdwKey]);

  // useEffect(() => {
  //   if (selectedId == null) return;
  //   const stillThere = jobsForSelectedAdw.some((j) => j.id === selectedId);
  //   if (!stillThere) setSelectedId(null);
  // }, [jobsForSelectedAdw, selectedId]);

  const handleDeleteJob = async (id: number, e: MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/job/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        console.error("Failed to delete", data.error ?? `HTTP ${res.status}`);
        return;
      }
      if (selectedId === id) setSelectedId(null);
      loadJobs();
    } finally {
      setDeletingId(null);
    }
  };

  if (!issueIdTrimmed) {
    return (
      <p className="my-8 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        Missing issue ID
      </p>
    );
  }

  if (loading) {
    return (
      <p className="my-8 flex items-center gap-2 text-white/70">
        <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" />
        Loading jobs…
      </p>
    );
  }
  if (error) {
    return (
      <p className="my-8 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {error}
      </p>
    );
  }
  if (!data) return null;

  const selected: Job | null = selectedId
    ? (jobs.find((e: Job) => e.id === selectedId) ?? null)
    : null;

  return (
    <div className="mx-auto text-left">
      <RunForm
        onSuccess={() => {
          loadJobs();
        }}
        projectId={projectId}
        issueId={issueId}
      />
      <div
        className={`flex flex-wrap items-start gap-4 min-h-[12rem] p-5 sm:p-6 ${cardSurfaceClass}`}
      >
        <div className="w-[220px] shrink-0">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
            ADWs
          </h2>
          <ul
            className="m-0 shrink-0 list-none overflow-auto border-r border-white/10 p-0 pr-3 max-h-[70vh]"
            aria-label="ADW list"
          >
            {adws.map((group) => (
              <AdwRow
                key={group.adwId}
                group={group}
                isSelected={group.adwId === selectedAdwKey}
                onSelect={() => {
                  setSelectedAdwKey(group.adwId);
                  setSelectedId(null);
                }}
              />
            ))}
          </ul>
        </div>
        <div className="w-[300px] shrink-0">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
            Jobs
          </h2>
          <ul
            className="m-0 list-none overflow-auto border-r border-white/10 p-0 px-2 max-h-[70vh]"
            aria-label="Jobs for selected ADW"
          >
            {selectedAdwKey == null ? (
              <li className="px-2 text-sm text-white/50">Select an ADW</li>
            ) : jobs.length === 0 ? (
              <li className="px-2 text-sm text-white/50">
                No jobs in this ADW
              </li>
            ) : (
              jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  isSelected={job.id === selectedId}
                  onSelect={() => setSelectedId(job.id)}
                  onDelete={(e) => handleDeleteJob(job.id, e)}
                  deleteDisabled={deletingId === job.id}
                />
              ))
            )}
          </ul>
        </div>
        <div className="min-w-0 flex-1 min-h-[12rem] pl-0 sm:pl-2">
          {selected && (
            <JobDetail
              jobId={selected.id}
              onClose={() => setSelectedId(null)}
              onReload={loadJobs}
            />
          )}
        </div>
      </div>
    </div>
  );
}
