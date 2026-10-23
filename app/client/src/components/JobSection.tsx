import type { JobState } from "../types/api";
import { ADW_STEPS, ADW_STEPS_DESCRIPTIONS } from "../utils/agents";
import StepFiles from "./JobStepFiles";

export default function StepDetailSection({
  step,
  state,
  handleOpenFile,
}: {
  step: string;
  state: JobState;
  handleOpenFile: (path: string) => void;
}) {
  const currentStepIndex = ADW_STEPS.indexOf(step ?? "") - 1;
  const disabled = currentStepIndex < currentStepIndex;
  return (
    <section
      className={`shrink-0 ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
        <span className="mr-2 text-white/35" aria-hidden>
          {!disabled ? "✓" : "…"}
        </span>
        {currentStepIndex +
          " - " +
          ADW_STEPS_DESCRIPTIONS[step as keyof typeof ADW_STEPS_DESCRIPTIONS]}
      </h3>
      {step === "await_plan" && currentStepIndex >= currentStepIndex ? (
        <div className="text-sm text-white/75">
          Issue type: {state.issueClass}
        </div>
      ) : null}
      {step === "await_test" && currentStepIndex >= currentStepIndex ? (
        <div className="text-sm text-white/75">
          Test retries: {state.testRetries}
        </div>
      ) : null}
      {step === "await_pr" && currentStepIndex >= currentStepIndex ? (
        <div>
          Pull request:{" "}
          <a
            className="float-left mx-1 my-2 block h-20 w-[70px] text-center text-[#93c5fd] no-underline after:content-['_↗'] after:text-[0.75em] after:opacity-80 hover:text-[#bfdbfe]"
            href={state.prUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {state.prUrl}
          </a>
        </div>
      ) : null}
      {step === "await_review" && currentStepIndex >= currentStepIndex ? (
        <div className="text-sm text-white/75">
          Review retries: {state.reviewRetries}
        </div>
      ) : null}
      {currentStepIndex >= currentStepIndex && (
        <StepFiles
          step={step ?? ""}
          state={state}
          handleOpenFile={(path) => handleOpenFile(path)}
        />
      )}
    </section>
  );
}
