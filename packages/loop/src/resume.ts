import { isTerminal } from "./state-machine.js";
import type { LoopRun } from "./types.js";

export const canResume = (run: LoopRun): boolean => !isTerminal(run.state);
