import { randomUUID } from "node:crypto";
import type { Evidence } from "./types.js";

export const normalizeEvidence = (
  evidence: Evidence[] | undefined,
  iterationId: string,
): Evidence[] =>
  (evidence ?? []).map((item) => ({
    ...item,
    id: item.id || randomUUID(),
    timestamp: item.timestamp || Date.now(),
    iterationId,
  }));
