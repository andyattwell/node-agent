/** Shared form + surface classes (task-manager style). */

export const inputClass =
  "w-full box-border rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-base text-inherit outline-none placeholder:text-white/40 focus:border-[#646cff]/50 focus:ring-1 focus:ring-[#646cff]/30 disabled:cursor-not-allowed disabled:opacity-70";

export const modalDialogClass =
  "fixed z-[10000] w-[90%] max-w-[660px] max-h-[80vh] top-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] p-0 text-inherit shadow-xl shadow-black/40";

export const modalWideDialogClass =
  "fixed left-1/2 top-1/2 z-[1000] h-[80%] w-[90%] max-w-[1200px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] p-0 text-inherit shadow-xl shadow-black/40 flex flex-col";

export const cardSurfaceClass =
  "rounded-xl border border-white/10 bg-white/[0.03] shadow-sm shadow-black/20";

export const sectionLabelClass =
  "text-[0.65rem] font-medium uppercase tracking-wide text-white/50";

/** Matches IssueForm field captions (task-manager forms). */
export const formFieldCaptionClass =
  "mb-1.5 block text-xs font-medium text-white/55";
