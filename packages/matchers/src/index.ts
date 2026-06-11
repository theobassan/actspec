// @actharness/matchers — own expect() + RunResult/ActionMock matchers.
// No Jest/Vitest peer dependency.

export { expect } from './expect.js';
export type {
  AssertionHandle,
  RunResultAssertionHandle,
  StepResultAssertionHandle,
  MockAssertionHandle,
} from './expect.js';
export { MatchError, fail } from './errors.js';
