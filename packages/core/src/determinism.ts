import type { Determinism } from '@actharness/types';

export interface JobStatus {
  success: boolean;
  failure: boolean;
  cancelled: boolean;
}

export function createJobStatus(
  initial?: 'success' | 'failure' | 'cancelled',
): JobStatus {
  return {
    success: !initial || initial === 'success',
    failure: initial === 'failure',
    cancelled: initial === 'cancelled',
  };
}

export function markJobFailure(s: JobStatus): void {
  s.success = false;
  s.failure = true;
}

export function markJobCancelled(s: JobStatus): void {
  s.success = false;
  s.failure = false;
  s.cancelled = true;
}

export const FROZEN_EPOCH = new Date('2024-01-01T00:00:00.000Z');
export const FROZEN_SEED = 42;
export const FROZEN_RUN_ID = '1';

export interface ResolvedDeterminism {
  now: Date;
  seed: number;
  runId: string;
}

export function resolveDeterminism(d?: Determinism): ResolvedDeterminism {
  let now: Date;
  if (d?.now === false) {
    now = new Date();
  } else if (d?.now instanceof Date) {
    now = d.now;
  } else if (typeof d?.now === 'number') {
    now = new Date(d.now);
  } else {
    now = FROZEN_EPOCH;
  }

  const seed = d?.seed === false ? 0 : (d?.seed ?? FROZEN_SEED);
  const runId = d?.runId ?? FROZEN_RUN_ID;

  return { now, seed, runId };
}
