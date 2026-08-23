# @feltdb/loop

`@feltdb/loop` is a small, model/provider-agnostic, durable callable loop primitive.

It owns the iterative runtime lifecycle:

`plan -> execute -> evaluate -> (revise|complete|fail)`

It does **not** include provider SDKs, prompts, coding tools, orchestration, or UI.

## API

```ts
import { createLoop, createFeltDBLoopStore } from "@feltdb/loop";
import { createFeltDB } from "@feltdb/core";

const db = createFeltDB({ namespace: "app", memory: true });
const store = createFeltDBLoopStore(db);

const loop = createLoop({ store, planner, executor, evaluator });

const started = await loop.run({ task: "Implement feature X" });
const resumed = await loop.resume(started.run.id);
const inspected = await loop.get(started.run.id);
```

## Examples

### Basic Example

See `examples/basic/` for a minimal example showing the simplest usage of `@feltdb/loop`.

### Coding Domain

See `examples/coding/` for a complete real-world example showing how autonomous coding systems can use `@feltdb/loop`:

- Autonomous task planning
- Safe sandbox execution
- Evidence collection (test results, file changes, etc.)
- Outcome-aware evaluation and revision
- Durable state across interruptions

This demonstrates that `@feltdb/loop` is a genuinely useful primitive for building autonomous systems without domain-specific abstractions in the loop itself.

### Custom Domain

See `examples/custom-domain/` for a research workflow example demonstrating that `@feltdb/loop` is domain-neutral and works for any iterative process.

## Key Features

- **Domain-Neutral**: No coding-specific logic in the loop itself
- **Durable**: All state persisted via `@feltdb/core`
- **Observable**: Comprehensive event system for monitoring progress
- **Composable**: Easily integrate with any planner, executor, or evaluator
- **Resumable**: Tasks can be interrupted and resumed from their current state

## Positioning

- `@feltdb/core`: durable state
- `@feltdb/loop`: durable iterative work
- application/agent: domain behavior
