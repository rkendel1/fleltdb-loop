import { isTerminal } from "./state-machine";
import type { LoopRun } from "./types";

export const canResume = (run: LoopRun): boolean => !isTerminal(run.state);
