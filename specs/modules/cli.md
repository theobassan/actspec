# `@actharness/cli`

Two commands: `actharness test` — the purpose-built test runner for GitHub Actions; `actharness run` — execute one action outside a test for local iteration.

## Owns (public surface)
The CLI ([API.md §14](../../docs/API.md)):
- `actharness test [pattern] [--coverage] [--reporter name] [--threshold k=n]…`
- `actharness run <action.yml> [--input k=v]… [--mock ref='json'] [--mock-file f] [--setup f.ts] [--event name] [--json]`
- `actharness init <action.yml>` — scaffold `action.test.ts`.
- `actharness types …` is **deferred** (depends on `@actharness/types`, post-v0.1) — reserve the subcommand.

## Depends on
`@actharness/core` + `@actharness/composite` (v0.1) + `@actharness/matchers` + `@actharness/coverage`.

---

## `actharness test`

The primary way to test actions. A purpose-built runner on top of Node's built-in `node:test` — no test-framework dependency.

### What it provides in every test file (globals)

`actharness test` injects these into `globalThis` before running each test file, so test files need zero imports:

```ts
describe, it, test, before, after, beforeEach, afterEach  // from node:test
actharness                                                    // from @actharness/core
expect                                                     // from @actharness/matchers
```

TypeScript types for all globals are declared in `@actharness/matchers/globals.d.ts`. Users add `"types": ["@actharness/matchers/globals"]` to their `tsconfig.json` once.

### Test file format

```ts
describe('greet action', () => {
  it('succeeds with valid inputs', async () => {
    const result = await actharness('./action.yml').run({ inputs: { name: 'World' } });
    expect(result).toHaveSucceeded();
    expect(result).toHaveOutput('greeting', 'Hello World');
  });

  it('mocks a dependency', async () => {
    actharness.mock('actions/checkout@v4', { outputs: { ref: 'abc123' } });
    const result = await actharness('./action.yml').run({});
    expect(result).toHaveSucceeded();
  });
});
```

No `import` statements. `actharness.mock()` is the mock concept — all mocking goes through the global `actharness` surface.

### Coverage (`--coverage`)

`actharness test --coverage` runs the suite and emits an Istanbul coverage report. Coverage is built into the CLI — no `setupFiles`, no `globalTeardown`, no runner-level config needed. The CLI manages the full lifecycle: per-file fragment collection, parallel-safe merge, reporter emission, threshold enforcement.

Options (also settable in `actharness.config.ts`):
- `--reporter text|html|lcov|json|cobertura` (default: `lcov,html,text`)
- `--coverage-dir <path>` (default: `./coverage`)
- `--threshold ifBranches=80` (fail if below; multiple allowed)

### File discovery

Default pattern: `**/*.actharness.ts` and `**/*.test.ts` (excludes `node_modules`). Override: `actharness test 'src/**/*.actharness.ts'`.

### Parallelism

Each test file runs in its own worker (via `node:test`'s built-in parallel mode). Coverage fragments are collected per-worker and merged after all workers complete — the same disk-first pattern proven in the coverage spike.

---

## `actharness run`

Execute one action outside a test, over the **same runtime** so behavior matches the in-test path exactly. Runs and prints; it does **not** assert.

### Behavior (MUST)
- **No second mock DSL** — `--mock`/`--mock-file` are conveniences; `--setup ./mocks.ts` loads a module that calls the *same* `mock()`/`mockGitHubApi()` API (so a test and the CLI share one `setup(action)`). See [API.md §14 mocking model](../../docs/API.md).
- `--mock-file` is declarative YAML (`uses:`/`github-api:`/`shell:` blocks); `--setup` is code.
- Flags map 1:1 to `ActharnessOptions`; what the CLI does, a test does.
- Output: human summary by default; `--json` prints the `RunResult` (serialized, secrets masked).
- Exit code: non-zero iff the action's `conclusion` is `failure`.
- **Deferred (post-v0.1):** `--record`/replay — reserve the flag, error politely if used.

---

## `actharness init`

Scaffolds `action.test.ts` for the given `action.yml`. The generated file is a runnable starting point using actharness's globals — no imports, no boilerplate.

---

## Acceptance
- `actharness test fixtures/greet/greet.test.ts` discovers and runs the file; pass/fail output shows step-level results.
- `actharness test --coverage` emits `coverage/index.html` and `coverage/coverage-final.json`; threshold flag fails the suite if unmet.
- `actharness run fixtures/greet/action.yml --input name=World --json` prints `outputs.greeting == "Hello World"` and exits 0 — **identical result to the in-test walking skeleton**.
- `--mock actions/checkout@v4='{"outputs":{"ref":"abc"}}'` and the equivalent `--mock-file` produce the same run.
- `actharness init` writes a runnable `action.test.ts` with no imports.

## Done-when
`test` (discovery + globals + parallel + coverage) + `run` + `init` work over the shared runtime; per [CONVENTIONS DoD](../../docs/CONVENTIONS.md#definition-of-done-every-module).
