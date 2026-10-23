import { useState, useEffect } from "react";
import Project from "./pages/Project";
import Issue from "./pages/Issue";
import Projects from "./pages/Projects";
import Chat from "./pages/Chat";

function IconFolder() {
  return (
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
      aria-hidden
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.9-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function IconMessage() {
  return (
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
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function App() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || "/");

  useEffect(() => {
    const onHashChange = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const projectIssueMatch =
    path.match(/^\/projects\/([^/]+)\/issues\/([^/]+)$/) ?? undefined;
  const projectOnlyId = path.startsWith("/projects/")
    ? path.slice("/projects/".length)
    : "";

  const navLinkClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium no-underline transition-colors ${
      active
        ? "border-[#646cff]/40 bg-[#646cff]/15 text-white"
        : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
    }`;

  const projectsActive =
    path === "/" ||
    path === "/projects" ||
    path.startsWith("/projects/");
  const chatActive = path === "/chat" || path.startsWith("/chat/");

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-[10000] border-b border-white/10 bg-[#1a1a1a]/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2">
          <span className="mr-2 hidden text-xs font-medium uppercase tracking-wider text-white/35 sm:inline">
            Node agent
          </span>
          <a href="#/projects" className={navLinkClass(projectsActive)}>
            <IconFolder />
            Projects
          </a>
          <a href="#/chat" className={navLinkClass(chatActive)}>
            <IconMessage />
            Chat
          </a>
        </div>
      </nav>
      {projectIssueMatch ? (
        <Issue projectId={projectIssueMatch[1]} issueId={projectIssueMatch[2]} />
      ) : path.startsWith("/projects/") ? (
        <Project projectId={projectOnlyId} />
      ) : path === "/chat" || path.startsWith("/chat/") ? (
        <Chat
          initialSessionId={
            path.startsWith("/chat/") ? path.slice("/chat/".length) : undefined
          }
        />
      ) : (
        <Projects />
      )}
    </>
  );
}

export default App;
