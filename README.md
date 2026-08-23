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

## Positioning

- `@feltdb/core`: durable state
- `@feltdb/loop`: durable iterative work
- application/agent: domain behavior
