import { randomUUID } from "node:crypto";
import type { StateFirstDB } from "@feltdb/core";
import { isTransitionAllowed } from "./state-machine";
import type {
  CreateRunInput,
  Evidence,
  LoopIteration,
  LoopRun,
  LoopState,
  LoopStore,
} from "./types";

interface FeltDBStoreOptions {
  runsCollection?: string;
  iterationsCollection?: string;
  evidenceCollection?: string;
}

type RunRecord = LoopRun;
type IterationRecord = LoopIteration;
type EvidenceRecord = Evidence & { runId: string };

export const createFeltDBLoopStore = (
  db: StateFirstDB,
  options: FeltDBStoreOptions = {},
): LoopStore => {
  const runs = db.collection<RunRecord>(options.runsCollection ?? "loop_runs");
  const iterations = db.collection<IterationRecord>(
    options.iterationsCollection ?? "loop_iterations",
  );
  const evidence = db.collection<EvidenceRecord>(
    options.evidenceCollection ?? "loop_evidence",
  );

  return {
    async createRun(input: CreateRunInput): Promise<LoopRun> {
      const now = Date.now();
      const run: LoopRun = {
        id: randomUUID(),
        task: input.task,
        state: "pending",
        iteration: 0,
        createdAt: now,
        updatedAt: now,
        metadata: input.metadata ?? {},
      };
      await runs.insert(run, run.id);
      return run;
    },

    async getRun(id: string): Promise<LoopRun | null> {
      return runs.get(id);
    },

    async updateRun(id: string, patch: Partial<LoopRun>): Promise<LoopRun> {
      const current = await runs.get(id);
      if (!current) {
        throw new Error(`Run not found: ${id}`);
      }
      const next = { ...current, ...patch, updatedAt: Date.now() };
      await runs.update(id, next);
      return next;
    },

    async createIteration(runId: string, number: number): Promise<LoopIteration> {
      const iteration: LoopIteration = {
        id: randomUUID(),
        runId,
        number,
        startedAt: Date.now(),
      };
      await iterations.insert(iteration, iteration.id);
      return iteration;
    },

    async updateIteration(id: string, patch: Partial<LoopIteration>): Promise<LoopIteration> {
      const current = await iterations.get(id);
      if (!current) {
        throw new Error(`Iteration not found: ${id}`);
      }
      const next = { ...current, ...patch };
      await iterations.update(id, next);
      return next;
    },

    async listIterations(runId: string): Promise<LoopIteration[]> {
      const rows = await iterations.find({ runId } as Partial<LoopIteration>);
      return rows.sort((a, b) => a.number - b.number);
    },

    async appendEvidence(runId: string, rows: Evidence[]): Promise<void> {
      await Promise.all(
        rows.map((row) => evidence.insert({ ...row, runId }, row.id)),
      );
    },

    async listEvidence(runId: string): Promise<Evidence[]> {
      const rows = await evidence.find({ runId } as Partial<EvidenceRecord>);
      return rows.map(({ runId: _runId, ...item }) => item);
    },

    async transition(runId: string, state: LoopState, patch?: Partial<LoopRun>): Promise<LoopRun> {
      const current = await runs.get(runId);
      if (!current) {
        throw new Error(`Run not found: ${runId}`);
      }
      if (!isTransitionAllowed(current.state, state)) {
        throw new Error(`Illegal transition: ${current.state} -> ${state}`);
      }
      const next = {
        ...current,
        ...patch,
        state,
        updatedAt: Date.now(),
      };
      await runs.update(runId, next);
      return next;
    },
  };
};
