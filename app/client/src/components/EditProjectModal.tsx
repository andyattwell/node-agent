import { useState } from "react";
import type { Project } from "../types/api";
import {
  formFieldCaptionClass,
  inputClass,
  modalDialogClass,
  sectionLabelClass,
} from "../lib/uiClasses";

interface EditProjectModalProps {
  onClose: () => void;
  project: Project;
  onSuccess: (project: Project) => void;
}

export default function EditProjectModal({
  onClose,
  project,
  onSuccess,
}: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [workdir, setWorkdir] = useState(project.workdir ?? "");
  const [repository, setRepository] = useState(project.repository ?? "");
  const [baseBranch, setBaseBranch] = useState(project.base_branch ?? "");
  const [credentials, setCredentials] = useState(project.credentials ?? "");
  const [clearCredentials, setClearCredentials] = useState(false);
  const [aiProvider, setAiProvider] = useState(project.ai_provider ?? "");
  const [aiPath, setAiPath] = useState(project.ai_path ?? "");
  const [aiModel, setAiModel] = useState(project.ai_model ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        workdir: workdir.trim() || null,
        repository: repository.trim() || null,
        base_branch: baseBranch.trim() || null,
        ai_provider: aiProvider.trim() || null,
        ai_path: aiPath.trim() || null,
        ai_model: aiModel.trim() || null,
      };
      if (clearCredentials) {
        body.credentials = null;
      } else if (credentials.trim()) {
        body.credentials = credentials.trim();
      }

      const res = await fetch(
        `/api/projects/${encodeURIComponent(String(project.id))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { project?: Project; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.project) {
        onSuccess(data.project);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSubmitting(false);
    }
  };

  const hasStoredCredentials = Boolean(project.credentials);

  return (
    <dialog
      className={modalDialogClass}
      open
      onClose={handleClose}
      onCancel={handleClose}
    >
      <form onSubmit={handleSubmit} className="p-0">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h3 className="m-0 text-lg font-semibold tracking-tight text-white">
              Edit project
            </h3>
            <p className="m-0 mt-0.5 text-xs text-white/45">
              {project.name} · #{project.id}
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] p-2 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="space-y-6 p-5 sm:px-6">
          {error && (
            <p
              className="m-0 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
              role="alert"
            >
              {error}
            </p>
          )}
          <section className="space-y-3">
            <h4 className={`${sectionLabelClass} mb-0`}>Project</h4>
            <label className="block">
              <span className={formFieldCaptionClass}>
                Name <span className="text-rose-400/90">*</span>
              </span>
              <input
                id="edit-project-name"
                type="text"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                required
                autoFocus
                disabled={submitting}
              />
            </label>
            <label className="block">
              <span className={formFieldCaptionClass}>Work directory</span>
              <input
                id="edit-project-workdir"
                type="text"
                className={inputClass}
                value={workdir}
                onChange={(e) => setWorkdir(e.target.value)}
                placeholder="e.g. /path/to/repo"
                disabled={submitting}
              />
            </label>
          </section>
          <section className="space-y-3 border-t border-white/10 pt-5">
            <h4 className={`${sectionLabelClass} mb-0`}>Repository</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={formFieldCaptionClass}>Repository URL</span>
                <input
                  id="edit-project-repository"
                  type="text"
                  className={inputClass}
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className={formFieldCaptionClass}>Base branch</span>
                <input
                  id="edit-project-base-branch"
                  type="text"
                  className={inputClass}
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  placeholder="main"
                  disabled={submitting}
                />
              </label>
            </div>
            <label className="block">
              <span className={formFieldCaptionClass}>Credentials</span>
              <textarea
                id="edit-project-credentials"
                className={`${inputClass} min-h-[72px] resize-y text-sm leading-snug`}
                value={credentials}
                onChange={(e) => {
                  setCredentials(e.target.value);
                  if (e.target.value) setClearCredentials(false);
                }}
                placeholder={
                  hasStoredCredentials
                    ? "Leave blank to keep existing; enter new to replace"
                    : "Optional credentials"
                }
                disabled={submitting || clearCredentials}
                rows={3}
              />
            </label>
            {hasStoredCredentials && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/60">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-white/20 bg-white/[0.06] text-[#646cff] focus:ring-[#646cff]/40"
                  checked={clearCredentials}
                  onChange={(e) => {
                    setClearCredentials(e.target.checked);
                    if (e.target.checked) setCredentials("");
                  }}
                  disabled={submitting}
                />
                Remove saved credentials
              </label>
            )}
          </section>
          <section className="space-y-3 border-t border-white/10 pt-5">
            <h4 className={`${sectionLabelClass} mb-0`}>Agent</h4>
            <label className="block">
              <span className={formFieldCaptionClass}>AI provider</span>
              <input
                id="edit-project-ai-provider"
                type="text"
                className={inputClass}
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                placeholder="cursor, llama_cpp, gemini, none…"
                disabled={submitting}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={formFieldCaptionClass}>
                  AI path / base URL
                </span>
                <input
                  id="edit-project-ai-path"
                  type="text"
                  className={inputClass}
                  value={aiPath}
                  onChange={(e) => setAiPath(e.target.value)}
                  placeholder="Cursor binary, Ollama, or llama-server URL"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className={formFieldCaptionClass}>AI model</span>
                <input
                  id="edit-project-ai-model"
                  type="text"
                  className={inputClass}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="Model id or GGUF path"
                  disabled={submitting}
                />
              </label>
            </div>
          </section>
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4 sm:px-6">
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-lg border-0 bg-[#646cff] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#535bf2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
