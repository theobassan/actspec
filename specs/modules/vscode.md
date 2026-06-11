# `@actharness/vscode`

VSCode extension that wires actharness into the native **Test Explorer** UI. Authors run and debug individual tests from the editor gutter and sidebar — the same execution path as `actharness test`, zero extra config.

## Owns (public surface)

A single VSCode extension (`actharness.actharness-vscode`) that:
- Populates the Test Explorer sidebar with every `describe`/`it`/`test` block found in `**/*.{actharness,test}.ts` files.
- Runs any selection (workspace · file · suite · single test) and reports pass/fail/error inline.
- Streams test output to the Test Results panel.
- Reads `actharness.config.ts` / `.json` for patterns and coverage defaults — no extra VSCode settings required.

The extension has **no public TypeScript API**. Its contract is the VSCode Testing API surface it implements.

## Depends on

- **`vscode`** (peer, extension host API) — `TestController`, `TestItem`, `TestRun`, `FileSystemWatcher`.
- **`@actharness/cli`** — re-uses `runTests()`, `parseTestArgs()`, `loadConfig()`, `defaultRegisterUrl()` by calling a **runner bridge** subprocess (see below); the extension never imports CLI code directly (different module context).
- **`tsx`** (runtime dep) — bridge subprocess needs tsx for `.ts` test files.
- **TypeScript compiler API** (`typescript` pkg) — static AST parse for test discovery.

## Architecture

```
┌─ Extension Host (VSCode) ───────────────────────────────────────────────────┐
│                                                                              │
│  extension.ts        discover.ts            runner.ts                       │
│  ─────────────       ─────────────          ─────────────────               │
│  activate()    ───▶  discoverFiles()  ───▶  spawnBridge(files, filter?)     │
│  TestController       parseAST()             │                              │
│  RunProfile           TestItem tree          │  JSON-lines (stdout)         │
│                                              ▼                              │
│                                         result-parser.ts                    │
│                                         ──────────────────                  │
│                                         node:test event → TestRun calls     │
└─────────────────────────────────────────────────────────────────────────────┘
                                              │
                       spawn (child_process)  │
                                              ▼
┌─ Runner Bridge (Node.js subprocess) ──────────────────────────────────────┐
│  runner-bridge.ts                                                          │
│  ─────────────────                                                         │
│  node --import tsx/esm --import register.js runner-bridge.ts               │
│    calls run() from node:test                                              │
│    for each event: process.stdout.write(JSON.stringify(event) + '\n')      │
│    register.js injects actharness + expect globals (same as CLI)              │
└────────────────────────────────────────────────────────────────────────────┘
```

Key design decision: the extension host and the test subprocess live in different Node.js contexts. The extension must **spawn a child process** for test execution — it cannot `import` node:test directly. The runner bridge is the only new file needed in `@actharness/cli`; everything else in the bridge already exists.

---

## Package layout

```
packages/vscode/
├── package.json          — extension manifest (see below)
├── tsconfig.json
├── tsup.config.ts        — bundles src/ → dist/extension.js (CJS, externals: vscode)
├── src/
│   ├── extension.ts      — activate / deactivate
│   ├── discover.ts       — AST-based TestItem tree builder
│   ├── runner.ts         — subprocess spawn + lifecycle
│   ├── result-parser.ts  — JSON-line event → TestRun API
│   └── watcher.ts        — FileSystemWatcher → re-discover on change
└── test/
    ├── discover.test.ts
    └── result-parser.test.ts
```

The runner bridge lives in `@actharness/cli` to share the register URL and tsx ESM URL resolution:

```
packages/cli/src/runner-bridge.ts   — new file (see Runner Bridge section)
```

---

## `package.json` (extension manifest — key fields)

```jsonc
{
  "name": "actharness-vscode",
  "displayName": "actharness",
  "description": "GitHub Actions unit testing — run actharness tests from the Test Explorer",
  "publisher": "actharness",
  "version": "0.1.0",
  "engines": { "vscode": "^1.88.0" },
  "categories": ["Testing"],
  "activationEvents": [
    "workspaceContains:**/*.actharness.ts",
    "workspaceContains:**/*.test.ts"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "configuration": {
      "title": "actharness",
      "properties": {
        "actharness.nodeExecutable": {
          "type": "string",
          "default": "node",
          "description": "Path to the Node.js executable. Useful when using mise/nvm."
        }
      }
    }
  },
  "dependencies": {
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.88.0"
  }
}
```

The extension bundles the TypeScript compiler for AST parsing. All other actharness packages are resolved at runtime from the **workspace's** `node_modules` — the extension never bundles them, so it always uses the version the project installed.

---

## Component: `extension.ts` — activation

```ts
export function activate(context: vscode.ExtensionContext): void {
  const ctrl = vscode.tests.createTestController('actharness', 'actharness');
  context.subscriptions.push(ctrl);

  // Run profiles
  ctrl.createRunProfile('Run', vscode.TestRunProfileKind.Run, runHandler, true);

  // Initial discovery
  discoverWorkspace(ctrl);

  // File watcher
  const watcher = createWatcher(ctrl);
  context.subscriptions.push(watcher);
}
```

**Behavior (MUST):**
- Activation is lazy — fires only when the workspace contains `*.actharness.ts` or `*.test.ts`.
- On first activation: discover all test files matching patterns from `actharness.config.ts` (default `**/*.{actharness,test}.ts`), excluding `node_modules`.
- `TestController.resolveHandler` is wired to parse a specific file on demand (when user expands a collapsed file node in the sidebar).

---

## Component: `discover.ts` — AST-based test tree

Parses each test file using TypeScript's `ts.createSourceFile` API (no type-checking — syntax only, fast). Extracts `describe`/`it`/`test` call expressions and builds a `TestItem` tree with source positions.

### What gets discovered

| Call shape | Meaning |
|---|---|
| `describe('name', fn)` | Suite (can be nested) |
| `it('name', fn)` | Test case |
| `test('name', fn)` | Test case |
| `describe.skip` / `it.skip` / `test.skip` | Discovered but marked skipped |

Dynamic tests (`['a','b'].forEach(name => test(name, ...))`) are **not** discovered statically — they appear as a single unresolved entry at file level and are filled in at runtime when the file is run.

### TestItem hierarchy

```
TestItem (file)                            /path/to/greet.test.ts
  TestItem (suite)                         "greet action"         line 1
    TestItem (test)                        "succeeds"             line 3
    TestItem (test)                        "mocks checkout"       line 9
  TestItem (test)                          "standalone test"      line 18
```

Each `TestItem` carries:
- `id` — `${fileUri}::${fullyQualifiedName}` (e.g. `file:///…/greet.test.ts::greet action > succeeds`)
- `uri` — file URI
- `range` — `vscode.Range` from the AST node's `pos`/`end` mapped to line/col

### Interface

```ts
export function discoverFile(
  ctrl: vscode.TestController,
  uri: vscode.Uri,
): Promise<void>;

export function discoverWorkspace(
  ctrl: vscode.TestController,
): Promise<void>;
```

---

## Component: `runner-bridge.ts` (in `@actharness/cli`)

A thin script that accepts file paths + an optional name-pattern filter via CLI args, runs `node:test`'s `run()` API, and streams every event as a JSON line to stdout. The extension spawns it as a subprocess.

```ts
// packages/cli/src/runner-bridge.ts
// Usage: node --import tsx/esm --import register.js runner-bridge.js
//   [--files a.ts,b.ts] [--pattern "regex"] [--register-url <url>] [--tsx-esm-url <url>]

import { run } from 'node:test';
import { parseRunnerBridgeArgs } from './runner-bridge-args.js';

const { files, pattern, registerUrl, tsxEsmUrl } = parseRunnerBridgeArgs(process.argv.slice(2));
const execArgv = ['--import', tsxEsmUrl, '--import', registerUrl];
const stream = run({ files, execArgv, ...(pattern ? { testNamePatterns: [pattern] } : {}) });

for await (const event of stream) {
  process.stdout.write(JSON.stringify(event) + '\n');
}
```

**Why a separate bridge instead of reusing `runTests()`?**
`runTests()` writes to `console.log` and aggregates results. The bridge must emit raw events as JSON so the extension can map each event to a specific `TestItem`. The bridge is ~20 lines; its test infra already exists via `@actharness/cli`'s test suite.

**Node executable resolution:** the bridge is spawned using the same node binary that is running VSCode's extension host. If the user has a different Node version active (mise/nvm), they set `actharness.nodeExecutable` in VSCode settings.

---

## Component: `runner.ts` — subprocess spawn

```ts
export async function runTests(
  run: vscode.TestRun,
  items: vscode.TestItem[],
  filter?: string,       // node:test --testNamePatterns regex
): Promise<void>
```

**Behavior (MUST):**
1. Group `items` by file. For each file, enqueue its test items as `run.started(item)`.
2. Locate `runner-bridge.js` via the workspace's `node_modules/@actharness/cli/dist/runner-bridge.js`.
3. Locate `register.js` the same way (already done by `defaultRegisterUrl()` in CLI).
4. Spawn: `node --import tsx/esm --import register.js runner-bridge.js --files <paths> [--pattern <regex>]`.
5. Pipe stdout through `result-parser.ts`, updating `run` for each event.
6. On process exit: mark any items still in `started` state as `run.errored(item, ...)`.
7. If the workspace has `actharness.config.ts`, pass `--coverage-dir` etc. from config (coverage reporting is deferred — see below).

**Cancellation:** `vscode.TestRun` has a `token: CancellationToken`. On cancel, `kill('SIGTERM')` the subprocess; mark in-flight items as skipped.

---

## Component: `result-parser.ts` — event → TestRun

Reads JSON lines from the bridge subprocess stdout and calls `TestRun` methods.

### Event mapping

| node:test event | TestRun call |
|---|---|
| `test:start` (nesting 0) | `run.started(item)` |
| `test:pass` (nesting 0) | `run.passed(item, data.details.duration_ms)` |
| `test:fail` (nesting 0) | `run.failed(item, buildMessage(data), data.details.duration_ms)` |
| `test:skip` (nesting 0) | `run.skipped(item)` |
| `test:stdout` | `run.appendOutput(line)` |
| `test:stderr` | `run.appendOutput(line)` |

**Matching events to `TestItem`s:** node:test reports test names as strings. The parser resolves the `TestItem` by matching `event.data.name` against the item's full title. When `nesting > 0`, the item is a child suite/test; use the nesting path to locate the right `TestItem` in the tree.

**Error messages:** for `test:fail`, build a `vscode.TestMessage` from `data.details.error.message`. Extract `file:line:col` from the stack trace to set `TestMessage.location` so VSCode shows the failure inline at the right source position.

```ts
function buildMessage(data: FailData): vscode.TestMessage {
  const msg = new vscode.TestMessage(data.details.error?.message ?? String(data.details.error));
  const loc = parseStackLocation(data.details.error?.stack ?? '');
  if (loc) msg.location = new vscode.Location(vscode.Uri.file(loc.file), new vscode.Position(loc.line - 1, 0));
  return msg;
}
```

---

## Component: `watcher.ts` — file system watcher

```ts
export function createWatcher(ctrl: vscode.TestController): vscode.Disposable
```

- Creates a `vscode.workspace.createFileSystemWatcher('**/*.{actharness,test}.ts')`.
- On `create`: call `discoverFile(ctrl, uri)`.
- On `change`: re-parse the file and update/replace its `TestItem` subtree.
- On `delete`: `ctrl.items.delete(uri.toString())`.
- Patterns are re-read from `actharness.config.ts` whenever the config file changes.

---

## Run profiles

| Profile | Kind | Behavior |
|---|---|---|
| **Run** | `Run` | Spawn bridge with matched files; no pattern filter = run all tests in those files |
| **Run (filtered)** | `Run` | When a single `it`/`test` item is selected, add `--pattern` regex matching its full title |

**Debug profile** — deferred (post-v0.1). Would attach the VS Code debugger to the bridge subprocess.

**Coverage profile** — deferred (post-v0.1). actharness already emits Istanbul reports; surfacing them in VSCode's inline coverage view requires `FileCoverageDetail` which depends on the per-file map — doable but separate.

### Test name filter

Node 22's `testNamePatterns` option in `run()` accepts regexes. The extension builds the pattern from the selected item's full title path:

```
"greet action > succeeds"  →  /^greet action > succeeds$/
```

Running a `describe` suite passes the suite name as a prefix-match pattern so all children run:

```
"greet action"  →  /^greet action/
```

---

## Configuration

The extension reads `actharness.config.ts` / `.json` from the workspace root via the same `loadConfig()` in `@actharness/cli`. It uses:
- `patterns` — to scope the initial file discovery glob (falls back to `**/*.{actharness,test}.ts`).
- `coverageDir` — noted for future coverage profile.

No VSCode-specific config keys are required beyond `actharness.nodeExecutable`.

---

## Error states

| Situation | Behavior |
|---|---|
| `actharness` not installed in workspace | Show inline warning: "actharness not found in node_modules. Run `npm install --save-dev actharness`." — do not throw. |
| Bridge subprocess crashes (non-zero exit, no events) | Mark all started items as `errored` with the full stderr. |
| Test file has a parse/import error at startup | `test:fail` at nesting 0 with the module load error; map to file-level TestItem. |
| Cancellation mid-run | SIGTERM the subprocess; mark remaining started items as skipped. |

---

## Acceptance

- Opening a workspace with `*.actharness.ts`/`*.test.ts` files: Test Explorer shows the full suite tree within 2 seconds of activation.
- Clicking ▷ on a file: spawns bridge for that file, marks each test pass/fail/error in the UI, streams output to the Test Results panel.
- Clicking ▷ on a single `it`/`test` item: only that test runs (bridge receives `--pattern`); other items in the file are not touched.
- Clicking ▷ on a `describe` suite: all children of that suite run.
- A failing test: inline red decoration on the failing line, `TestMessage` shows the matcher error message, clicking it opens the file at the right line.
- Editing a test file: the Test Explorer tree updates within 1 second (file watcher re-parses).
- Deleting a test file: its entries disappear from the tree.
- `actharness.config.ts` with custom `patterns`: only files matching those patterns appear in the tree.
- Running all tests via "Run All Tests" in the sidebar: equivalent to `actharness test` — same pass/fail totals.

## Done-when

Extension activates in a project with actharness installed; Test Explorer shows discovered tests; run/fail/pass works per-test and per-file; file watcher keeps the tree fresh; per [CONVENTIONS DoD](../../docs/CONVENTIONS.md#definition-of-done-every-module).

## Deferred (post-v0.1)

- **Debug profile** — attach debugger to bridge subprocess.
- **Coverage profile** — surface Istanbul per-line coverage as inline VSCode decorations.
- **`mise`/`nvm` auto-detection** — detect the active Node version automatically instead of requiring `actharness.nodeExecutable`.
- **Multi-root workspaces** — multiple `actharness.config.ts` files in one VSCode window.
