import { describe, it, expect } from 'vitest';
import {
  actharness,
  ParseError,
  ConfigError,
  MissingMockError,
  ExpressionError,
  CycleError,
  MaxDepthError,
  ActharnessError,
  createContextStore,
  createJobStatus,
  FROZEN_EPOCH,
  MockRegistry,
  registerExecutor,
  getExecutor,
  runSteps,
  notifyRunSink,
  registerRunListener,
} from '../src/index.js';

describe('@actharness/core index', () => {
  it('exports actharness function', () => {
    expect(typeof actharness).toBe('function');
  });

  it('exports error classes', () => {
    expect(ParseError).toBeDefined();
    expect(ConfigError).toBeDefined();
    expect(MissingMockError).toBeDefined();
    expect(ExpressionError).toBeDefined();
    expect(CycleError).toBeDefined();
    expect(MaxDepthError).toBeDefined();
    expect(ActharnessError).toBeDefined();
  });

  it('exports context utilities', () => {
    expect(typeof createContextStore).toBe('function');
    expect(typeof createJobStatus).toBe('function');
    expect(FROZEN_EPOCH).toBeInstanceOf(Date);
  });

  it('exports MockRegistry', () => {
    const reg = new MockRegistry();
    expect(reg).toBeDefined();
  });

  it('exports executor registry functions', () => {
    expect(typeof registerExecutor).toBe('function');
    expect(typeof getExecutor).toBe('function');
  });

  it('exports runSteps', () => {
    expect(typeof runSteps).toBe('function');
  });

  it('exports run sink functions', () => {
    expect(typeof notifyRunSink).toBe('function');
    expect(typeof registerRunListener).toBe('function');
  });
});
