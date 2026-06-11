# actharness

## 0.1.0

### Minor Changes

- Initial release of actharness — unit testing for GitHub Actions.

  Test composite actions locally, hermetically, with no real GitHub runner and no network. Mock external `uses:` calls, simulate the runner protocol (`$GITHUB_OUTPUT`, `$GITHUB_ENV`, `$GITHUB_PATH`), evaluate `${{ }}` expressions, and assert on step results — all behind one unified API.

  Install this single package to get everything:

  ```bash
  npm install --save-dev actharness
  ```

  **What's included:**
  - `actharness(source, options?)` — create and run an action under test
  - `actharness.mock(ref, def?)` — mock any `uses:` step by ref before running
  - `actharness.resetMocks()` — clear all registered mocks
  - `expect()` — assertion handle for `RunResult`, `StepResult`, and `ActionMock`
  - Lifecycle functions (`describe`, `test`, `it`, `before`, `after`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`) — available as both named exports and globals injected by the test runner
  - Fixture helpers (`github()`, `runner()`, `pushEvent()`, `pullRequestEvent()`, etc.) — available as named exports only

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @actharness/cli@0.1.0
  - @actharness/composite@0.1.0
  - @actharness/core@0.1.0
  - @actharness/fixtures@0.1.0
  - @actharness/matchers@0.1.0
  - @actharness/types@0.1.0
