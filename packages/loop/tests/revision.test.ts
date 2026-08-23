import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";

describe("revision", () => {
  it("revises and carries forward evidence", async () => {
    const store = new InMemoryLoopStore();
    let cycle = 0;

    const loop = createLoop({
      store,
      planner: {
        async plan(context) {
          return {
            objective: context.previousIterations.length ? "finalize" : "first-pass",
            actions: [{ type: "execute" }],
          };
        },
      },
      executor: {
        async execute() {
          cycle += 1;
          return {
            success: true,
            evidence: [
              {
                id: `exec-${cycle}`,
                type: "attempt",
                value: cycle,
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
      evaluator: {
        async evaluate(context) {
          if (context.previousIterations.length === 0) {
            return {
              outcome: "revise",
              reasoning: "need one more pass",
              evidence: [
                {
                  id: "revise",
                  type: "needs-work",
                  value: true,
                  timestamp: Date.now(),
                  iterationId: "",
                },
              ],
            };
          }

          return {
            outcome: "accept",
            evidence: [
              {
                id: "accept",
                type: "approved",
                value: true,
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
    });

    const result = await loop.run({ task: "Revise task" });

    expect(result.run.state).toBe("completed");
    expect(result.iterations).toHaveLength(2);
    expect(result.iterations[0].evaluation?.outcome).toBe("revise");
    expect(result.iterations[1].evaluation?.outcome).toBe("accept");
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);
  });
});
