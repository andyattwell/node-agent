import { useCallback, useEffect, useState } from "react";
import CreateProjectModal from "../components/CreateProjectModal";
import type { ProjectsResponse } from "../types/api";
import { formatShortDate } from "../lib/issueStyles";

function IconFolder(props: { className?: string }) {
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
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.9-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
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

function Projects() {
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchProjects = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/projects")
      .then((res) => res.json())
      .then((json: ProjectsResponse) => setData(json))
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : "Failed to load projects",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateSuccess = useCallback(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (loading) {
    return (
      <p className="my-8 flex items-center gap-2 text-white/70">
        <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" />
        Loading projects…
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

  const { projects } = data;

  const handleDeleteProject = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this project?")) {
      return;
    }
    fetch(`/api/projects/${id}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .then((json: { status: string; id: number }) => {
        if (json.status === "deleted") {
          fetchProjects();
        }
      })
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : "Failed to delete project",
        ),
      );
  };

  return (
    <div className="text-left">
      <section className="mb-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-sm shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-[#646cff]">
              <IconFolder />
            </span>
            <div className="min-w-0">
              <h1 className="m-0 text-lg font-semibold tracking-tight text-white sm:text-xl">
                Projects
              </h1>
              <p className="m-0 mt-0.5 text-xs text-white/45">
                Repositories and workspaces
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 font-mono text-xs font-medium tabular-nums text-white/65">
              {projects.length}
            </span>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#646cff] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#535bf2]"
              onClick={() => setCreateModalOpen(true)}
            >
              <IconPlus className="h-4 w-4" />
              Create project
            </button>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
              <span className="rounded-full border border-white/10 bg-white/[0.05] p-3 text-white/35">
                <IconFolder className="h-8 w-8" />
              </span>
              <p className="m-0 text-sm font-medium text-white/70">
                No projects yet
              </p>
              <p className="m-0 max-w-sm text-xs text-white/45">
                Create a project to connect a repository and start tracking
                issues.
              </p>
            </div>
          ) : (
            <ul className="m-0 list-none space-y-3 p-0" aria-label="Project list">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] transition-colors hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <a
                      href={`#/projects/${project.id}`}
                      className="group min-w-0 flex-1 text-inherit no-underline"
                    >
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <span className="inline-flex shrink-0 items-center rounded-md border border-white/12 bg-white/[0.06] px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-white/70">
                          #{project.id}
                        </span>
                        <span className="font-semibold text-white/90 group-hover:text-[#646cff]">
                          {project.name}
                        </span>
                      </div>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-white/45">
                        <IconCalendar className="text-white/35" />
                        <span>Created {formatShortDate(project.created_at)}</span>
                      </span>
                    </a>
                    <button
                      type="button"
                      className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 self-start rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-rose-300/90 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 sm:self-center"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteProject(project.id);
                      }}
                    >
                      <IconTrash className="opacity-80" />
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}

export default Projects;
