import type { LoopError } from "./types";

export class LoopRuntimeError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "LoopRuntimeError";
    this.code = code;
    this.details = details;
  }

  toLoopError(): LoopError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export const BUDGET_EXCEEDED = "BUDGET_EXCEEDED";
export const CANCELLED = "CANCELLED";
