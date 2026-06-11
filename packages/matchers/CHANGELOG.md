# @actharness/matchers

## 0.1.0

### Minor Changes

- Initial release of `@actharness/matchers`.

  `expect()` and assertion handles for actharness — runs inside `actharness test` or any Node.js test runner.

  **`RunResult` matchers** — assert on the overall action run:

  ```ts
  expect(result).toHaveSucceeded()
  expect(result).toHaveFailed()
  expect(result).toHaveOutput(name, value)
  expect(result).toHaveStep(id)               // step ran (not skipped)
  expect(result).toHaveStepSucceeded(id)
  expect(result).toHaveStepFailed(id)
  expect(result).toHaveStepSkipped(id)
  expect(result).toHaveStepOutput(id, name, value)
  expect(result).toHaveAnnotation({ level?, message? })
  ```

  **`StepResult` matchers** — pass `result.step('id')` directly; throws a descriptive error if the step is absent:

  ```ts
  expect(result.step('build')).toHaveSucceeded()
  expect(result.step('build')).toHaveFailed()
  expect(result.step('build')).toHaveOutput(name, value)
  expect(result.step('build')).toHaveAnnotation({ level?, message? })
  expect(result.step('build')).toHaveStdoutContaining(substring)
  expect(result.step('build')).toHaveStderrContaining(substring)
  ```

  **`ActionMock` matchers** — assert on how a mocked `uses:` step was called:

  ```ts
  expect(checkout).toHaveBeenCalled();
  expect(checkout).toHaveBeenCalledTimes(2);
  expect(checkout).toHaveBeenCalledWith({ ref: 'main' });
  ```

  Every matcher supports `.not` negation. When running via `actharness test`, `expect` is available as a global — no import needed.

### Patch Changes

- Updated dependencies
  - @actharness/types@0.1.0
