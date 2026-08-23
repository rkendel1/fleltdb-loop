/**
 * Coding domain helpers for autonomous coding tasks using @feltdb/loop.
 * 
 * This demonstrates how a real-world consumer (easy-llm-code) would use @feltdb/loop
 * to implement an autonomous coding workflow with:
 * - Repository intelligence
 * - Task planning
 * - Safe mutation (sandboxed execution)
 * - Sandbox executor
 * - Tests/build verification
 * - Outcome-aware memory (via loop context)
 */

import type { Plan, Evidence, ExecutionResult, Evaluation, LoopContext } from "../../packages/loop/src/index";

/**
 * Represents a coding action (mutation) that can be executed.
 */
export interface CodeAction {
  type: "create_file" | "modify_file" | "delete_file" | "run_command" | "run_tests";
  target?: string;
  content?: string;
  command?: string;
}

/**
 * Simulated sandbox environment for safe code execution.
 */
export class CodeSandbox {
  private files: Map<string, string> = new Map();
  private commandLog: Array<{ command: string; exitCode: number; output: string }> = [];

  /**
   * Create or update a file in the sandbox.
   */
  createOrUpdateFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  /**
   * Get a file from the sandbox.
   */
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  /**
   * Delete a file from the sandbox.
   */
  deleteFile(path: string): void {
    this.files.delete(path);
  }

  /**
   * List all files in the sandbox.
   */
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Simulate running a command in the sandbox.
   * In a real implementation, this would use a real sandbox like containers or processes.
   */
  async runCommand(command: string): Promise<{ exitCode: number; output: string }> {
    // Simulate command execution
    let exitCode = 0;
    let output = "";

    if (command.startsWith("npm test") || command.startsWith("npm run test")) {
      // Simulate test execution
      output = this.simulateTests();
      exitCode = 0; // In this simulation, tests pass
    } else if (command.startsWith("npm run build") || command === "tsc") {
      // Simulate build
      output = this.simulateBuild();
      exitCode = 0; // In this simulation, build succeeds
    } else if (command.startsWith("node ") || command.startsWith("npx ")) {
      // Simulate script execution
      output = `Command executed: ${command}\nSuccess!`;
      exitCode = 0;
    } else {
      output = `Unknown command: ${command}`;
      exitCode = 1;
    }

    this.commandLog.push({ command, exitCode, output });
    return { exitCode, output };
  }

  /**
   * Get the command execution log.
   */
  getCommandLog(): Array<{ command: string; exitCode: number; output: string }> {
    return [...this.commandLog];
  }

  /**
   * Get the current state of the sandbox (files and execution log).
   */
  getState(): {
    files: Record<string, string>;
    commandLog: Array<{ command: string; exitCode: number; output: string }>;
  } {
    return {
      files: Object.fromEntries(this.files),
      commandLog: this.getCommandLog(),
    };
  }

  private simulateTests(): string {
    return `
Running tests...
✓ Test 1: Feature implementation works correctly
✓ Test 2: Error handling is correct
✓ Test 3: Integration with existing code is solid
3 tests passed in 125ms
    `;
  }

  private simulateBuild(): string {
    return `
Building project...
✓ TypeScript compilation successful
✓ All type checks passed
✓ Bundle size: 42.3KB
Build completed in 234ms
    `;
  }
}

/**
 * Creates a planner for coding tasks.
 * The planner decides what code actions to take based on the task.
 */
export function createCodingPlanner(sandbox: CodeSandbox) {
  return {
    async plan(context: LoopContext): Promise<Plan> {
      const { task, iteration, previousIterations } = context;

      // Simple planning logic: decide what actions to take based on the task and previous iterations
      const isFirstIteration = iteration.number === 1;
      const hasFailedTests = previousIterations.some(
        (it) => it.evaluation?.outcome === "revise"
      );

      let actions: CodeAction[] = [];
      let objective = "";

      if (isFirstIteration) {
        // First iteration: create initial implementation
        objective = `Initial implementation: ${task}`;
        actions = [
          {
            type: "create_file",
            target: "solution.ts",
            content: generateInitialImplementation(task),
          },
          {
            type: "run_tests",
            command: "npm test",
          },
        ];
      } else if (hasFailedTests) {
        // Revision: improve based on test failures
        objective = `Revise implementation based on feedback`;
        actions = [
          {
            type: "modify_file",
            target: "solution.ts",
            content: generateImprovedImplementation(task, previousIterations),
          },
          {
            type: "run_tests",
            command: "npm test",
          },
        ];
      } else {
        // Additional validation
        objective = "Validate implementation with additional tests";
        actions = [
          {
            type: "run_command",
            command: "npm run build",
          },
          {
            type: "run_tests",
            command: "npm test",
          },
        ];
      }

      return {
        objective,
        actions: actions.map((a) => ({
          type: a.type,
          payload: a,
        })),
        rationale: `Based on iteration ${iteration.number} and task: ${task}`,
      };
    },
  };
}

/**
 * Creates an executor for coding tasks.
 * The executor safely executes the plan in a sandbox.
 */
export function createCodingExecutor(sandbox: CodeSandbox) {
  return {
    async execute(plan: Plan, context: LoopContext): Promise<ExecutionResult> {
      const evidence: Evidence[] = [];
      let success = true;
      let output: unknown = null;

      try {
        for (const action of plan.actions) {
          const codeAction = action.payload as CodeAction;

          if (codeAction.type === "create_file" && codeAction.target && codeAction.content) {
            sandbox.createOrUpdateFile(codeAction.target, codeAction.content);
            evidence.push({
              id: `create_${codeAction.target}_${Date.now()}`,
              type: "file.created",
              source: codeAction.target,
              value: { path: codeAction.target, size: codeAction.content.length },
              timestamp: Date.now(),
              iterationId: context.iteration.id,
            });
          } else if (codeAction.type === "modify_file" && codeAction.target && codeAction.content) {
            sandbox.createOrUpdateFile(codeAction.target, codeAction.content);
            evidence.push({
              id: `modify_${codeAction.target}_${Date.now()}`,
              type: "file.modified",
              source: codeAction.target,
              value: { path: codeAction.target, size: codeAction.content.length },
              timestamp: Date.now(),
              iterationId: context.iteration.id,
            });
          } else if (codeAction.type === "delete_file" && codeAction.target) {
            sandbox.deleteFile(codeAction.target);
            evidence.push({
              id: `delete_${codeAction.target}_${Date.now()}`,
              type: "file.deleted",
              source: codeAction.target,
              value: { path: codeAction.target },
              timestamp: Date.now(),
              iterationId: context.iteration.id,
            });
          } else if (
            (codeAction.type === "run_tests" || codeAction.type === "run_command") &&
            codeAction.command
          ) {
            const { exitCode, output: cmdOutput } = await sandbox.runCommand(codeAction.command);
            evidence.push({
              id: `cmd_${Date.now()}`,
              type: codeAction.type === "run_tests" ? "test.execution" : "command.execution",
              source: codeAction.command,
              value: { command: codeAction.command, exitCode, output: cmdOutput },
              timestamp: Date.now(),
              iterationId: context.iteration.id,
            });

            if (exitCode !== 0) {
              success = false;
              output = {
                status: "failed",
                command: codeAction.command,
                exitCode,
                output: cmdOutput,
              };
              break;
            }
          }
        }

        if (success) {
          output = {
            status: "success",
            files: sandbox.listFiles(),
            executedActions: plan.actions.length,
          };
        }
      } catch (error) {
        success = false;
        output = {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        };
      }

      return { success, output, evidence };
    },
  };
}

/**
 * Creates an evaluator for coding tasks.
 * The evaluator checks if the task is complete based on test results and evidence.
 */
export function createCodingEvaluator(sandbox: CodeSandbox) {
  return {
    async evaluate(context: LoopContext, execution: ExecutionResult): Promise<Evaluation> {
      const evidence: Evidence[] = [];

      if (!execution.success) {
        evidence.push({
          id: `eval_failure_${Date.now()}`,
          type: "evaluation.result",
          value: { status: "execution_failed", message: "Execution did not complete successfully" },
          timestamp: Date.now(),
          iterationId: context.iteration.id,
        });

        return {
          outcome: "fail",
          reasoning: "Execution failed - unable to complete task",
          evidence,
        };
      }

      // Check if tests passed
      const commandLog = sandbox.getCommandLog();
      const testResults = commandLog.filter((cmd) => cmd.command.includes("test"));

      if (testResults.length > 0 && testResults.every((r) => r.exitCode === 0)) {
        evidence.push({
          id: `eval_success_${Date.now()}`,
          type: "evaluation.result",
          value: { status: "all_tests_passed", testCount: testResults.length },
          timestamp: Date.now(),
          iterationId: context.iteration.id,
        });

        return {
          outcome: "accept",
          reasoning: "All tests passed - task is complete",
          evidence,
        };
      }

      // Check if we should revise (simple heuristic: retry up to 3 times)
      const { iteration } = context;
      if (iteration.number < 3) {
        evidence.push({
          id: `eval_revise_${Date.now()}`,
          type: "evaluation.result",
          value: { status: "needs_revision", iteration: iteration.number },
          timestamp: Date.now(),
          iterationId: context.iteration.id,
        });

        return {
          outcome: "revise",
          reasoning: `Iteration ${iteration.number}: Need to revise implementation`,
          nextObjective: "Improve implementation based on test results",
          evidence,
        };
      }

      // Max iterations reached
      evidence.push({
        id: `eval_fail_${Date.now()}`,
        type: "evaluation.result",
        value: { status: "max_iterations_reached", maxIterations: 3 },
        timestamp: Date.now(),
        iterationId: context.iteration.id,
      });

      return {
        outcome: "fail",
        reasoning: "Maximum iterations reached without completing the task",
        evidence,
      };
    },
  };
}

/**
 * Generate initial implementation based on task.
 * In a real system, this would be generated by an LLM based on the task description.
 */
function generateInitialImplementation(task: string): string {
  return `// Implementation for: ${task}
export function solve(input: unknown): unknown {
  // First attempt at solving the task
  console.log("Solving task:", "${task}");
  return { status: "success", result: input };
}

export default solve;
  `;
}

/**
 * Generate improved implementation based on previous iterations.
 * In a real system, this would be generated by an LLM based on test failures and feedback.
 */
function generateImprovedImplementation(task: string, previousIterations: any[]): string {
  return `// Improved implementation for: ${task}
// Based on feedback from ${previousIterations.length} previous iteration(s)
export function solve(input: unknown): unknown {
  // Improved version with better error handling and logic
  console.log("Solving task (improved):", "${task}");
  
  if (input === null || input === undefined) {
    throw new Error("Input cannot be null or undefined");
  }
  
  return { status: "success", result: input, improved: true };
}

export default solve;
  `;
}
