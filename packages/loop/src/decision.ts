import type { Evaluation, LoopState } from "./types";

export const toTerminalState = (evaluation: Evaluation): LoopState | null => {
  if (evaluation.outcome === "accept") {
    return "completed";
  }
  if (evaluation.outcome === "fail") {
    return "failed";
  }
  return null;
};
