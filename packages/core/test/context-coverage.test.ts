import { describe, it, expect, vi } from 'vitest';
import { GITHUB_DEFAULTS, RUNNER_DEFAULTS } from '@actharness/types';

// Intercept evaluateTemplate to throw a plain Error on the first two calls,
// so the defensive catch-and-rewrap path in context.ts:evalTemplate is covered
// (once without filePath, once with filePath to cover both ternary branches).
vi.mock('@actharness/expressions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@actharness/expressions')>();
  return {
    ...original,
    evaluateTemplate: vi.fn()
      .mockImplementationOnce(() => { throw new Error('plain error without filePath'); })
      .mockImplementationOnce(() => { throw new Error('plain error with filePath'); })
      .mockImplementation(original.evaluateTemplate),
  };
});

import { createContextStore, evalTemplate } from '../src/context.js';
import { createJobStatus } from '../src/determinism.js';
import { ExpressionError } from '../src/errors.js';

function makeStore() {
  return createContextStore({
    github: { ...GITHUB_DEFAULTS, workspace: '/ws' },
    runner: { ...RUNNER_DEFAULTS },
    inputs: {},
    env: {},
    secrets: {},
    matrix: {},
    needs: {},
    jobStatus: createJobStatus(),
  });
}

describe('evalTemplate — defensive non-ExpressionError catch', () => {
  it('wraps plain Error (no filePath) in ExpressionError', () => {
    const store = makeStore();
    // First mock call: no filePath → ternary takes undefined branch
    expect(() => evalTemplate('${{ env.X }}', store)).toThrow(ExpressionError);
  });

  it('wraps plain Error (with filePath) in ExpressionError with location', () => {
    const store = makeStore();
    // Second mock call: with filePath → ternary takes truthy branch
    expect(() => evalTemplate('${{ env.X }}', store, '/fake/action.yml')).toThrow(ExpressionError);
  });

  it('subsequent calls work normally', () => {
    const store = makeStore();
    // After both once-mocks are consumed, original implementation runs
    expect(evalTemplate('hello world', store)).toBe('hello world');
  });

  it('real evaluateTemplate error is wrapped in ExpressionError', () => {
    const store = makeStore();
    // 4th call uses original.evaluateTemplate — unclosed paren throws expressions' ExpressionError
    // which gets wrapped in core's ExpressionError
    expect(() => evalTemplate('${{ ( }}', store)).toThrow(ExpressionError);
  });
});
