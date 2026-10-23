import type { IssuePriority, IssueStatus, IssueType } from "../types/api";

export function statusStyles(status: IssueStatus): string {
  const map: Record<IssueStatus, string> = {
    open: "border-sky-500/35 bg-sky-500/15 text-sky-200",
    started: "border-amber-500/35 bg-amber-500/15 text-amber-100",
    planning: "border-amber-500/35 bg-amber-500/15 text-amber-100",
    implementing: "border-violet-500/35 bg-violet-500/15 text-violet-100",
    testing: "border-violet-500/35 bg-violet-500/15 text-violet-100",
    pr: "border-indigo-500/35 bg-indigo-500/15 text-indigo-100",
    reviewing: "border-indigo-500/35 bg-indigo-500/15 text-indigo-100",
    completed: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100",
    error: "border-rose-500/35 bg-rose-500/15 text-rose-100",
    cancelled: "border-white/15 bg-white/5 text-white/55",
    draft: "border-white/15 bg-white/5 text-white/55",
  };
  return map[status] ?? map.draft;
}

export function priorityStyles(priority: IssuePriority): string {
  const map: Record<IssuePriority, string> = {
    low: "border-white/15 bg-white/5 text-white/60",
    medium: "border-amber-500/30 bg-amber-500/12 text-amber-100",
    high: "border-orange-500/40 bg-orange-500/15 text-orange-100",
  };
  return map[priority];
}

export function typeStyles(type: IssueType): string {
  const map: Record<IssueType, string> = {
    feature: "border-blue-500/30 bg-blue-500/12 text-blue-100",
    bug: "border-rose-500/30 bg-rose-500/12 text-rose-100",
    chore: "border-slate-400/25 bg-slate-500/15 text-slate-200",
  };
  return map[type];
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
