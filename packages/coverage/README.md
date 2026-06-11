<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1><code>@actharness/coverage</code></h1>
  <p>Istanbul-compatible step and branch coverage for actharness.</p>
  <a href="https://www.npmjs.com/package/@actharness/coverage"><img src="https://img.shields.io/npm/v/@actharness/coverage?color=3fb950&label=npm" alt="npm"></a>
  <a href="https://github.com/actharness/actharness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-3fb950" alt="license"></a>
</div>

<br>

Passive, suite-level coverage for `action.yml` files in [actharness](https://github.com/theobassan/actharness). Observes every `run()` and aggregates across the suite — zero change to how tests are written.

Built as an Istanbul-compatible coverage map, so the full Istanbul reporter set works and `coverage-final.json` is mergeable with other coverage via `nyc merge`.

## Usage with `actharness test`

```bash
actharness test --coverage
actharness test --coverage --reporter lcov,html,text --threshold ifBranches=80
```

## Programmatic setup

```ts
import { actharnessCoverage, getCoverage } from '@actharness/coverage';

actharnessCoverage({
  include: ['action.yml', 'actions/*/action.yml'],
  exclude: ['actions/third-party/**'],
  thresholds: { steps: 100, ifBranches: 80 },
});
```

`actharnessCoverage()` is idempotent — safe to call multiple times.

## Coverage metrics

| Metric | What it measures |
|---|---|
| `steps` | Steps executed vs skipped |
| `ifBranches` | Each `if:` condition seen both `true` AND `false` |
| `inputs` | Declared inputs and defaults exercised |

## `if:` branch truth table

```ts
const report = getCoverage();

report.files['./action.yml'].ifBranchTable;
// [{ step: 'deploy', expression: 'github.ref == "refs/heads/main"', sawTrue: true, sawFalse: false }]
// → you never tested the skip path for 'deploy'
```

## Include / exclude

Files matching `include` that were never run appear in the report at 0% — making untested action files visible. Files matching `exclude` are removed from the report entirely.

## Reporters

Default: `['lcov', 'html', 'text']`. Full Istanbul set supported: `text`, `text-summary`, `html`, `html-spa`, `lcov`, `lcovonly`, `cobertura`, `clover`, `teamcity`, `json`, `json-summary`, `none`.
