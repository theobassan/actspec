// Tests for register.ts — covers module-level side effects and the exit handler.
// Uses vi.resetModules() + dynamic import to reload the module per test so both
// branches of (ACTHARNESS_COVERAGE_DIR ?? '.actharness-coverage') are exercised.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@actharness/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@actharness/core')>();
  return { ...actual, registerRunListener: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  delete process.env['ACTHARNESS_COVERAGE_DIR'];
});

describe('register module', () => {
  it('registers a run listener and exports a CoverageCollector (default dir)', async () => {
    delete process.env['ACTHARNESS_COVERAGE_DIR'];
    const { collector } = await import('../src/register.js');
    expect(typeof collector.flush).toBe('function');
    expect(typeof collector.coverageMap).toBe('object');

    const { registerRunListener } = await import('@actharness/core');
    expect(vi.mocked(registerRunListener)).toHaveBeenCalledOnce();
  });

  it('uses ACTHARNESS_COVERAGE_DIR env var when set', async () => {
    process.env['ACTHARNESS_COVERAGE_DIR'] = '/tmp/custom-cov-dir';
    const exitCallbacks: Array<() => void> = [];
    const onSpy = vi.spyOn(process, 'on').mockImplementation((event: string | symbol, cb: (...args: unknown[]) => void) => {
      if (event === 'exit') exitCallbacks.push(cb as () => void);
      return process;
    });

    const { collector } = await import('../src/register.js');
    const flushSpy = vi.spyOn(collector, 'flush').mockImplementation(() => {});

    exitCallbacks[0]?.();
    expect(flushSpy).toHaveBeenCalledWith('/tmp/custom-cov-dir');
    onSpy.mockRestore();
  });

  it('exit handler: flushes collector (try path)', async () => {
    delete process.env['ACTHARNESS_COVERAGE_DIR'];
    const exitCallbacks: Array<() => void> = [];
    const onSpy = vi.spyOn(process, 'on').mockImplementation((event: string | symbol, cb: (...args: unknown[]) => void) => {
      if (event === 'exit') exitCallbacks.push(cb as () => void);
      return process;
    });

    const { collector } = await import('../src/register.js');
    const flushSpy = vi.spyOn(collector, 'flush').mockImplementation(() => {});

    exitCallbacks[0]?.();
    expect(flushSpy).toHaveBeenCalledWith('.actharness-coverage');
    onSpy.mockRestore();
  });

  it('exit handler: suppresses flush errors (catch path)', async () => {
    delete process.env['ACTHARNESS_COVERAGE_DIR'];
    const exitCallbacks: Array<() => void> = [];
    const onSpy = vi.spyOn(process, 'on').mockImplementation((event: string | symbol, cb: (...args: unknown[]) => void) => {
      if (event === 'exit') exitCallbacks.push(cb as () => void);
      return process;
    });

    const { collector } = await import('../src/register.js');
    vi.spyOn(collector, 'flush').mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(() => exitCallbacks[0]?.()).not.toThrow();
    onSpy.mockRestore();
  });
});
