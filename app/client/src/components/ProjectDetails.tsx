import { useEffect, useRef, useState } from "react";
import type { Project } from "../types/api";

function IconSliders(props: { className?: string }) {
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
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </svg>
  );
}

function ProjectDetails({
  project,
  onEdit,
}: {
  project: Project;
  onEdit: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [dropdownOpen]);
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left shadow-sm shadow-black/20">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-[#646cff]">
            <IconSliders />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 text-lg font-semibold tracking-tight text-white">
              Project details
            </h3>
            <p className="m-0 mt-0.5 text-xs text-white/45">
              Repository and AI settings
            </p>
          </div>
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            className="flex cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] p-2 text-white/80 transition-colors hover:bg-white/10"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            aria-label="Project actions"
          >
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
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          {dropdownOpen && (
            <ul
              className="absolute right-0 top-full z-[100] mt-1 min-w-[10rem] list-none rounded-md border border-white/12 bg-[#1a1a1a] p-1 shadow-lg"
              role="menu"
            >
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer border-0 bg-transparent px-4 py-2 text-left text-sm text-inherit hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(false);
                    onEdit();
                  }}
                >
                  Edit project
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>

      <dl className="m-0 list-none px-5 py-4 sm:px-6">
        <div className="mb-3 border-b border-white/10 pb-3 last:mb-0 last:border-b-0 last:pb-0">
          <dt className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-white/50">
            Work directory
          </dt>
          <dd className="m-0 break-all text-[0.80rem] text-white/80">
            {project.workdir ?? "-"}
          </dd>
        </div>
        <div className="mb-3 border-b border-white/10 pb-3 capitalize last:mb-0 last:border-b-0 last:pb-0">
          <dt className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-white/50">
            Repository
          </dt>
          <dd className="m-0 break-all text-[0.80rem] text-white/80">
            {project.repository ?? "-"}
          </dd>
        </div>
        <div className="mb-3 border-b border-white/10 pb-3 capitalize last:mb-0 last:border-b-0 last:pb-0">
          <dt className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-white/50">
            Base branch
          </dt>
          <dd className="m-0 break-all text-[0.80rem] text-white/80">
            {project.base_branch ?? "-"}
          </dd>
        </div>
        <div className="mb-3 border-b border-white/10 pb-3 last:mb-0 last:border-b-0 last:pb-0">
          <dt className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-white/50">
            Credentials
          </dt>
          <dd className="m-0 break-all text-[0.80rem] text-white/80">
            <pre className="w-full whitespace-pre-wrap text-[0.70rem]">
              {project.credentials}
            </pre>
          </dd>
        </div>
        <div className="mb-3 flex gap-6 border-b border-white/10 pb-3 capitalize last:mb-0 last:border-b-0 last:pb-0">
          <dt className="w-1/3 shrink-0 text-[0.65rem] font-medium uppercase tracking-wide text-white/50">
            AI provider
          </dt>
          <dd className="min-w-0 break-all text-[0.80rem] text-white/80">
            {project.ai_provider ?? "-"}
          </dd>
        </div>
        <div className="mb-3 flex gap-6 border-b border-white/10 pb-3 capitalize last:mb-0 last:border-b-0 last:pb-0">
          <dt className="w-1/3 shrink-0 text-[0.65rem] font-medium uppercase tracking-wide text-white/50">
            AI model
          </dt>
          <dd className="m-0 min-w-0 break-all text-[0.80rem] text-white/80">
            {project.ai_model ?? "-"}
          </dd>
        </div>
        <div className="flex gap-6 capitalize">
          <dt className="w-1/3 shrink-0 text-[0.65rem] font-medium uppercase tracking-wide text-white/50">
            AI path
          </dt>
          <dd className="m-0 min-w-0 break-all text-[0.80rem] text-white/80">
            {project.ai_path ?? "-"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default ProjectDetails;
