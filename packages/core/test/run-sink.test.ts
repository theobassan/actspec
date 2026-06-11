import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunResult } from '@actharness/types';
import { registerRunListener, notifyRunSink } from '../src/run-sink.js';

const SINK_KEY = Symbol.for('actharness.runSink');

function resetSink(): void {
  delete (globalThis as Record<symbol, unknown>)[SINK_KEY];
}

function makeResult(): RunResult {
  return {
    conclusion: 'success',
    outputs: {},
    steps: [],
    step: () => undefined,
    env: {},
    annotations: [],
    stdout: '',
    stderr: '',
  };
}

describe('notifyRunSink', () => {
  beforeEach(resetSink);

  it('does nothing when no listeners are registered', () => {
    expect(() => notifyRunSink(makeResult(), { sourceFile: undefined, actionDir: undefined })).not.toThrow();
  });

  it('calls a registered listener with result and meta', () => {
    const listener = vi.fn();
    registerRunListener(listener);
    const result = makeResult();
    const meta = { sourceFile: 'action.yml', actionDir: '/fake' };
    notifyRunSink(result, meta);
    expect(listener).toHaveBeenCalledWith(result, meta);
  });

  it('calls all registered listeners', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    registerRunListener(l1);
    registerRunListener(l2);
    notifyRunSink(makeResult(), { sourceFile: undefined, actionDir: undefined });
    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
  });
});

describe('registerRunListener', () => {
  beforeEach(resetSink);

  it('creates the sink array when it does not exist', () => {
    expect((globalThis as Record<symbol, unknown>)[SINK_KEY]).toBeUndefined();
    registerRunListener(vi.fn());
    expect(Array.isArray((globalThis as Record<symbol, unknown>)[SINK_KEY])).toBe(true);
  });

  it('appends to existing sink array', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    registerRunListener(l1);
    registerRunListener(l2);
    expect(((globalThis as Record<symbol, unknown>)[SINK_KEY] as unknown[]).length).toBe(2);
  });
});
