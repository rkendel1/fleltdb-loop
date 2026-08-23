import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";
import type { LoopRun } from "../src";

// Store that crashes after a certain number of transitions
class CrashOnTransitionStore extends InMemoryLoopStore {
  private transitionCount = 0;
  private crashAfterTransitions: number;
  public crashedRunId?: string;

  constructor(crashAfterTransitions: number = 4) {
    super();
    this.crashAfterTransitions = crashAfterTransitions;
  }

  override async transition(runId: string, state: LoopRun["state"], patch?: Partial<LoopRun>) {
    this.transitionCount++;
    if (this.transitionCount === this.crashAfterTransitions) {
      this.crashedRunId = runId;
      throw new Error("simulated process crash");
    }
    return super.transition(runId, state, patch);
  }
}

describe("durability", () => {
  it("survives process death and resumes without duplication", async () => {
    const store = new CrashOnTransitionStore(6); // Crash during execution state of iteration 2

    let executionCount = 0;
    let iterationCount = 0;

    const loop = createLoop({
      store,
      planner: {
        async plan(context) {
          return {
            objective: `iteration-${context.iteration.number}`,
            actions: [{ type: "work" }],
          };
        },
      },
      executor: {
        async execute() {
          executionCount++;
          return { success: true, evidence: [] };
        },
      },
      evaluator: {
        async evaluate(context) {
          iterationCount++;
          // Succeed on iteration 3 or later, revise on iteration 1-2
          if (context.iteration.number >= 3) {
            return { outcome: "accept", evidence: [] };
          }
          return {
            outcome: "revise",
            reasoning: "Continue iterating",
            evidence: [],
          };
        },
      },
    });

    // Run initial iterations - should crash
    let crashed = false;
    try {
      await loop.run({ task: "durable task" });
    } catch (error) {
      crashed = true;
      expect((error as Error).message).toContain("simulated process crash");
    }
    expect(crashed).toBe(true);

    const runId = store.crashedRunId!;

    // Get state before resume
    const beforeResume = await loop.get(runId);
    expect(beforeResume).toBeDefined();
    expect(beforeResume?.iterations.length).toBeGreaterThan(0);

    // Simulate process restart - resume from the saved state
    const result = await loop.resume(runId);

    // After resume, we should have completed all iterations without duplication
    expect(result.run.state).toBe("completed");
    // Should have 3 total iterations (1 + 2 from revisions)
    expect(result.iterations).toHaveLength(3);
    expect(executionCount).toBe(3);
    expect(iterationCount).toBe(3);
  });

  it("preserves evidence across resume", async () => {
    const store = new CrashOnTransitionStore(4); // Crash after first iteration completes

    const evidenceIds = new Set<string>();

    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "task", actions: [{ type: "work" }] };
        },
      },
      executor: {
        async execute(plan, context) {
          const id = `exec-${context.iteration.number}`;
          evidenceIds.add(id);
          return {
            success: true,
            evidence: [
              {
                id,
                type: "execution-result",
                value: "output data",
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
      evaluator: {
        async evaluate(context) {
          const id = `eval-${context.iteration.number}`;
          evidenceIds.add(id);
          // Keep revising to trigger more iterations on resume
          return {
            outcome: "revise",
            evidence: [
              {
                id,
                type: "evaluation-data",
                value: "evaluation result",
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
      budget: { maxIterations: 5 },
    });

    // First run - should crash
    let crashed = false;
    let beforeResumeEvidence: typeof evidenceIds | undefined;
    try {
      await loop.run({ task: "evidence test" });
    } catch (error) {
      crashed = true;
      beforeResumeEvidence = new Set(evidenceIds);
    }
    expect(crashed).toBe(true);

    // Resume
    const secondResult = await loop.resume(store.crashedRunId!);

    // Evidence from all iterations should be present
    expect(secondResult.evidence.length).toBeGreaterThan(0);
    // All evidence IDs from before crash should still be there
    for (const evidence of secondResult.evidence) {
      if (evidence.id.includes("exec-") || evidence.id.includes("eval-")) {
        expect(beforeResumeEvidence).toContain(evidence.id);
      }
    }
  });

  it("cannot resume completed runs", async () => {
    const store = new InMemoryLoopStore();

    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "complete", actions: [{ type: "work" }] };
        },
      },
      executor: {
        async execute() {
          return { success: true, evidence: [] };
        },
      },
      evaluator: {
        async evaluate() {
          return { outcome: "accept", evidence: [] };
        },
      },
    });

    const result = await loop.run({ task: "one-shot task" });
    expect(result.run.state).toBe("completed");

    // Resume should return the same completed state without re-running
    const resumed = await loop.resume(result.run.id);
    expect(resumed.run.state).toBe("completed");
    expect(resumed.iterations).toHaveLength(1); // No new iteration
  });

  it("cannot resume cancelled runs", async () => {
    const store = new InMemoryLoopStore();

    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "cancel", actions: [{ type: "work" }] };
        },
      },
      executor: {
        async execute() {
          return { success: true, evidence: [] };
        },
      },
      evaluator: {
        async evaluate() {
          return { outcome: "accept", evidence: [] };
        },
      },
    });

    const controller = new AbortController();

    // Start run and immediately abort
    const runPromise = loop.run({ task: "cancel task", signal: controller.signal });
    controller.abort();

    const result = await runPromise;
    expect(result.run.state).toBe("cancelled");

    // Resume should return the same cancelled state without re-running
    const resumed = await loop.resume(result.run.id);
    expect(resumed.run.state).toBe("cancelled");
  });

  it("preserves terminal state across resume", async () => {
    const store = new InMemoryLoopStore();

    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "test", actions: [{ type: "work" }] };
        },
      },
      executor: {
        async execute() {
          return { success: true, evidence: [] };
        },
      },
      evaluator: {
        async evaluate() {
          return { outcome: "accept", evidence: [] };
        },
      },
    });

    const result = await loop.run({ task: "terminal state test" });
    const completedAt = result.run.completedAt;

    // Resume multiple times
    const resumed1 = await loop.resume(result.run.id);
    const resumed2 = await loop.resume(result.run.id);

    // State should remain exactly the same
    expect(resumed1.run.state).toBe("completed");
    expect(resumed2.run.state).toBe("completed");
    expect(resumed1.run.completedAt).toBe(completedAt);
    expect(resumed2.run.completedAt).toBe(completedAt);
    expect(resumed1.iterations).toHaveLength(1);
    expect(resumed2.iterations).toHaveLength(1);
  });

  it("prevents duplicate active iterations after crash", async () => {
    const store = new CrashOnTransitionStore(6); // Crash during second iteration

    let activeIterationCount = 0;

    const loop = createLoop({
      store,
      planner: {
        async plan(context) {
          return {
            objective: `iteration-${context.iteration.number}`,
            actions: [{ type: "work" }],
          };
        },
      },
      executor: {
        async execute() {
          return { success: true, evidence: [] };
        },
      },
      evaluator: {
        async evaluate(context) {
          if (context.iteration.number >= 2) {
            return { outcome: "accept", evidence: [] };
          }
          return { outcome: "revise", evidence: [] };
        },
      },
    });

    // First run - should crash
    let crashed = false;
    try {
      await loop.run({ task: "no-duplicate-iterations test" });
    } catch (error) {
      crashed = true;
    }
    expect(crashed).toBe(true);

    // Check state before resume
    const beforeResume = await loop.get(store.crashedRunId!);
    const activeBeforeResume = beforeResume?.iterations.filter((it) => !it.completedAt);
    expect(activeBeforeResume?.length).toBeLessThanOrEqual(1);

    // Resume
    const result = await loop.resume(store.crashedRunId!);

    // Verify only one active iteration existed at any time
    const activeIterations = result.iterations.filter((it) => !it.completedAt);
    expect(activeIterations.length).toBeLessThanOrEqual(1);
    expect(result.run.state).toBe("completed");
  });
});

