import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";

describe("lifecycle", () => {
  it("persists plan, execution, evaluation and completion", async () => {
    const store = new InMemoryLoopStore();
    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "do work", actions: [{ type: "noop" }] };
        },
      },
      executor: {
        async execute() {
          return {
            success: true,
            output: { ok: true },
            evidence: [
              {
                id: "exec",
                type: "test.passed",
                value: true,
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
      evaluator: {
        async evaluate() {
          return {
            outcome: "accept",
            evidence: [
              {
                id: "eval",
                type: "approval",
                value: true,
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
    });

    const result = await loop.run({ task: "Build feature" });

    expect(result.run.state).toBe("completed");
    expect(result.iterations).toHaveLength(1);
    expect(result.iterations[0].plan?.objective).toBe("do work");
    expect(result.iterations[0].execution?.success).toBe(true);
    expect(result.iterations[0].evaluation?.outcome).toBe("accept");
    expect(result.evidence).toHaveLength(2);
  });
});
