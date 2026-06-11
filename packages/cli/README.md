<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1><code>@actharness/cli</code></h1>
  <p>CLI for actharness — <code>actharness test</code>, <code>actharness run</code>, <code>actharness init</code>.</p>
  <a href="https://www.npmjs.com/package/@actharness/cli"><img src="https://img.shields.io/npm/v/@actharness/cli?color=3fb950&label=npm" alt="npm"></a>
  <a href="https://github.com/actharness/actharness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-3fb950" alt="license"></a>
</div>

<br>

CLI for [actharness](https://github.com/theobassan/actharness) — the GitHub Actions unit testing framework.

## Install

```bash
npm install --save-dev actharness
```

## Commands

### `actharness test`

Run action test files (`.actharness.ts` or `.test.ts`):

```bash
actharness test                                    # finds **/*.{actharness,test}.ts
actharness test src/actions/**/*.actharness.ts        # explicit pattern
actharness test --coverage                         # Istanbul-compatible coverage
actharness test --coverage --reporter lcov,html    # reporter selection
actharness test --threshold steps=100 --threshold ifBranches=80
```

Test files get `actharness`, `expect`, `describe`, `it`, `test`, `before`, `after`, `beforeEach`, `afterEach` injected as globals — no imports needed.

### `actharness run`

One-shot execution of an action from the command line:

```bash
actharness run ./action.yml
actharness run ./action.yml --input name=World --input env=prod
actharness run ./action.yml --json                    # machine-readable RunResult
actharness run ./action.yml --mock "actions/checkout@v4={}"
```

### `actharness init`

Scaffold a test file for an existing action:

```bash
actharness init ./action.yml    # creates action.test.ts next to action.yml
```

## Coverage thresholds

```bash
actharness test --coverage --threshold steps=100 --threshold ifBranches=80
```

Exits non-zero if any threshold is not met.

## Config file

Create `actharness.config.ts` (or `.js` / `.json`) in your project root to set defaults. CLI flags always override config.

```ts
// actharness.config.ts
export default {
  coverage: true,
  reporters: ['lcov', 'html', 'text'],
  coverageDir: 'coverage',
  thresholds: { steps: 100, ifBranches: 80 },
  patterns: ['**/*.test.ts'],
};
```
