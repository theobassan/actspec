# @actharness/core

## 0.1.0

### Minor Changes

- Initial release of `@actharness/core`.

  The actharness runtime engine. Parses `action.yml`, builds the execution context, resolves mocks, dispatches to registered executors, and emits `RunResult`s. Every other actharness package (`@actharness/composite`, `@actharness/coverage`, `@actharness/matchers`) plugs into core without creating a reverse dependency.

  **Highlights:**
  - **Action parser** — reads and validates `action.yml` into a typed `ParsedAction` model
  - **Context builder** — constructs the full `${{ github.* }}`, `${{ runner.* }}`, `${{ inputs.* }}`, `${{ steps.* }}`, `${{ env.* }}` context from run inputs and defaults
  - **Protocol simulator** — allocates real temp files for `$GITHUB_OUTPUT`, `$GITHUB_ENV`, `$GITHUB_PATH`, `$GITHUB_STEP_SUMMARY`, and threads them between steps
  - **Mock resolver** — matches `uses:` refs against registered mocks; supports static output definitions, dynamic mock functions, and configurable cycle/depth guards
  - **Mock scope stack** — async-local-storage based scope management so mocks registered in `beforeEach` are isolated per test and cleaned up automatically
  - **Executor registry** — open extension point: register custom executors for `runs.using` types beyond composite
  - **Determinism** — runs are deterministic by default (frozen clock, seeded RNG, stable temp paths); override per-call via `determinism` option
  - **Run sink** — passive observer API so packages like `@actharness/coverage` can subscribe to completed runs without a reverse dependency on core
  - **Lifecycle functions** — scope-aware `describe`, `test`, `it`, `beforeEach`, `afterEach` wrappers exported for use as named imports or re-injection as globals

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @actharness/expressions@0.1.0
  - @actharness/types@0.1.0
