import type { Evidence, LoopContext, LoopIteration, LoopRun } from "./types.js";

export const buildContext = (
  run: LoopRun,
  iteration: LoopIteration,
  previousIterations: LoopIteration[],
  evidence: Evidence[],
  metadata: Record<string, unknown>,
): LoopContext => ({
  run,
  iteration,
  task: run.task,
  previousIterations,
  evidence,
  metadata,
});
