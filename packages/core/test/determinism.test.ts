import { describe, it, expect } from 'vitest';
import {
  createJobStatus,
  markJobFailure,
  markJobCancelled,
  resolveDeterminism,
  FROZEN_EPOCH,
  FROZEN_SEED,
  FROZEN_RUN_ID,
} from '../src/determinism.js';

describe('createJobStatus', () => {
  it('defaults to success when no initial state given', () => {
    const s = createJobStatus();
    expect(s.success).toBe(true);
    expect(s.failure).toBe(false);
    expect(s.cancelled).toBe(false);
  });

  it('initializes to failure', () => {
    const s = createJobStatus('failure');
    expect(s.success).toBe(false);
    expect(s.failure).toBe(true);
    expect(s.cancelled).toBe(false);
  });

  it('initializes to cancelled', () => {
    const s = createJobStatus('cancelled');
    expect(s.success).toBe(false);
    expect(s.failure).toBe(false);
    expect(s.cancelled).toBe(true);
  });

  it('initializes to success explicitly', () => {
    const s = createJobStatus('success');
    expect(s.success).toBe(true);
    expect(s.failure).toBe(false);
  });
});

describe('markJobFailure', () => {
  it('sets failure=true, success=false', () => {
    const s = createJobStatus();
    markJobFailure(s);
    expect(s.success).toBe(false);
    expect(s.failure).toBe(true);
  });
});

describe('markJobCancelled', () => {
  it('sets cancelled=true, clears success and failure', () => {
    const s = createJobStatus('failure');
    markJobCancelled(s);
    expect(s.success).toBe(false);
    expect(s.failure).toBe(false);
    expect(s.cancelled).toBe(true);
  });
});

describe('resolveDeterminism', () => {
  it('returns frozen defaults when called with no argument', () => {
    const d = resolveDeterminism();
    expect(d.now).toEqual(FROZEN_EPOCH);
    expect(d.seed).toBe(FROZEN_SEED);
    expect(d.runId).toBe(FROZEN_RUN_ID);
  });

  it('returns frozen defaults when called with empty object', () => {
    const d = resolveDeterminism({});
    expect(d.now).toEqual(FROZEN_EPOCH);
  });

  it('uses real Date when now=false', () => {
    const before = Date.now();
    const d = resolveDeterminism({ now: false });
    const after = Date.now();
    expect(d.now.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.now.getTime()).toBeLessThanOrEqual(after);
  });

  it('uses provided Date instance when now is a Date', () => {
    const fixed = new Date('2025-06-01T00:00:00Z');
    const d = resolveDeterminism({ now: fixed });
    expect(d.now).toBe(fixed);
  });

  it('converts number timestamp to Date when now is a number', () => {
    const ts = new Date('2025-01-15T12:00:00Z').getTime();
    const d = resolveDeterminism({ now: ts });
    expect(d.now).toEqual(new Date(ts));
  });

  it('overrides seed when provided', () => {
    const d = resolveDeterminism({ seed: 99 });
    expect(d.seed).toBe(99);
  });

  it('overrides runId when provided', () => {
    const d = resolveDeterminism({ runId: '42' });
    expect(d.runId).toBe('42');
  });

  it('uses seed=0 when seed=false', () => {
    const d = resolveDeterminism({ seed: false });
    expect(d.seed).toBe(0);
  });
});
