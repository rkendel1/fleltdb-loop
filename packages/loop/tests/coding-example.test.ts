import { describe, it, expect } from "vitest";
import { createLoop, createFeltDBLoopStore } from "../src/index";
import { createFeltDB } from "@feltdb/core";
import {
  CodeSandbox,
  createCodingPlanner,
  createCodingExecutor,
  createCodingEvaluator,
} from "../../../examples/coding/helpers";

describe("coding domain example", () => {
  it("successfully completes a coding task with planning, execution, and evaluation", async () => {
    const db = createFeltDB({ namespace: "test-coding", memory: true });
    const store = createFeltDBLoopStore(db);
    const sandbox = new CodeSandbox();

    const loop = createLoop({
      store,
      planner: createCodingPlanner(sandbox),
      executor: createCodingExecutor(sandbox),
      evaluator: createCodingEvaluator(sandbox),
      budget: { maxIterations: 3 },
    });

    const result = await loop.run({ task: "Implement a solution" });

    // Verify the loop completed
    expect(result.run.state).toBe("completed");
    expect(result.iterations.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);

    // Verify each iteration has the expected structure
    for (const iteration of result.iterations) {
      expect(iteration.plan).toBeDefined();
      expect(iteration.execution).toBeDefined();
      expect(iteration.evaluation).toBeDefined();
      expect(iteration.plan?.objective).toBeDefined();
      expect(iteration.execution?.success).toBeDefined();
      expect(iteration.evaluation?.outcome).toBeDefined();
    }
  });

  it("generates different plans for different iterations", async () => {
    const db = createFeltDB({ namespace: "test-coding-planning", memory: true });
    const store = createFeltDBLoopStore(db);
    const sandbox = new CodeSandbox();

    const loop = createLoop({
      store,
      planner: createCodingPlanner(sandbox),
      executor: createCodingExecutor(sandbox),
      evaluator: createCodingEvaluator(sandbox),
      budget: { maxIterations: 3 },
    });

    const result = await loop.run({ task: "Complex task requiring revisions" });

    // Get all iteration plans
    const plans = result.iterations.map((it) => it.plan?.objective);

    // First iteration should be about initial implementation
    expect(plans[0]?.toLowerCase()).toContain("initial");

    // If there were revisions, later iterations should show revision plans
    if (result.iterations.length > 1) {
      expect(plans[1]?.toLowerCase()).toContain("revision");
    }
  });

  it("collects evidence from all execution steps", async () => {
    const db = createFeltDB({ namespace: "test-coding-evidence", memory: true });
    const store = createFeltDBLoopStore(db);
    const sandbox = new CodeSandbox();

    const loop = createLoop({
      store,
      planner: createCodingPlanner(sandbox),
      executor: createCodingExecutor(sandbox),
      evaluator: createCodingEvaluator(sandbox),
      budget: { maxIterations: 2 },
    });

    const result = await loop.run({ task: "Task requiring evidence collection" });

    // Verify evidence was collected
    expect(result.evidence.length).toBeGreaterThan(0);

    // Group evidence by type
    const evidenceByType = result.evidence.reduce(
      (acc: Record<string, number>, ev: any) => {
        acc[ev.type] = (acc[ev.type] ?? 0) + 1;
        return acc;
      },
      {}
    );

    // Should have various evidence types
    expect(Object.keys(evidenceByType).length).toBeGreaterThan(0);

    // Each evidence item should have required fields
    for (const ev of result.evidence) {
      expect(ev.id).toBeDefined();
      expect(ev.type).toBeDefined();
      expect(ev.value).toBeDefined();
      expect(ev.timestamp).toBeDefined();
      expect(ev.iterationId).toBeDefined();
    }
  });

  it("demonstrates loop events for observability", async () => {
    const db = createFeltDB({ namespace: "test-coding-events", memory: true });
    const store = createFeltDBLoopStore(db);
    const sandbox = new CodeSandbox();

    const loop = createLoop({
      store,
      planner: createCodingPlanner(sandbox),
      executor: createCodingExecutor(sandbox),
      evaluator: createCodingEvaluator(sandbox),
      budget: { maxIterations: 2 },
    });

    const events: string[] = [];

    // Subscribe to all loop events
    loop.on("run.started", () => events.push("run.started"));
    loop.on("iteration.started", () => events.push("iteration.started"));
    loop.on("plan.created", () => events.push("plan.created"));
    loop.on("execution.completed", () => events.push("execution.completed"));
    loop.on("evaluation.completed", () => events.push("evaluation.completed"));
    loop.on("run.completed", () => events.push("run.completed"));

    const result = await loop.run({ task: "Observable task" });

    // Verify key events were emitted
    expect(events).toContain("run.started");
    expect(events).toContain("iteration.started");
    expect(events).toContain("plan.created");
    expect(events).toContain("execution.completed");
    expect(events).toContain("evaluation.completed");
    expect(events).toContain("run.completed");

    // Verify event order is correct
    const runStartIdx = events.indexOf("run.started");
    const iterStartIdx = events.indexOf("iteration.started");
    const planIdx = events.indexOf("plan.created");
    const execIdx = events.indexOf("execution.completed");
    const evalIdx = events.indexOf("evaluation.completed");
    const completedIdx = events.indexOf("run.completed");

    expect(runStartIdx).toBeLessThan(iterStartIdx);
    expect(iterStartIdx).toBeLessThan(planIdx);
    expect(planIdx).toBeLessThan(execIdx);
    expect(execIdx).toBeLessThan(evalIdx);
    expect(evalIdx).toBeLessThan(completedIdx);
  });

  it("allows resuming an incomplete task", async () => {
    const db = createFeltDB({ namespace: "test-coding-resume", memory: true });
    const store = createFeltDBLoopStore(db);
    const sandbox = new CodeSandbox();

    const loop = createLoop({
      store,
      planner: createCodingPlanner(sandbox),
      executor: createCodingExecutor(sandbox),
      evaluator: createCodingEvaluator(sandbox),
      budget: { maxIterations: 3 },
    });

    // Run the task
    const result = await loop.run({ task: "Resumable task" });
    const runId = result.run.id;

    // Verify the task completed
    expect(result.run.state).toBe("completed");

    // Verify we can retrieve the result
    const retrieved = await loop.get(runId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.run.id).toBe(runId);
    expect(retrieved?.iterations.length).toBeGreaterThan(0);
  });

  it("sandbox maintains state across actions", async () => {
    const sandbox = new CodeSandbox();

    // Create a file
    sandbox.createOrUpdateFile("test.ts", "export const test = true;");
    expect(sandbox.getFile("test.ts")).toBe("export const test = true;");

    // Modify the file
    sandbox.createOrUpdateFile("test.ts", "export const test = false;");
    expect(sandbox.getFile("test.ts")).toBe("export const test = false;");

    // List files
    expect(sandbox.listFiles()).toContain("test.ts");

    // Delete the file
    sandbox.deleteFile("test.ts");
    expect(sandbox.getFile("test.ts")).toBeUndefined();
    expect(sandbox.listFiles()).not.toContain("test.ts");
  });

  it("sandbox command execution works", async () => {
    const sandbox = new CodeSandbox();

    // Run a test command
    const testResult = await sandbox.runCommand("npm test");
    expect(testResult.exitCode).toBe(0);
    expect(testResult.output).toContain("test");

    // Run a build command
    const buildResult = await sandbox.runCommand("npm run build");
    expect(buildResult.exitCode).toBe(0);
    expect(buildResult.output).toContain("success");

    // Verify command log
    const log = sandbox.getCommandLog();
    expect(log.length).toBe(2);
    expect(log[0].command).toContain("npm test");
    expect(log[1].command).toContain("npm run build");
  });
});
