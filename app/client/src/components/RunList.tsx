import { useState } from "react";
import type { Run } from "../types/api";
import RunDetailModal from "./RunDetailModal";

const runCost = (run: Run[]) => {
  return run
    .reduce(
      (acc, r) =>
        acc +
        ("modelUsage" in r && r.modelUsage
          ? Object.values(r.modelUsage).reduce(
              (acc: number, m: { costUSD: number }) => acc + m.costUSD,
              0,
            )
          : 0),
      0,
    )
    .toFixed(6);
};

export default function RunsList({
  runs,
}: {
  runs: { name: string; content: Run[] };
}) {
  const [showRunDetail, setShowRunDetail] = useState(false);
  if (!runs || !runs.content || runs.content.length === 0) {
    return (
      <section className="mt-6 shrink-0">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
          Runs
        </h3>
        <p className="m-0 rounded-lg border border-dashed border-white/12 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No runs in this state.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-6 shrink-0">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
        Runs{" "}
        <span className="font-mono text-white/65">
          (total {runCost(runs.content)} USD)
        </span>
      </h3>
      <ul className="m-0 grid list-none gap-3 p-0 [grid-template-rows:repeat(auto-fill,minmax(60px,1fr))] [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]">
        <li key={runs.name} className="relative m-0 h-full">
          <button
            type="button"
            className="block h-full w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[#93c5fd] no-underline transition-colors hover:border-[#646cff]/35 hover:bg-[#646cff]/10"
            onClick={() => setShowRunDetail(true)}
          >
            <span className="block break-all font-mono text-sm text-white/85">
              {runs.name}
            </span>
            <span className="mt-2 block font-mono text-xs text-amber-200/90">
              {runCost(runs.content)} USD
            </span>
          </button>
        </li>
      </ul>
      {showRunDetail && (
        <RunDetailModal
          run={runs.content}
          name={runs.name}
          onClose={() => {
            setShowRunDetail(false);
          }}
        />
      )}
    </section>
  );
}
