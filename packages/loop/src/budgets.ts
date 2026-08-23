import { BUDGET_EXCEEDED, LoopRuntimeError } from "./errors.js";
import type { LoopBudget, LoopIteration, LoopRun } from "./types.js";

export const enforceBudget = (
  budget: LoopBudget | undefined,
  run: LoopRun,
  iterations: LoopIteration[],
): void => {
  if (!budget) {
    return;
  }

  if (
    budget.maxDurationMs !== undefined &&
    Date.now() - run.createdAt > budget.maxDurationMs
  ) {
    throw new LoopRuntimeError(BUDGET_EXCEEDED, "Run budget duration exceeded");
  }

  if (
    budget.maxIterations !== undefined &&
    iterations.length >= budget.maxIterations
  ) {
    throw new LoopRuntimeError(BUDGET_EXCEEDED, "Run iteration budget exceeded");
  }

  if (budget.maxExecutions !== undefined) {
    const executions = iterations.filter((iteration) => iteration.execution).length;
    if (executions >= budget.maxExecutions) {
      throw new LoopRuntimeError(BUDGET_EXCEEDED, "Run execution budget exceeded");
    }
  }
};
