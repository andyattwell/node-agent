import type { JobState } from "../types/api";
import { ADW_STEPS_Files } from "../utils/agents";
import FileLink from "./FileLink";

export default function StepFiles({
  step,
  state,
  handleOpenFile,
}: {
  step: string;
  state: JobState;
  handleOpenFile: (path: string) => void;
}) {
  const files = ADW_STEPS_Files[step as keyof typeof ADW_STEPS_Files];

  return (
    <div className="shrink-0">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
        Files
      </h4>
      <div className="flex flex-wrap items-start">
        {files.map((file) => {
          let f = file;
          if (step === "await_plan" && file === "plan.md") {
            f = state.planPath;
          }
          return (
            <FileLink
              key={f}
              path={state.adwId + "/" + step.replace("await_", "") + "/" + f}
              handleOpenFile={handleOpenFile}
            />
          );
        })}
      </div>
    </div>
  );
}
