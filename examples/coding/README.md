# Coding Domain Example

Real-world integration example demonstrating how `@feltdb/loop` serves as a core iterative runtime for autonomous coding systems like easy-llm-code.

## Overview

This example proves that `@feltdb/loop` is a useful primitive by implementing a complete autonomous coding workflow:

```
Task
  ↓
Planner → generates code changes/actions
  ↓
Sandbox Executor → safely executes actions
  ↓
Evidence → collects test results, file changes
  ↓
Evaluator → checks if task is complete
  ↓
Revise (loop back to Planner) or Complete
```

## Architecture

The example demonstrates how a real consumer implements:

### 1. **Task Planning** (`createCodingPlanner`)
- Analyzes the task and previous iterations
- Decides what code actions to take
- Generates plans for implementation, modification, or validation
- Uses outcome-aware memory (previous iterations) to improve plans

### 2. **Safe Execution** (`CodeSandbox` + `createCodingExecutor`)
- Sandboxed environment for safe code mutation
- Executes file operations (create, modify, delete)
- Runs tests and builds
- Collects evidence from all operations
- Prevents unintended side effects

### 3. **Outcome Evaluation** (`createCodingEvaluator`)
- Analyzes execution results
- Checks test outcomes
- Decides: accept (complete), revise (loop), or fail
- Collects evaluation evidence

### 4. **Durable State** (`createFeltDBLoopStore`)
- Stores all iterations, plans, executions, and evaluations
- Enables resumption after interruption
- Provides audit trail of all decisions

## Key Capabilities

This example implements all key features mentioned in the issue:

- **Repository Intelligence**: Plans analyze task context and previous iterations
- **Task Planning**: Planner generates appropriate code actions
- **Safe Mutation**: Sandbox isolates all file operations
- **Sandbox Execution**: Safe execution of commands and code changes
- **Tests/Build Verification**: Evaluator checks test results
- **Outcome-Aware Memory**: Loop context includes all previous iterations and evidence

## Files

- `helpers.ts`: Core domain logic for coding tasks
  - `CodeSandbox`: Simulated sandbox environment
  - `createCodingPlanner`: Plans coding actions
  - `createCodingExecutor`: Executes plans safely
  - `createCodingEvaluator`: Evaluates completion and revisions

- `example.ts`: Runnable example showing:
  - How to initialize `@feltdb/loop` with coding components
  - How to subscribe to loop events for observability
  - How to run and resume tasks
  - How to inspect results

## Running the Example

```bash
# From repository root
npm run build
node dist/examples/coding/example.js
```

## Integration Pattern

This example shows the pattern for integrating any domain with `@feltdb/loop`:

1. **Define domain types** (CodeAction, etc.)
2. **Implement Planner**: `(context) => Promise<Plan>`
3. **Implement Executor**: `(plan, context) => Promise<ExecutionResult>`
4. **Implement Evaluator**: `(context, execution) => Promise<Evaluation>`
5. **Create store**: `createFeltDBLoopStore(db)`
6. **Create loop**: `createLoop({ store, planner, executor, evaluator })`
7. **Run tasks**: `loop.run({ task })`
8. **Resume when needed**: `loop.resume(runId)`
9. **Inspect results**: `loop.get(runId)`

## Proving the Architecture

This example demonstrates that `@feltdb/loop` is domain-neutral and works for real applications:

✓ The loop implementation has **no coding-specific logic**
✓ All domain knowledge is in the planner, executor, and evaluator
✓ The loop only orchestrates the iterative workflow
✓ This same pattern works for any domain (research, content generation, etc.)
✓ Easy-llm-code can use this without modifying the loop's abstraction

This validates that `@feltdb/loop` is a truly reusable primitive for building autonomous systems.
