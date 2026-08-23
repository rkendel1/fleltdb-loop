# fleltdb-loop

A small, model/provider-agnostic durable loop runtime for iterative work.

## Package

`@feltdb/loop`

## API

```ts
import { createLoop } from "@feltdb/loop";

const loop = createLoop({ store, planner, executor, evaluator });

const started = await loop.run({ task: "Implement feature X" });
const resumed = await loop.resume(started.run.id);
const inspected = await loop.get(started.run.id);
```
