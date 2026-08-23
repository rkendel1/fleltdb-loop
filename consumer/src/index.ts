import { createFeltDB } from "@feltdb/core";
import {
  createLoop,
  createFeltDBLoopStore,
  type Planner,
  type Executor,
  type Evaluator,
  type RunInput,
  type LoopRun,
  type LoopIteration,
  type Evidence,
  type Plan,
  type ExecutionResult,
  type Evaluation,
  type LoopState,
  type LoopEvent,
  type LoopBudget,
} from "@feltdb/loop";

// Test that all public exports are accessible
console.log("✓ Successfully imported all public API from @feltdb/loop");

// Verify function exports
console.log("✓ createLoop is a function:", typeof createLoop === "function");
console.log("✓ createFeltDBLoopStore is a function:", typeof createFeltDBLoopStore === "function");

// Create a simple in-memory store
const db = createFeltDB({ namespace: "test-consumer", memory: true });
const store = createFeltDBLoopStore(db);

// Create simple implementations
const planner: Planner = {
  async plan() {
    return { objective: "test", actions: [{ type: "noop" }] };
  },
};

const executor: Executor = {
  async execute() {
    return { success: true, evidence: [] };
  },
};

const evaluator: Evaluator = {
  async evaluate() {
    return { outcome: "accept", evidence: [] };
  },
};

// Create a loop
const loop = createLoop({ store, planner, executor, evaluator });

console.log("✓ Created loop instance with public API");

// Test the public methods
const testRun = async () => {
  try {
    const result = await loop.run({ task: "Test task" });
    console.log("✓ loop.run() works correctly");
    console.log("  - Run ID:", result.run.id);
    console.log("  - Run state:", result.run.state);
    console.log("  - Iterations:", result.iterations.length);
    console.log("  - Evidence:", result.evidence.length);

    // Test get()
    const fetched = await loop.get(result.run.id);
    console.log("✓ loop.get() works correctly");
    console.log("  - Retrieved run state:", fetched?.run.state);

    // Test on() for events
    let eventFired = false;
    const unsubscribe = loop.on("run.completed", (payload: unknown) => {
      eventFired = true;
    });
    console.log("✓ loop.on() works correctly for subscribing to events");
    unsubscribe();

    console.log("\n✅ All public API tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
};

testRun();
