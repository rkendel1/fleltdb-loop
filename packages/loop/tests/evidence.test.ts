import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";
import type { LoopContext } from "../src";

describe("evidence", () => {
  it("supports domain-neutral evidence evaluation", async () => {
    const store = new InMemoryLoopStore();

    const loop = createLoop({
      store,
      planner: {
        async plan() {
          return { objective: "check endpoint", actions: [{ type: "http.get" }] };
        },
      },
      executor: {
        async execute() {
          return {
            success: true,
            evidence: [
              {
                id: "health-1",
                type: "http.status",
                source: "health-api",
                value: 200,
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
      evaluator: {
        async evaluate(context: LoopContext) {
          const healthy = context.evidence.some(
            (item) => item.type === "http.status" && item.value === 200,
          );
          return {
            outcome: healthy ? "accept" : "revise",
            evidence: [
              {
                id: "health-eval",
                type: "health.decision",
                value: healthy,
                timestamp: Date.now(),
                iterationId: "",
              },
            ],
          };
        },
      },
    });

    const result = await loop.run({ task: "Determine endpoint health" });
    expect(result.run.state).toBe("completed");
  });
});
