import { useEffect, useState } from "react";
import type { Project } from "../types/api";
import EditProjectModal from "../components/EditProjectModal";
import Issues from "../components/Issues";
import ProjectDetails from "../components/ProjectDetails";
import { formatShortDate } from "../lib/issueStyles";

interface ProjectDetailProps {
  projectId: string;
}

interface ProjectResponse {
  project: Project;
}

export default function Project({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    const id = projectId.trim();
    if (!id) {
      setError("Invalid project ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setProject(null);
    fetch(`/api/projects/${encodeURIComponent(id)}`)
      .then((res) =>
        res.json().then((data: ProjectResponse & { error?: string }) => {
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          setProject(data.project);
        }),
      )
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load project"),
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-white/70">
        <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" />
        Loading project…
      </p>
    );
  }
  if (error) {
    return (
      <div className="text-left">
        <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
        <a
          href="#/projects"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/65 no-underline transition-colors hover:text-[#646cff]"
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
          Back to projects
        </a>
      </div>
    );
  }
  if (!project) {
    return null;
  }

  return (
    <div className="text-left">
      <a
        href="#/projects"
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
        Back to projects
      </a>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0 flex-1">
          <header className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-sm shadow-black/20 sm:p-6">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <span className="inline-flex shrink-0 items-center rounded-md border border-white/12 bg-white/[0.06] px-2 py-1 font-mono text-xs font-medium tabular-nums text-white/70">
                #{project.id}
              </span>
              <h1 className="m-0 min-w-0 flex-1 text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
                {project.name}
              </h1>
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 text-xs text-white/55 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
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
                  {formatShortDate(project.created_at)}
                </span>
              </span>
            </div>
          </header>

          <Issues projectId={projectId} />
        </div>

        <aside className="shrink-0 lg:w-80 xl:w-96">
          <ProjectDetails
            project={project}
            onEdit={() => setEditModalOpen(true)}
          />
        </aside>
      </div>

      {editModalOpen && (
        <EditProjectModal
          project={project}
          onClose={() => setEditModalOpen(false)}
          onSuccess={(updated) => setProject(updated)}
        />
      )}
    </div>
  );
}
