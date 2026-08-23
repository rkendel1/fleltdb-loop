# Basic Example

Minimal @feltdb/loop usage example.

## Overview

This example demonstrates the simplest possible usage of @feltdb/loop with stub implementations.

## Key Concepts

- **Planner**: Creates a plan for what to do
- **Executor**: Executes the plan and collects evidence
- **Evaluator**: Evaluates if the plan succeeded
- **Loop**: Orchestrates the cycle and handles revisions

## Running

```bash
npm run build
node dist/examples/basic/example.js
```

## What It Shows

This minimal example shows:
- Creating a loop with three simple implementations
- Subscribing to loop events
- Running a task to completion
- Accessing the results

For a more complete example, see `examples/coding/`.
