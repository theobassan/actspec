<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1><code>@actharness/types</code></h1>
  <p>Shared TypeScript interfaces for actharness. Zero dependencies.</p>
  <a href="https://www.npmjs.com/package/@actharness/types"><img src="https://img.shields.io/npm/v/@actharness/types?color=3fb950&label=npm" alt="npm"></a>
  <a href="https://github.com/actharness/actharness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-3fb950" alt="license"></a>
</div>

<br>

Zero-dependency DAG root for [actharness](https://github.com/theobassan/actharness) — the GitHub Actions unit testing framework.

Contains all public TypeScript interfaces and the `GITHUB_DEFAULTS` / `RUNNER_DEFAULTS` constants that are the single source of truth for context defaults across the actharness package ecosystem.

## Usage

```ts
import type { RunResult, StepResult, GitHubContext } from '@actharness/types';
import { GITHUB_DEFAULTS, RUNNER_DEFAULTS } from '@actharness/types';

// Override just the fields you care about:
const github: GitHubContext = { ...GITHUB_DEFAULTS, repository: 'my-org/my-action' };
```

## Contents

- All public interfaces: `RunResult`, `StepResult`, `Annotation`, `ExpressionTrace`
- `RunInput`, `ActharnessOptions`, `Determinism`
- `GitHubContext`, `RunnerContext`
- `ActionMock`, `ActionMockDef`, `ActionMockCall`
- `ShellMock`, `ShellCommandImpl`, `ShellMockResult`
- `ParsedAction` (the manifest model)
- `GITHUB_DEFAULTS` — default `github` context values
- `RUNNER_DEFAULTS` — default `runner` context values
