import { describe, expect, it } from "vitest";
import { createLoop } from "../src";
import { InMemoryLoopStore } from "./support/in-memory-store";

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
});
