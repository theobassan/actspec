// Process-global run observation channel.
// Symbol.for survives the dual ESM/CJS module boundary within one worker.
// core notifies; @actharness/coverage subscribes — core never imports coverage.

import type { RunResult } from '@actharness/types';

export interface RunResultMeta {
  sourceFile: string | undefined;
  actionDir: string | undefined;
  inputsExercised?: Record<string, 'provided' | 'default'>;
}

export type RunListener = (result: RunResult, meta: RunResultMeta) => void;

const SINK_KEY = Symbol.for('actharness.runSink');

type Global = typeof globalThis & { [key: symbol]: RunListener[] | undefined };

export function registerRunListener(fn: RunListener): void {
  const g = globalThis as Global;
  if (!g[SINK_KEY]) g[SINK_KEY] = [];
  g[SINK_KEY]!.push(fn);
}

export function notifyRunSink(result: RunResult, meta: RunResultMeta): void {
  const g = globalThis as Global;
  const listeners = g[SINK_KEY] ?? [];
  for (const fn of listeners) fn(result, meta);
}
