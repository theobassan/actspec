<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1><code>@actharness/core</code></h1>
  <p>Runtime engine for actharness.</p>
  <a href="https://www.npmjs.com/package/@actharness/core"><img src="https://img.shields.io/npm/v/@actharness/core?color=3fb950&label=npm" alt="npm"></a>
  <a href="https://github.com/actharness/actharness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-3fb950" alt="license"></a>
</div>

<br>

Runtime engine for [actharness](https://github.com/theobassan/actharness) — the GitHub Actions unit testing framework.

Parses `action.yml`, builds the execution context, resolves mocks, dispatches to registered executors, and emits `RunResult`s. Everything else (`@actharness/composite`, `@actharness/coverage`, `@actharness/matchers`) plugs into this package without creating a reverse dependency.

## Usage

```ts
import { actharness, globalMock } from '@actharness/core';

// Mock a `uses:` step
globalMock('actions/checkout@v4', { outputs: { ref: 'abc123' } });

// Run with inputs and context overrides
const result = await actharness('./action.yml').run({
  inputs: { name: 'World' },
  github: { event_name: 'push' },
});

console.log(result.conclusion); // 'success' | 'failure'
console.log(result.outputs);
console.log(result.steps);
```

## Determinism

Runs are deterministic by default — the clock is frozen, RNG is seeded, and temp paths are stable. Override per-call:

```ts
const result = await action.run({
  inputs: { name: 'World' },
  determinism: {
    now: new Date('2024-06-01T00:00:00Z'),
    seed: 42,
  },
});
```

## Run sink

Other packages observe runs without creating a dependency on `@actharness/core`:

```ts
import { registerRunListener } from '@actharness/core';

registerRunListener((result) => {
  // called after every action.run() completes
});
```

## Contents

- `actharness(source, options?)` — create an `Action` handle
- `Action` — `.run()`
- `globalMock(ref, def?)` — register a mock (equivalent to `actharness.mock()` in the meta-package)
- `globalResetMocks()` — clear all mocks
- `RunInput`, `RunResult`, `StepResult`, `Annotation`
- `ActharnessOptions`, `Determinism`
- `ActionExecutor`, `ExecutionCall`, `ExecutionResult` — executor registration seam
- `registerExecutor(executor)` — register a custom executor
- `registerRunListener(listener)` — subscribe to completed runs
- Error hierarchy: `ActharnessError`, `ParseError`, `ConfigError`, `MissingMockError`
