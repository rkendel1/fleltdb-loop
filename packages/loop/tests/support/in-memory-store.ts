import { randomUUID } from "node:crypto";
import { isTransitionAllowed } from "../../src/state-machine";
import type {
  CreateRunInput,
  Evidence,
  LoopIteration,
  LoopRun,
  LoopState,
  LoopStore,
} from "../../src/types";

export class InMemoryLoopStore implements LoopStore {
  private runs = new Map<string, LoopRun>();
  private iterations = new Map<string, LoopIteration[]>();
  private evidence = new Map<string, Evidence[]>();

  async createRun(input: CreateRunInput): Promise<LoopRun> {
    const now = Date.now();
    const run: LoopRun = {
      id: randomUUID(),
      task: input.task,
      state: "pending",
      iteration: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.id, run);
    this.iterations.set(run.id, []);
    this.evidence.set(run.id, []);
    return { ...run };
  }

  async getRun(id: string): Promise<LoopRun | null> {
    const run = this.runs.get(id);
    return run ? { ...run } : null;
  }

  async updateRun(id: string, patch: Partial<LoopRun>): Promise<LoopRun> {
    const current = this.runs.get(id);
    if (!current) {
      throw new Error(`Run not found: ${id}`);
    }
    const next: LoopRun = { ...current, ...patch, updatedAt: Date.now() };
    this.runs.set(id, next);
    return { ...next };
  }

  async createIteration(runId: string, number: number): Promise<LoopIteration> {
    const iteration: LoopIteration = {
      id: randomUUID(),
      runId,
      number,
      startedAt: Date.now(),
    };
    const current = this.iterations.get(runId);
    if (!current) {
      throw new Error(`Run not found: ${runId}`);
    }
    current.push(iteration);
    return { ...iteration };
  }

  async updateIteration(id: string, patch: Partial<LoopIteration>): Promise<LoopIteration> {
    for (const [runId, iterations] of this.iterations.entries()) {
      const index = iterations.findIndex((iteration) => iteration.id === id);
      if (index >= 0) {
        const next = { ...iterations[index], ...patch };
        iterations[index] = next;
        this.iterations.set(runId, iterations);
        return { ...next };
      }
    }
    throw new Error(`Iteration not found: ${id}`);
  }

  async listIterations(runId: string): Promise<LoopIteration[]> {
    return [...(this.iterations.get(runId) ?? [])].map((iteration) => ({ ...iteration }));
  }

  async appendEvidence(runId: string, evidence: Evidence[]): Promise<void> {
    const current = this.evidence.get(runId);
    if (!current) {
      throw new Error(`Run not found: ${runId}`);
    }
    current.push(...evidence);
  }

  async listEvidence(runId: string): Promise<Evidence[]> {
    return [...(this.evidence.get(runId) ?? [])].map((item) => ({ ...item }));
  }

  async transition(runId: string, state: LoopState, patch?: Partial<LoopRun>): Promise<LoopRun> {
    const current = this.runs.get(runId);
    if (!current) {
      throw new Error(`Run not found: ${runId}`);
    }
    if (!isTransitionAllowed(current.state, state)) {
      throw new Error(`Illegal transition: ${current.state} -> ${state}`);
    }
    const next: LoopRun = {
      ...current,
      ...patch,
      state,
      updatedAt: Date.now(),
    };
    this.runs.set(runId, next);
    return { ...next };
  }
}
