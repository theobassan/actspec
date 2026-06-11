<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1><code>@actharness/composite</code></h1>
  <p>Composite action executor for actharness.</p>
  <a href="https://www.npmjs.com/package/@actharness/composite"><img src="https://img.shields.io/npm/v/@actharness/composite?color=3fb950&label=npm" alt="npm"></a>
  <a href="https://github.com/actharness/actharness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-3fb950" alt="license"></a>
</div>

<br>

Composite executor for [actharness](https://github.com/theobassan/actharness). Handles `runs.using: composite` actions — the step loop, shell execution, `uses:` dispatch, env-file threading, and `continue-on-error` semantics.

Registers itself into `@actharness/core`'s executor registry on import. No public API — just import it.

## Usage

```ts
import '@actharness/composite'; // registers the executor
import { actharness } from '@actharness/core';

const action = actharness('./action.yml');
const result = await action.run({ inputs: { name: 'World' } });

console.log(result.conclusion);      // 'success' | 'failure'
console.log(result.steps[0]?.stdout); // captured stdout from run: steps
```

If you use the `actharness` meta package, this is already included.

## What it provides

- **Step loop** — evaluates `if:` conditions, runs steps in order, respects `continue-on-error`
- **Shell execution** — spawns `bash`, `sh`, `pwsh`, etc. via `ShellSandbox` with faithful wrappers and env scoping
- **`uses:` dispatch** — delegates to `@actharness/core`'s mock resolver (mock replay, local recursion, or remote noop)
- **Env-file threading** — reads `$GITHUB_OUTPUT`, `$GITHUB_ENV`, `$GITHUB_PATH` after each step and propagates forward
- **Action outputs** — evaluates `outputs.<name>.value` against the final `steps` context
