// RunResult matcher implementations.
// All take `negated` to support expect(...).not.toHaveSucceeded() etc.

import type { RunResult } from '@actharness/types';
import { fail } from './errors.js';

export const runResultMatchers = {
  toHaveSucceeded(result: RunResult, negated: boolean): void {
    const ok = result.conclusion === 'success';
    if (negated) {
      if (ok) fail(`Expected run to NOT have succeeded, but conclusion was 'success'.`);
    } else {
      if (!ok) {
        const failing = result.steps.filter((s) => s.conclusion === 'failure');
        const detail = failing.length > 0
          ? `\n  Failing steps: ${failing.map((s) => `'${s.id}' (${s.conclusion})`).join(', ')}`
          : '';
        fail(`Expected run to have succeeded, but conclusion was '${result.conclusion}'.${detail}`);
      }
    }
  },

  toHaveFailed(result: RunResult, negated: boolean): void {
    const ok = result.conclusion === 'failure';
    if (negated) {
      if (ok) fail(`Expected run to NOT have failed, but conclusion was 'failure'.`);
    } else {
      if (!ok) fail(`Expected run to have failed, but conclusion was '${result.conclusion}'.`);
    }
  },

  toHaveOutput(result: RunResult, name: string, value: string, negated: boolean): void {
    const actual = result.outputs[name];
    const ok = actual === value;
    if (negated) {
      if (ok) fail(`Expected output '${name}' to NOT equal ${JSON.stringify(value)}.`);
    } else {
      if (!ok) {
        fail(
          `Expected output '${name}' to equal ${JSON.stringify(value)}, ` +
          `but got ${actual === undefined ? 'undefined' : JSON.stringify(actual)}.`,
        );
      }
    }
  },

  toHaveStep(result: RunResult, id: string, negated: boolean): void {
    const step = result.step(id);
    const ok = step !== undefined;
    if (negated) {
      if (ok) fail(`Expected run to NOT have a step with id '${id}', but it did.`);
    } else {
      if (!ok) {
        const ids = result.steps.map((s) => `'${s.id}'`).join(', ');
        fail(`Expected run to have a step with id '${id}'. Found steps: [${ids}]`);
      }
    }
  },

  toHaveStepConclusion(
    result: RunResult,
    id: string,
    expected: 'success' | 'failure' | 'skipped',
    negated: boolean,
  ): void {
    const step = result.step(id);
    if (!step) {
      fail(`Expected step '${id}' to exist, but no step with that id was found.`);
    }
    const ok = step.conclusion === expected;
    if (negated) {
      if (ok) fail(`Expected step '${id}' conclusion to NOT be '${expected}', but it was.`);
    } else {
      if (!ok) {
        fail(
          `Expected step '${id}' conclusion to be '${expected}', ` +
          `but got '${step.conclusion}'.`,
        );
      }
    }
  },

  toHaveStepOutput(
    result: RunResult,
    stepId: string,
    outputName: string,
    value: string,
    negated: boolean,
  ): void {
    const step = result.step(stepId);
    if (!step) {
      fail(`Expected step '${stepId}' to exist, but no step with that id was found.`);
    }
    const actual = step.outputs[outputName];
    const ok = actual === value;
    if (negated) {
      if (ok) {
        fail(`Expected step '${stepId}' output '${outputName}' to NOT equal ${JSON.stringify(value)}.`);
      }
    } else {
      if (!ok) {
        fail(
          `Expected step '${stepId}' output '${outputName}' to equal ${JSON.stringify(value)}, ` +
          `but got ${actual === undefined ? 'undefined' : JSON.stringify(actual)}.`,
        );
      }
    }
  },

  toHaveAnnotation(
    result: RunResult,
    opts: { level?: 'error' | 'warning' | 'notice' | 'debug'; message?: string | RegExp } | undefined,
    negated: boolean,
  ): void {
    const found = result.annotations.some((ann) => {
      if (opts?.level && ann.level !== opts.level) return false;
      if (opts?.message) {
        if (typeof opts.message === 'string') return ann.message.includes(opts.message);
        return opts.message.test(ann.message);
      }
      return true;
    });

    const desc = opts
      ? ` matching ${JSON.stringify(opts)}`
      : '';

    if (negated) {
      if (found) fail(`Expected run to NOT have an annotation${desc}, but one was found.`);
    } else {
      if (!found) {
        const available = result.annotations.map((a) => `  ${a.level}: ${a.message}`).join('\n');
        fail(
          `Expected run to have an annotation${desc}.\n` +
          `Annotations found:\n${available || '  (none)'}`,
        );
      }
    }
  },
};
