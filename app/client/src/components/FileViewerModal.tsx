import React, { useCallback, useState } from "react";
import { useEffect } from "react";
import { modalWideDialogClass } from "../lib/uiClasses";

export default function FileViewerModal({
  path,
  onClose,
}: React.PropsWithChildren<{
  path: string;
  onClose: () => void;
}>) {
  const [contents, setContents] = useState("");

  const close = useCallback(() => {
    setContents("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  useEffect(() => {
    const fetchContents = async () => {
      if (!path.trim()) return;
      const res = await fetch("/api/open-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        contents?: string;
      };
      if (!res.ok || !data.contents) {
        console.error(
          "Failed to open file",
          data.error ?? `HTTP ${res.status}`,
        );
        setContents(`Error opening file: ${data.error} Status: ${res.status} `);
        return;
      }
      setContents(data.contents);
    };
    fetchContents();
  }, [path]);

  return (
    <dialog className={modalWideDialogClass} open={!!path} onClose={close}>
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
        <h3 className="m-0 max-w-[min(100%,70vw)] truncate text-left text-sm font-medium text-white/90 font-mono">
          {path}
        </h3>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] p-2 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          onClick={close}
          aria-label="Close"
        >
          ×
        </button>
      </header>
      <pre className="m-0 min-h-0 flex-1 overflow-auto border-t border-white/10 bg-[#141414] p-4 text-sm text-white/80 whitespace-pre-wrap break-words sm:p-5">
        {contents}
      </pre>
    </dialog>
  );
}
