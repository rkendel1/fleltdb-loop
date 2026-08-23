/**
 * Minimal @feltdb/loop example.
 * 
 * This demonstrates the simplest possible usage of @feltdb/loop
 * with stub implementations of planner, executor, and evaluator.
 */

import { createLoop, createFeltDBLoopStore } from "../../packages/loop/src/index";
import { createFeltDB } from "@feltdb/core";

async function main(): Promise<void> {
  console.log("Basic @feltdb/loop example\n");

  // Initialize the database for storing loop state
  const db = createFeltDB({ namespace: "basic-example", memory: true });
  const store = createFeltDBLoopStore(db);

  // Create a minimal loop with stub implementations
  const loop = createLoop({
    store,
    planner: {
      async plan() {
        return {
          objective: "Do some work",
          actions: [{ type: "work" }],
        };
      },
    },
    executor: {
      async execute() {
        return {
          success: true,
          output: "Work completed",
          evidence: [
            {
              id: "work-1",
              type: "work.completed",
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
          reasoning: "Work was successful",
          evidence: [
            {
              id: "eval-1",
              type: "evaluation.approved",
              value: true,
              timestamp: Date.now(),
              iterationId: "",
            },
          ],
        };
      },
    },
  });

  // Subscribe to events
  loop.on("run.started", () => console.log("→ Run started"));
  loop.on("iteration.started", () => console.log("→ Iteration started"));
  loop.on("plan.created", (payload: any) => console.log(`→ Plan: ${payload.plan.objective}`));
  loop.on("execution.completed", () => console.log("→ Execution completed"));
  loop.on("evaluation.completed", (payload: any) => console.log(`→ Evaluation: ${payload.evaluation.outcome}`));
  loop.on("run.completed", () => console.log("→ Run completed"));

  // Run the loop
  const result = await loop.run({ task: "Simple task" });

  // Print results
  console.log("\n" + "=".repeat(50));
  console.log(`Final state: ${result.run.state}`);
  console.log(`Iterations: ${result.iterations.length}`);
  console.log(`Evidence items: ${result.evidence.length}`);
  console.log("=".repeat(50) + "\n");
}

main();
