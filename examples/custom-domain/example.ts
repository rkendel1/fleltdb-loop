/**
 * Custom domain example: Research Task
 * 
 * This demonstrates how @feltdb/loop can be used for any domain,
 * not just coding. Here we show a research workflow.
 */

import { createLoop, createFeltDBLoopStore } from "../../packages/loop/src/index";
import { createFeltDB } from "@feltdb/core";
import type { Plan, ExecutionResult, Evaluation, LoopContext } from "../../packages/loop/src/index";

/**
 * Simulated research environment
 */
class ResearchEnvironment {
  private findings: Map<string, any> = new Map();
  private queries: Array<{ question: string; answer: string }> = [];

  /**
   * Execute a research query
   */
  async research(question: string): Promise<string> {
    // Simulate research results
    const answer = `Research findings for: ${question}\n- Finding 1: Positive result\n- Finding 2: Supporting evidence\n- Finding 3: Conclusion`;
    this.queries.push({ question, answer });
    return answer;
  }

  /**
   * Store a finding
   */
  storeFinding(key: string, value: any): void {
    this.findings.set(key, value);
  }

  /**
   * Analyze findings
   */
  analyzeFinding(key: string): boolean {
    const finding = this.findings.get(key);
    return finding && finding.relevant === true;
  }

  /**
   * Get all findings
   */
  getFindings(): Map<string, any> {
    return this.findings;
  }

  /**
   * Get research history
   */
  getHistory(): Array<{ question: string; answer: string }> {
    return this.queries;
  }
}

/**
 * Create a research planner
 */
function createResearchPlanner(environment: ResearchEnvironment) {
  return {
    async plan(context: LoopContext): Promise<Plan> {
      const { task, iteration, previousIterations } = context;

      let actions: any[] = [];
      let objective = "";

      if (iteration.number === 1) {
        // First iteration: Initial research
        objective = `Research: ${task}`;
        actions = [
          {
            type: "research",
            question: task,
          },
          {
            type: "analyze",
            key: "initial_research",
          },
        ];
      } else {
        // Subsequent iterations: Deeper research
        objective = `Deep dive into ${task}`;
        actions = [
          {
            type: "research",
            question: `What are the implications of ${task}?`,
          },
          {
            type: "analyze",
            key: "implications",
          },
        ];
      }

      return {
        objective,
        actions: actions.map((a) => ({
          type: a.type,
          payload: a,
        })),
      };
    },
  };
}

/**
 * Create a research executor
 */
function createResearchExecutor(environment: ResearchEnvironment) {
  return {
    async execute(plan: Plan, context: LoopContext): Promise<ExecutionResult> {
      const evidence = [];
      let success = true;

      for (const action of plan.actions) {
        const payload = action.payload as any;

        if (payload.type === "research") {
          const answer = await environment.research(payload.question);
          environment.storeFinding(payload.question, { result: answer, relevant: true });
          evidence.push({
            id: `research_${Date.now()}`,
            type: "research.completed",
            source: payload.question,
            value: { question: payload.question, answerLength: answer.length },
            timestamp: Date.now(),
            iterationId: context.iteration.id,
          });
        } else if (payload.type === "analyze") {
          const result = environment.analyzeFinding(payload.key);
          evidence.push({
            id: `analysis_${Date.now()}`,
            type: "analysis.completed",
            source: payload.key,
            value: { key: payload.key, relevant: result },
            timestamp: Date.now(),
            iterationId: context.iteration.id,
          });
        }
      }

      return {
        success,
        output: { findings: environment.getFindings().size },
        evidence,
      };
    },
  };
}

/**
 * Create a research evaluator
 */
function createResearchEvaluator(environment: ResearchEnvironment) {
  return {
    async evaluate(context: LoopContext, execution: ExecutionResult): Promise<Evaluation> {
      const evidence: any[] = [];

      if (!execution.success) {
        return {
          outcome: "fail",
          reasoning: "Execution failed",
          evidence,
        };
      }

      // Check if we have enough findings
      const findings = environment.getFindings();
      const enoughFindings = findings.size >= context.iteration.number + 1;

      evidence.push({
        id: `eval_${Date.now()}`,
        type: "evaluation.result",
        value: { findingsCount: findings.size, needed: context.iteration.number + 1 },
        timestamp: Date.now(),
        iterationId: context.iteration.id,
      });

      if (enoughFindings) {
        return {
          outcome: "accept",
          reasoning: "Sufficient findings gathered",
          evidence,
        };
      }

      if (context.iteration.number < 3) {
        return {
          outcome: "revise",
          reasoning: "Need more research",
          evidence,
        };
      }

      return {
        outcome: "fail",
        reasoning: "Max iterations reached",
        evidence,
      };
    },
  };
}

/**
 * Run the research example
 */
async function main(): Promise<void> {
  console.log("\nCustom Domain Example: Research\n" + "=".repeat(50) + "\n");

  const db = createFeltDB({ namespace: "research-example", memory: true });
  const store = createFeltDBLoopStore(db);
  const environment = new ResearchEnvironment();

  const loop = createLoop({
    store,
    planner: createResearchPlanner(environment),
    executor: createResearchExecutor(environment),
    evaluator: createResearchEvaluator(environment),
    budget: { maxIterations: 3 },
  });

  // Subscribe to events
  loop.on("run.started", () => console.log("→ Research task started"));
  loop.on("plan.created", (payload: any) => console.log(`→ Plan: ${payload.plan.objective}`));
  loop.on("execution.completed", (payload: any) => {
    const output = payload.execution.output as any;
    console.log(`→ Execution: ${output.findings} findings collected`);
  });
  loop.on("evaluation.completed", (payload: any) => {
    console.log(`→ Evaluation outcome: ${payload.evaluation.outcome}`);
  });
  loop.on("run.completed", () => console.log("→ Research completed successfully"));
  loop.on("run.failed", () => console.log("→ Research failed"));

  const result = await loop.run({ task: "How do autonomous agents work?" });

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log(`State: ${result.run.state}`);
  console.log(`Iterations: ${result.iterations.length}`);
  console.log(`Evidence collected: ${result.evidence.length}`);
  console.log(`Research history: ${environment.getHistory().length} queries`);
  console.log(`Total findings: ${environment.getFindings().size}`);
  console.log("=".repeat(50) + "\n");
}

main();
