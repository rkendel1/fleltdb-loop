export type LoopState =
  | "pending"
  | "planning"
  | "executing"
  | "evaluating"
  | "revising"
  | "completed"
  | "failed"
  | "cancelled";

export interface Action {
  type: string;
  payload?: unknown;
}

export interface Plan {
  objective: string;
  actions: Action[];
  rationale?: string;
}

export interface Evidence {
  id: string;
  type: string;
  source?: string;
  value: unknown;
  timestamp: number;
  iterationId: string;
}

export interface LoopError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  evidence?: Evidence[];
  error?: LoopError;
}

export interface Evaluation {
  outcome: "accept" | "revise" | "fail";
  reasoning?: string;
  evidence: Evidence[];
  nextObjective?: string;
}

export interface LoopRun {
  id: string;
  task: string;
  state: LoopState;
  iteration: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  failureCode?: string;
}

export interface LoopIteration {
  id: string;
  runId: string;
  number: number;
  plan?: Plan;
  execution?: ExecutionResult;
  evaluation?: Evaluation;
  startedAt: number;
  completedAt?: number;
}

export interface LoopContext {
  run: LoopRun;
  iteration: LoopIteration;
  task: string;
  previousIterations: LoopIteration[];
  evidence: Evidence[];
  metadata: Record<string, unknown>;
}

export interface LoopBudget {
  maxIterations?: number;
  maxDurationMs?: number;
  maxExecutions?: number;
}

export interface Planner {
  plan(context: LoopContext): Promise<Plan>;
}

export interface Executor {
  execute(plan: Plan, context: LoopContext): Promise<ExecutionResult>;
}

export interface Evaluator {
  evaluate(context: LoopContext, execution: ExecutionResult): Promise<Evaluation>;
}

export interface CreateRunInput {
  task: string;
  metadata?: Record<string, unknown>;
}

export interface LoopStore {
  createRun(input: CreateRunInput): Promise<LoopRun>;
  getRun(id: string): Promise<LoopRun | null>;
  updateRun(id: string, patch: Partial<LoopRun>): Promise<LoopRun>;
  createIteration(runId: string, number: number): Promise<LoopIteration>;
  updateIteration(id: string, patch: Partial<LoopIteration>): Promise<LoopIteration>;
  listIterations(runId: string): Promise<LoopIteration[]>;
  appendEvidence(runId: string, evidence: Evidence[]): Promise<void>;
  listEvidence(runId: string): Promise<Evidence[]>;
  transition(runId: string, state: LoopState, patch?: Partial<LoopRun>): Promise<LoopRun>;
}

export interface RunInput {
  task: string;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface LoopResult {
  run: LoopRun;
  iterations: LoopIteration[];
  evidence: Evidence[];
}

export interface LoopHandle {
  run(input: RunInput): Promise<LoopResult>;
  resume(runId: string, signal?: AbortSignal): Promise<LoopResult>;
  get(runId: string): Promise<LoopResult | null>;
  on(event: LoopEvent, listener: (payload: unknown) => void): () => void;
}

export type LoopEvent =
  | "run.started"
  | "iteration.started"
  | "plan.created"
  | "execution.completed"
  | "evaluation.completed"
  | "iteration.revised"
  | "run.completed"
  | "run.failed"
  | "run.cancelled";

export interface CreateLoopOptions {
  store: LoopStore;
  planner: Planner;
  executor: Executor;
  evaluator: Evaluator;
  budget?: LoopBudget;
}
