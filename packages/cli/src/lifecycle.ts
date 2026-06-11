import {
  describe as nodeDescribe,
  it as nodeIt,
  test as nodeTest,
  before,
  after,
  beforeEach as nodeBeforeEach,
  afterEach as nodeAfterEach,
} from 'node:test';
import { currentStack, runInDescribeScope, runInTestScope, scopeALS } from '@actharness/core';

type TestFn = () => void | Promise<void>;
type DescribeFn = () => void;

export function describe(name: string, fn: DescribeFn): void {
  // Capture the current scope stack at describe-registration time (synchronous).
  const parentStack = currentStack();
  nodeDescribe(name, () => {
    runInDescribeScope(parentStack, fn);
  });
}

export function it(name: string, fn: TestFn): void {
  // Capture scope at it()-registration time (inside describe body, synchronous).
  const describeStack = currentStack();
  nodeIt(name, async () => {
    await runInTestScope(describeStack, fn);
  });
}

export function test(name: string, fn: TestFn): void {
  const describeStack = currentStack();
  nodeTest(name, async () => {
    await runInTestScope(describeStack, fn);
  });
}

export function beforeEach(fn: TestFn): void {
  // Run in the describe scope — NOT a new test scope — so mocks registered here
  // are written into the describe-level ScopeRegistry and remain visible when
  // the test body runs (which adds a test scope on top of the same describe scope).
  const capturedStack = currentStack();
  nodeBeforeEach(async () => {
    await scopeALS.run(capturedStack, () => Promise.resolve(fn()));
  });
}

export function afterEach(fn: TestFn): void {
  const capturedStack = currentStack();
  nodeAfterEach(async () => {
    await scopeALS.run(capturedStack, () => Promise.resolve(fn()));
  });
}

export { before, after };
export const beforeAll = before;
export const afterAll = after;
