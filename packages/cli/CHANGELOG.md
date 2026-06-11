# @actharness/cli

## 0.1.0

### Minor Changes

- Initial release of `@actharness/cli`.

  The actharness command-line interface. Discovers and runs action test files, executes actions one-shot from the terminal, and scaffolds new test files — with full Istanbul coverage support built in.

  **Commands:**

  `actharness test` — discovers `**/*.{actharness,test}.ts` files and runs them. Injects `actharness`, `expect`, and all lifecycle functions (`describe`, `test`, `it`, `beforeEach`, `afterEach`, etc.) as globals so no imports are needed in test files.

  ```bash
  actharness test
  actharness test src/actions/**/*.actharness.ts
  actharness test --coverage
  actharness test --coverage --reporter lcov,html --threshold steps=100 --threshold ifBranches=80
  ```

  `actharness run` — one-shot execution of an action from the command line, useful for smoke-testing or integration scripts:

  ```bash
  actharness run ./action.yml --input name=World
  actharness run ./action.yml --json   # machine-readable RunResult output
  actharness run ./action.yml --mock "actions/checkout@v4={}"
  ```

  `actharness init` — scaffolds a test file next to an existing `action.yml`:

  ```bash
  actharness init ./action.yml   # creates action.test.ts
  ```

  **Config file:**

  Create `actharness.config.ts` (or `.js` / `.json`) in the project root to set persistent defaults. CLI flags always override config values.

  ```ts
  export default {
    coverage: true,
    reporters: ['lcov', 'html', 'text'],
    thresholds: { steps: 100, ifBranches: 80 },
    patterns: ['**/*.test.ts'],
  };
  ```

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @actharness/composite@0.1.0
  - @actharness/core@0.1.0
  - @actharness/coverage@0.1.0
  - @actharness/matchers@0.1.0
  - @actharness/types@0.1.0
