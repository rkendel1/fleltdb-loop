import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";
import type { LoopRun } from "../src";

class CrashAfterExecutingTransitionStore extends InMemoryLoopStore {
  private crashed = false;
  public runId?: string;

  override async createRun(input: { task: string; metadata?: Record<string, unknown> }) {
    const run = await super.createRun(input);
    this.runId = run.id;
    return run;
  }

  override async transition(runId: string, state: LoopRun["state"], patch?: Partial<LoopRun>) {
    const run = await super.transition(runId, state, patch);
    if (!this.crashed && state === "executing") {
      this.crashed = true;
      throw new Error("simulated process crash");
    }
    return run;
  }
}

describe("resume", () => {
  it("does not restart completed runs", async () => {
    const store = new InMemoryLoopStore();

    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "one", actions: [{ type: "noop" }] };
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

    const initial = await loop.run({ task: "single pass" });
    const resumed = await loop.resume(initial.run.id);

    expect(initial.iterations).toHaveLength(1);
    expect(resumed.iterations).toHaveLength(1);
    expect(resumed.run.state).toBe("completed");
  });

  it("recovers in-progress iteration without duplicating it", async () => {
    const store = new CrashAfterExecutingTransitionStore();
    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "recover", actions: [{ type: "work" }] };
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

    await expect(loop.run({ task: "crash me" })).rejects.toThrow("simulated process crash");
    expect(store.runId).toBeTruthy();

    const resumed = await loop.resume(store.runId!);

    expect(resumed.run.state).toBe("completed");
    expect(resumed.iterations).toHaveLength(1);
    expect(resumed.iterations[0].plan?.objective).toBe("recover");
    expect(resumed.iterations[0].execution?.success).toBe(true);
  });
});
