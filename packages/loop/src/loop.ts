import { enforceBudget } from "./budgets";
import { toTerminalState } from "./decision";
import { CANCELLED, LoopRuntimeError } from "./errors";
import { normalizeEvidence } from "./evidence";
import { buildContext } from "./iteration";
import { canResume } from "./resume";
import { isTerminal, isTransitionAllowed } from "./state-machine";
import type {
  CreateLoopOptions,
  ExecutionResult,
  LoopEvent,
  LoopHandle,
  LoopIteration,
  LoopResult,
  LoopRun,
  RunInput,
} from "./types";

const asLoopError = (error: unknown): { code: string; message: string; details?: unknown } => {
  if (error instanceof LoopRuntimeError) {
    return error.toLoopError();
  }
  if (error instanceof Error) {
    return { code: "UNHANDLED_ERROR", message: error.message };
  }
  return { code: "UNHANDLED_ERROR", message: "Unknown error", details: error };
};

export const createLoop = (options: CreateLoopOptions): LoopHandle => {
  const listeners = new Map<LoopEvent, Set<(payload: unknown) => void>>();

  const emit = (event: LoopEvent, payload: unknown): void => {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload);
    }
  };

  const transition = async (
    run: LoopRun,
    nextState: LoopRun["state"],
    patch?: Partial<LoopRun>,
  ): Promise<LoopRun> => {
    if (!isTransitionAllowed(run.state, nextState)) {
      throw new LoopRuntimeError(
        "INVALID_STATE_TRANSITION",
        `Illegal transition: ${run.state} -> ${nextState}`,
      );
    }
    return options.store.transition(run.id, nextState, patch);
  };

  const cancel = async (run: LoopRun): Promise<LoopRun> => {
    const cancelled = await transition(run, "cancelled", {
      completedAt: Date.now(),
      failureCode: CANCELLED,
    });
    emit("run.cancelled", { run: cancelled });
    return cancelled;
  };

  const snapshot = async (runId: string): Promise<LoopResult> => {
    const run = await options.store.getRun(runId);
    if (!run) {
      throw new LoopRuntimeError("RUN_NOT_FOUND", `Run not found: ${runId}`);
    }
    const [iterations, evidence] = await Promise.all([
      options.store.listIterations(runId),
      options.store.listEvidence(runId),
    ]);
    return { run, iterations, evidence };
  };

  const runLoop = async (
    run: LoopRun,
    metadata: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LoopResult> => {
    while (!isTerminal(run.state)) {
      if (signal?.aborted) {
        run = await cancel(run);
        break;
      }

      const iterations = await options.store.listIterations(run.id);
      try {
        enforceBudget(options.budget, run, iterations);
      } catch (error) {
        const loopError = asLoopError(error);
        run = await transition(run, "failed", {
          completedAt: Date.now(),
          failureCode: loopError.code,
        });
        emit("run.failed", { run, error: loopError });
        break;
      }

      const iteration = await options.store.createIteration(run.id, iterations.length + 1);
      emit("iteration.started", { run, iteration });

      run = await transition(run, "planning", { iteration: iteration.number });
      const previousIterations = iterations;
      const existingEvidence = await options.store.listEvidence(run.id);
      const context = buildContext(run, iteration, previousIterations, existingEvidence, metadata);

      const plan = await options.planner.plan(context);
      const plannedIteration = await options.store.updateIteration(iteration.id, { plan });
      emit("plan.created", { run, iteration: plannedIteration, plan });

      run = await transition(run, "executing");
      let execution: ExecutionResult;
      try {
        execution = await options.executor.execute(plan, context);
      } catch (error) {
        execution = {
          success: false,
          error: asLoopError(error),
          evidence: [],
        };
      }

      const executionEvidence = normalizeEvidence(execution.evidence, iteration.id);
      if (executionEvidence.length > 0) {
        await options.store.appendEvidence(run.id, executionEvidence);
      }

      const executedIteration = await options.store.updateIteration(iteration.id, {
        execution: {
          ...execution,
          evidence: executionEvidence,
        },
      });
      emit("execution.completed", { run, iteration: executedIteration, execution });

      run = await transition(run, "evaluating");

      let evaluation;
      try {
        const currentEvidence = await options.store.listEvidence(run.id);
        const evaluationContext = buildContext(
          run,
          executedIteration,
          previousIterations,
          currentEvidence,
          metadata,
        );
        evaluation = await options.evaluator.evaluate(evaluationContext, execution);
      } catch (error) {
        evaluation = {
          outcome: "fail" as const,
          reasoning: error instanceof Error ? error.message : "Evaluation failed",
          evidence: [],
        };
      }

      const evaluationEvidence = normalizeEvidence(evaluation.evidence, iteration.id);
      if (evaluationEvidence.length > 0) {
        await options.store.appendEvidence(run.id, evaluationEvidence);
      }

      const completedIteration = await options.store.updateIteration(iteration.id, {
        evaluation: {
          ...evaluation,
          evidence: evaluationEvidence,
        },
        completedAt: Date.now(),
      });
      emit("evaluation.completed", {
        run,
        iteration: completedIteration,
        evaluation,
      });

      const terminalState = toTerminalState(evaluation);
      if (terminalState) {
        const patch = terminalState === "completed" ? { completedAt: Date.now() } : { completedAt: Date.now(), failureCode: "EVALUATION_FAILED" };
        run = await transition(run, terminalState, patch);
        if (terminalState === "completed") {
          emit("run.completed", { run });
        } else {
          emit("run.failed", { run, error: { code: "EVALUATION_FAILED", message: evaluation.reasoning ?? "Evaluation failed" } });
        }
        break;
      }

      run = await transition(run, "revising");
      emit("iteration.revised", { run, iteration: completedIteration, evaluation });
      run = await transition(run, "planning");
    }

    return snapshot(run.id);
  };

  return {
    async run(input: RunInput): Promise<LoopResult> {
      let run = await options.store.createRun({
        task: input.task,
        metadata: input.metadata,
      });
      emit("run.started", { run });
      run = await transition(run, "planning");
      return runLoop(run, input.metadata ?? {}, input.signal);
    },

    async resume(runId: string, signal?: AbortSignal): Promise<LoopResult> {
      const run = await options.store.getRun(runId);
      if (!run) {
        throw new LoopRuntimeError("RUN_NOT_FOUND", `Run not found: ${runId}`);
      }
      if (!canResume(run)) {
        return snapshot(runId);
      }
      return runLoop(run, {}, signal);
    },

    async get(runId: string): Promise<LoopResult | null> {
      const run = await options.store.getRun(runId);
      if (!run) {
        return null;
      }
      return snapshot(runId);
    },

    on(event: LoopEvent, listener: (payload: unknown) => void): () => void {
      const eventListeners = listeners.get(event) ?? new Set<(payload: unknown) => void>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return () => {
        eventListeners.delete(listener);
      };
    },
  };
};
