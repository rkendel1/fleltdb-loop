# Custom Domain Example

Domain-neutral loop usage example demonstrating research workflow.

## Overview

This example shows how `@feltdb/loop` can be used for any domain. Here we demonstrate a research workflow where the loop:

1. Plans research queries
2. Executes research and collects findings
3. Evaluates if enough findings have been gathered
4. Revises and loops for deeper research if needed

## Key Components

- **ResearchEnvironment**: Simulated environment for research execution
- **createResearchPlanner**: Plans research activities
- **createResearchExecutor**: Executes research queries and analysis
- **createResearchEvaluator**: Evaluates progress and decides on revisions

## Workflow

```
Task: "How do autonomous agents work?"
  ↓
Planner → Plans research queries on autonomous agents
  ↓
Executor → Researches and collects findings
  ↓
Evaluator → Checks if enough findings gathered
  ↓
Revise (if needed) or Complete
```

## Running

```bash
npm run build
node dist/examples/custom-domain/example.js
```

## Key Takeaway

This example demonstrates that `@feltdb/loop` is domain-agnostic. The same loop implementation works for:
- Coding tasks (examples/coding/)
- Research tasks (this example)
- Content generation
- Data analysis
- Any iterative workflow

The loop never needs to know about the specific domain—only the planner, executor, and evaluator need to be domain-aware.
