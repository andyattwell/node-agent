import { useState } from "react";
import type { Project } from "../types/api";
import {
  formFieldCaptionClass,
  inputClass,
  modalDialogClass,
  sectionLabelClass,
} from "../lib/uiClasses";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

export default function CreateProjectModal({
  open,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [workdir, setWorkdir] = useState("");
  const [repository, setRepository] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [credentials, setCredentials] = useState("");
  const [aiProvider, setAiProvider] = useState("");
  const [aiPath, setAiPath] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setWorkdir("");
    setRepository("");
    setBaseBranch("");
    setCredentials("");
    setAiProvider("");
    setAiPath("");
    setAiModel("");
    setError(null);
  };

  const handleClose = () => {
    reset();
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
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          workdir: workdir.trim() || undefined,
          repository: repository.trim() || undefined,
          base_branch: baseBranch.trim() || undefined,
          credentials: credentials.trim() || undefined,
          ai_provider: aiProvider.trim() || undefined,
          ai_path: aiPath.trim() || undefined,
          ai_model: aiModel.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { project?: Project; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.project) {
        reset();
        onClose();
        onSuccess(data.project);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      className={modalDialogClass}
      open={open}
      onClose={handleClose}
      onCancel={handleClose}
    >
      <form onSubmit={handleSubmit} className="p-0">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h3 className="m-0 text-lg font-semibold tracking-tight text-white">
              Create project
            </h3>
            <p className="m-0 mt-0.5 text-xs text-white/45">
              Connect a repository and defaults for the agent
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
                id="create-project-name"
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
                id="create-project-workdir"
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
            <label className="block">
              <span className={formFieldCaptionClass}>Repository URL</span>
              <input
                id="create-project-repository"
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
                id="create-project-base-branch"
                type="text"
                className={inputClass}
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                placeholder="main"
                disabled={submitting}
              />
            </label>
            <label className="block">
              <span className={formFieldCaptionClass}>Credentials</span>
              <textarea
                id="create-project-credentials"
                className={`${inputClass} min-h-[72px] resize-y text-sm leading-snug`}
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder="Optional - tokens, deploy keys, or notes"
                disabled={submitting}
                rows={3}
              />
            </label>
          </section>
          <section className="space-y-3 border-t border-white/10 pt-5">
            <h4 className={`${sectionLabelClass} mb-0`}>Agent</h4>
            <label className="block">
              <span className={formFieldCaptionClass}>AI path / base URL</span>
              <input
                id="create-project-ai-path"
                type="text"
                className={inputClass}
                value={aiPath}
                onChange={(e) => setAiPath(e.target.value)}
                placeholder="Cursor binary, Ollama, or llama-server URL"
                disabled={submitting}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={formFieldCaptionClass}>AI provider</span>
                <input
                  id="create-project-ai-provider"
                  type="text"
                  className={inputClass}
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  placeholder="cursor, llama_cpp, gemini…"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className={formFieldCaptionClass}>AI model</span>
                <input
                  id="create-project-ai-model"
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
            {submitting ? "Creating…" : "Create"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
