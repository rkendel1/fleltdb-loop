/**
 * Real-world coding example using @feltdb/loop.
 * 
 * This example demonstrates how an autonomous coding system (like easy-llm-code)
 * can use @feltdb/loop as its core iterative runtime, proving that @feltdb/loop
 * is a useful primitive for real-world applications.
 * 
 * Workflow:
 * Task → Planner → Sandbox Executor → Evidence → Evaluator → Revise (loop) → Complete
 * 
 * Key features demonstrated:
 * - Autonomous task planning
 * - Safe sandbox execution
 * - Evidence collection (test results, file changes, etc.)
 * - Outcome-aware evaluation and revision
 * - Durable state (via @feltdb/core)
 */

import { createLoop, createFeltDBLoopStore } from "../../packages/loop/src/index";
import { createFeltDB } from "@feltdb/core";
import {
  CodeSandbox,
  createCodingPlanner,
  createCodingExecutor,
  createCodingEvaluator,
} from "./helpers";

/**
 * Run a coding task using @feltdb/loop.
 */
async function runCodingTask(task: string): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`Starting Autonomous Coding Task: ${task}`);
  console.log("=".repeat(80) + "\n");

  // Initialize storage
  const db = createFeltDB({ namespace: "coding-example", memory: true });
  const store = createFeltDBLoopStore(db);

  // Initialize the sandbox
  const sandbox = new CodeSandbox();

  // Create the loop with coding-specific planner, executor, and evaluator
  const loop = createLoop({
    store,
    planner: createCodingPlanner(sandbox),
    executor: createCodingExecutor(sandbox),
    evaluator: createCodingEvaluator(sandbox),
    budget: {
      maxIterations: 3,
      maxDurationMs: 60000,
    },
  });

  // Subscribe to loop events for observability
  let iterationCount = 0;

  loop.on("run.started", (payload: any) => {
    console.log(`[LOOP] Run started: ${payload.run.id}`);
  });

  loop.on("iteration.started", (payload: any) => {
    iterationCount = payload.iteration.number;
    console.log(`\n[ITERATION ${iterationCount}] Starting iteration`);
  });

  loop.on("plan.created", (payload: any) => {
    console.log(
      `[ITERATION ${iterationCount}] Plan created: ${payload.plan.objective}`
    );
    console.log(`  Actions: ${payload.plan.actions.length}`);
  });

  loop.on("execution.completed", (payload: any) => {
    const { execution } = payload;
    console.log(`[ITERATION ${iterationCount}] Execution completed`);
    console.log(`  Success: ${execution.success}`);
    console.log(`  Evidence items: ${execution.evidence?.length ?? 0}`);
    if (execution.output) {
      console.log(`  Output:`, JSON.stringify(execution.output, null, 2));
    }
  });

  loop.on("evaluation.completed", (payload: any) => {
    const { evaluation } = payload;
    console.log(`[ITERATION ${iterationCount}] Evaluation completed`);
    console.log(`  Outcome: ${evaluation.outcome}`);
    console.log(`  Reasoning: ${evaluation.reasoning}`);
  });

  loop.on("iteration.revised", (payload: any) => {
    console.log(`[ITERATION ${iterationCount}] Iteration revised - looping back to planning`);
  });

  loop.on("run.completed", (payload: any) => {
    console.log(`\n[LOOP] Run completed successfully!`);
    console.log(`  Total iterations: ${payload.run.iteration}`);
  });

  loop.on("run.failed", (payload: any) => {
    console.log(`\n[LOOP] Run failed: ${payload.error.code}`);
    console.log(`  Message: ${payload.error.message}`);
  });

  // Run the loop
  try {
    const result = await loop.run({ task });

    // Print final results
    console.log("\n" + "=".repeat(80));
    console.log("FINAL RESULTS");
    console.log("=".repeat(80) + "\n");

    console.log(`Run ID: ${result.run.id}`);
    console.log(`State: ${result.run.state}`);
    console.log(`Iterations: ${result.iterations.length}`);
    console.log(`Total Evidence Items: ${result.evidence.length}`);

    // Print iteration details
    console.log("\nIteration Details:");
    for (const iteration of result.iterations) {
      console.log(`\n  Iteration #${iteration.number}:`);
      if (iteration.plan) {
        console.log(`    Plan: ${iteration.plan.objective}`);
      }
      if (iteration.execution) {
        console.log(`    Execution: ${iteration.execution.success ? "Success" : "Failed"}`);
      }
      if (iteration.evaluation) {
        console.log(`    Evaluation: ${iteration.evaluation.outcome}`);
      }
    }

    // Print evidence summary
    console.log("\nEvidence Summary:");
    const evidenceByType = result.evidence.reduce(
      (acc: Record<string, number>, ev: any) => {
        acc[ev.type] = (acc[ev.type] ?? 0) + 1;
        return acc;
      },
      {}
    );
    for (const [type, count] of Object.entries(evidenceByType)) {
      console.log(`  ${type}: ${count}`);
    }

    // Print sandbox state
    console.log("\nSandbox State:");
    const sandboxState = sandbox.getState();
    console.log(`  Files created/modified: ${sandboxState.files ? Object.keys(sandboxState.files).length : 0}`);
    for (const [path, content] of Object.entries(sandboxState.files || {})) {
      console.log(`    - ${path} (${String(content).length} bytes)`);
    }

    console.log("\n" + "=".repeat(80));
    console.log(`Task completed with state: ${result.run.state}`);
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("Error running loop:", error);
  }
}

/**
 * Example of resuming a previously started task.
 */
async function resumeExample(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("Resume Example");
  console.log("=".repeat(80) + "\n");

  // Initialize storage
  const db = createFeltDB({ namespace: "coding-example-resume", memory: true });
  const store = createFeltDBLoopStore(db);

  // Initialize the sandbox
  const sandbox = new CodeSandbox();

  // Create the loop
  const loop = createLoop({
    store,
    planner: createCodingPlanner(sandbox),
    executor: createCodingExecutor(sandbox),
    evaluator: createCodingEvaluator(sandbox),
  });

  // Start a task
  console.log("Starting task...");
  const result = await loop.run({ task: "Fix the implementation" });
  const runId = result.run.id;

  console.log(`Task started with run ID: ${runId}`);
  console.log(`Current state: ${result.run.state}`);

  // In a real application, this would be called later after inspection or resumption
  // Simulate resuming the task
  if (result.run.state !== "completed" && result.run.state !== "failed") {
    console.log("\nResuming task...");
    const resumedResult = await loop.resume(runId);
    console.log(`Resumed state: ${resumedResult.run.state}`);
  }

  // Get the final result
  const finalResult = await loop.get(runId);
  if (finalResult) {
    console.log(`Final state: ${finalResult.run.state}`);
    console.log(`Total iterations: ${finalResult.iterations.length}`);
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  try {
    // Run the main coding task example
    await runCodingTask("Implement a fibonacci function");

    // Run the resume example
    await resumeExample();

    console.log("\nAll examples completed successfully!");
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
}

main();
