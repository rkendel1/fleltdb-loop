import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";

describe("budgets", () => {
  it("fails on budget exhaustion", async () => {
    const store = new InMemoryLoopStore();
    const loop = createLoop({
      store,
      budget: {
        maxIterations: 1,
      },
      planner: {
        async plan() {
          return { objective: "attempt", actions: [{ type: "noop" }] };
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

    const result = await loop.run({ task: "bounded task" });
    expect(result.run.state).toBe("failed");
    expect(result.run.failureCode).toBe("BUDGET_EXCEEDED");
  });
});
