// Global type declarations for actharness test files.
// Add "actharness/globals" to compilerOptions.types in your tsconfig.json.

import type { RunResult, StepResult, ActionMock } from '@actharness/types';
import type { ActharnessFn } from 'actharness';
import type {
  RunResultAssertionHandle,
  StepResultAssertionHandle,
  MockAssertionHandle,
} from '@actharness/matchers';

declare global {
  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function test(name: string, fn: () => void | Promise<void>): void;
  function before(fn: () => void | Promise<void>): void;
  function after(fn: () => void | Promise<void>): void;
  function beforeEach(fn: () => void | Promise<void>): void;
  function afterEach(fn: () => void | Promise<void>): void;
  function beforeAll(fn: () => void | Promise<void>): void;
  function afterAll(fn: () => void | Promise<void>): void;

  const actharness: ActharnessFn;

  function expect(value: RunResult): RunResultAssertionHandle;
  function expect(value: StepResult | undefined): StepResultAssertionHandle;
  function expect(value: ActionMock): MockAssertionHandle;
}

export {};
