import type { LoopState } from "./types";

const allowed: Record<LoopState, Set<LoopState>> = {
  pending: new Set(["planning", "cancelled", "failed"]),
  planning: new Set(["executing", "failed", "cancelled"]),
  executing: new Set(["evaluating", "failed", "revising", "cancelled"]),
  evaluating: new Set(["revising", "completed", "failed", "cancelled"]),
  revising: new Set(["planning", "failed", "cancelled"]),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

export const isTerminal = (state: LoopState): boolean =>
  state === "completed" || state === "failed" || state === "cancelled";

export const isTransitionAllowed = (from: LoopState, to: LoopState): boolean =>
  from === to || allowed[from].has(to);
