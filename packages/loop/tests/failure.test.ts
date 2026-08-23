import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";

describe("failure", () => {
  it("persists executor and evaluator failures and cancellation", async () => {
    const store = new InMemoryLoopStore();

    const failedLoop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "fail", actions: [{ type: "explode" }] };
        },
      },
      executor: {
        async execute() {
          throw new Error("executor boom");
        },
      },
      evaluator: {
        async evaluate() {
          return { outcome: "fail", evidence: [] };
        },
      },
    });

    const failed = await failedLoop.run({ task: "fail path" });
    expect(failed.run.state).toBe("failed");
    expect(failed.iterations[0].execution?.success).toBe(false);

    const cancelStore = new InMemoryLoopStore();
    const cancelledLoop = createLoop({
      store: cancelStore,
      planner: {
        async plan() {
          return { objective: "cancel", actions: [{ type: "wait" }] };
        },
      },
      executor: {
        async execute() {
          return { success: true, evidence: [] };
        },
      },
      evaluator: {
        async evaluate() {
          return { outcome: "revise", evidence: [] };
        },
      },
    });

    const controller = new AbortController();
    controller.abort();
    const cancelled = await cancelledLoop.run({ task: "cancel path", signal: controller.signal });
    expect(cancelled.run.state).toBe("cancelled");
    expect(cancelled.run.failureCode).toBe("CANCELLED");
  });
});
