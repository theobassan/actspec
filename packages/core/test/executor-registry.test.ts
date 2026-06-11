import { describe, it, expect } from 'vitest';
import type { ActionExecutor, ExecutionCall, ExecutionResult } from '../src/executor-registry.js';
import { registerExecutor, getExecutor } from '../src/executor-registry.js';

// We need to reset the registry between tests. Since the registry is module-level,
// we poke at internals via re-import isolation by capturing the state around each test.

// A minimal fake executor factory
function makeFakeExecutor(using: string, result: ExecutionResult): ActionExecutor {
  return {
    handles: (u) => u === using,
    execute: async (_call: ExecutionCall) => result,
  };
}

describe('registerExecutor / getExecutor', () => {
  it('returns undefined for unregistered using', () => {
    // Note: other tests may have registered executors; we test a unique name
    expect(getExecutor('__unknown_executor_xyz__')).toBeUndefined();
  });

  it('dispatches to a registered executor', () => {
    const fakeResult: ExecutionResult = {
      conclusion: 'success',
      outputs: { out: 'val' },
      env: {},
    };
    registerExecutor(makeFakeExecutor('__test_executor__', fakeResult));

    const found = getExecutor('__test_executor__');
    expect(found).toBeDefined();
    expect(found?.handles('__test_executor__')).toBe(true);
    expect(found?.handles('__other__')).toBe(false);
  });

  it('returns the first matching executor', () => {
    const first = makeFakeExecutor('__multi__', {
      conclusion: 'success',
      outputs: { from: 'first' },
      env: {},
    });
    const second = makeFakeExecutor('__multi__', {
      conclusion: 'success',
      outputs: { from: 'second' },
      env: {},
    });

    registerExecutor(first);
    registerExecutor(second);

    // getExecutor returns the first one that matches
    const found = getExecutor('__multi__');
    expect(found).toBe(first);
  });

  it('registered executor.execute returns expected result', async () => {
    const fakeResult: ExecutionResult = {
      conclusion: 'failure',
      outputs: {},
      env: { X: '1' },
    };
    registerExecutor(makeFakeExecutor('__exec_test__', fakeResult));

    const executor = getExecutor('__exec_test__');
    expect(executor).toBeDefined();

    const result = await executor!.execute({} as ExecutionCall);
    expect(result.conclusion).toBe('failure');
    expect(result.env['X']).toBe('1');
  });
});
