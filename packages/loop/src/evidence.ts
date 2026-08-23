import type { Evidence } from "./types";

const randomId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const normalizeEvidence = (
  evidence: Evidence[] | undefined,
  iterationId: string,
): Evidence[] =>
  (evidence ?? []).map((item) => ({
    ...item,
    id: item.id || randomId(),
    timestamp: item.timestamp || Date.now(),
    iterationId,
  }));
