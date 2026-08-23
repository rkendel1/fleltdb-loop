import { enforceBudget } from "./budgets.js";
import { toTerminalState } from "./decision.js";
import { CANCELLED, LoopRuntimeError } from "./errors.js";
import { normalizeEvidence } from "./evidence.js";
import { buildContext } from "./iteration.js";
import { canResume } from "./resume.js";
import { isTerminal, isTransitionAllowed } from "./state-machine.js";
import type {
  CreateLoopOptions,
  Evaluation,
  ExecutionResult,
  LoopEvent,
  LoopHandle,
  LoopIteration,
  LoopResult,
  LoopRun,
  RunInput,
} from "./types.js";

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

  const failRun = async (
    run: LoopRun,
    code: string,
    message: string,
  ): Promise<LoopRun> => {
    const failed = await transition(run, "failed", {
      completedAt: Date.now(),
      failureCode: code,
    });
    emit("run.failed", { run: failed, error: { code, message } });
    return failed;
  };

  const cancelRun = async (run: LoopRun): Promise<LoopRun> => {
    const cancelled = await transition(run, "cancelled", {
      completedAt: Date.now(),
      failureCode: CANCELLED,
    });
    emit("run.cancelled", { run: cancelled });
    return cancelled;
  };

  const resolveIteration = async (
    run: LoopRun,
    iterations: LoopIteration[],
  ): Promise<{ current: LoopIteration; previous: LoopIteration[] }> => {
    const active = [...iterations].sort((a, b) => a.number - b.number).find((item) => !item.completedAt);
    if (active) {
      return {
        current: active,
        previous: iterations.filter((item) => item.id !== active.id),
      };
    }

    const created = await options.store.createIteration(run.id, iterations.length + 1);
    emit("iteration.started", { run, iteration: created });
    return { current: created, previous: iterations };
  };

  const finalizeEvaluation = async (
    run: LoopRun,
    iteration: LoopIteration,
    evaluation: Evaluation,
  ): Promise<LoopRun> => {
    const terminalState = toTerminalState(evaluation);
    if (terminalState === "completed") {
      const completed = await transition(run, "completed", { completedAt: Date.now() });
      emit("run.completed", { run: completed });
      return completed;
    }

    if (terminalState === "failed") {
      return failRun(run, "EVALUATION_FAILED", evaluation.reasoning ?? "Evaluation failed");
    }

    const revising = await transition(run, "revising");
    emit("iteration.revised", { run: revising, iteration, evaluation });
    return revising;
  };

  const runLoop = async (
    initialRun: LoopRun,
    fallbackMetadata: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LoopResult> => {
    let run = initialRun;

    while (!isTerminal(run.state)) {
      if (signal?.aborted) {
        run = await cancelRun(run);
        break;
      }

      const iterations = await options.store.listIterations(run.id);
      try {
        enforceBudget(options.budget, run, iterations);
      } catch (error) {
        const loopError = asLoopError(error);
        run = await failRun(run, loopError.code, loopError.message);
        break;
      }

      const { current: iteration, previous } = await resolveIteration(run, iterations);
      const metadata = run.metadata ?? fallbackMetadata;

      if (run.state === "pending" || run.state === "revising") {
        run = await transition(run, "planning", { iteration: iteration.number });
      }

      if (run.state === "planning") {
        if (!iteration.plan) {
          const evidence = await options.store.listEvidence(run.id);
          const context = buildContext(run, iteration, previous, evidence, metadata);
          const plan = await options.planner.plan(context);
          await options.store.updateIteration(iteration.id, { plan });
          emit("plan.created", { run, iteration: { ...iteration, plan }, plan });
        }
        run = await transition(run, "executing", { iteration: iteration.number });
      }

      const refreshedIterations = await options.store.listIterations(run.id);
      const refreshedIteration = refreshedIterations.find((item) => item.id === iteration.id) ?? iteration;

      if (run.state === "executing") {
        if (!refreshedIteration.plan) {
          run = await failRun(run, "MISSING_PLAN", "Iteration missing plan in executing state");
          break;
        }

        if (!refreshedIteration.execution) {
          const evidence = await options.store.listEvidence(run.id);
          const context = buildContext(run, refreshedIteration, previous, evidence, metadata);
          let execution: ExecutionResult;
          try {
            execution = await options.executor.execute(refreshedIteration.plan, context);
          } catch (error) {
            execution = {
              success: false,
              error: asLoopError(error),
              evidence: [],
            };
          }

          const executionEvidence = normalizeEvidence(execution.evidence, refreshedIteration.id);
          if (executionEvidence.length > 0) {
            await options.store.appendEvidence(run.id, executionEvidence);
          }
          await options.store.updateIteration(refreshedIteration.id, {
            execution: {
              ...execution,
              evidence: executionEvidence,
            },
          });
          emit("execution.completed", {
            run,
            iteration: refreshedIteration,
            execution: { ...execution, evidence: executionEvidence },
          });
        }

        run = await transition(run, "evaluating", { iteration: refreshedIteration.number });
      }

      const evaluationIterations = await options.store.listIterations(run.id);
      const evaluationIteration =
        evaluationIterations.find((item) => item.id === iteration.id) ?? refreshedIteration;

      if (run.state === "evaluating") {
        if (!evaluationIteration.execution) {
          run = await failRun(run, "MISSING_EXECUTION", "Iteration missing execution in evaluating state");
          break;
        }

        if (!evaluationIteration.evaluation) {
          const evidence = await options.store.listEvidence(run.id);
          const context = buildContext(run, evaluationIteration, previous, evidence, metadata);

          let evaluation: Evaluation;
          try {
            evaluation = await options.evaluator.evaluate(context, evaluationIteration.execution);
          } catch (error) {
            evaluation = {
              outcome: "fail",
              reasoning: error instanceof Error ? error.message : "Evaluator failed",
              evidence: [],
            };
          }

          const evaluationEvidence = normalizeEvidence(evaluation.evidence, evaluationIteration.id);
          if (evaluationEvidence.length > 0) {
            await options.store.appendEvidence(run.id, evaluationEvidence);
          }

          await options.store.updateIteration(evaluationIteration.id, {
            evaluation: {
              ...evaluation,
              evidence: evaluationEvidence,
            },
            completedAt: Date.now(),
          });

          emit("evaluation.completed", {
            run,
            iteration: evaluationIteration,
            evaluation: {
              ...evaluation,
              evidence: evaluationEvidence,
            },
          });
        }

        const postEval = (await options.store.listIterations(run.id)).find(
          (item) => item.id === evaluationIteration.id,
        );

        if (!postEval?.evaluation) {
          run = await failRun(run, "MISSING_EVALUATION", "Iteration missing evaluation after evaluation state");
          break;
        }

        run = await finalizeEvaluation(run, postEval, postEval.evaluation);
      }
    }

    return snapshot(run.id);
  };

  return {
    async run(input: RunInput): Promise<LoopResult> {
      const run = await options.store.createRun({
        task: input.task,
        metadata: input.metadata,
      });
      emit("run.started", { run });
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
      return runLoop(run, run.metadata ?? {}, signal);
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
