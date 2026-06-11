// ActionMock matcher implementations.

import type { ActionMock } from '@actharness/types';
import { fail } from './errors.js';

export const mockMatchers = {
  toHaveBeenCalled(mock: ActionMock, negated: boolean): void {
    const ok = mock.called;
    if (negated) {
      if (ok) fail(`Expected mock to NOT have been called, but it was called ${mock.callCount} time(s).`);
    } else {
      if (!ok) fail(`Expected mock to have been called, but it was not called.`);
    }
  },

  toHaveBeenCalledTimes(mock: ActionMock, n: number, negated: boolean): void {
    const ok = mock.callCount === n;
    if (negated) {
      if (ok) fail(`Expected mock to NOT have been called ${n} time(s), but it was.`);
    } else {
      if (!ok) {
        fail(`Expected mock to have been called ${n} time(s), but it was called ${mock.callCount} time(s).`);
      }
    }
  },

  toHaveBeenCalledWith(
    mock: ActionMock,
    expectedInputs: Record<string, string>,
    negated: boolean,
  ): void {
    const found = mock.calls.some((call) => {
      return Object.entries(expectedInputs).every(
        ([key, val]) => call.with[key] === val,
      );
    });

    if (negated) {
      if (found) {
        fail(
          `Expected mock to NOT have been called with ${JSON.stringify(expectedInputs)}, ` +
          `but it was.`,
        );
      }
    } else {
      if (!found) {
        const actual = mock.calls.map((c) => JSON.stringify(c.with)).join('\n  ');
        fail(
          `Expected mock to have been called with ${JSON.stringify(expectedInputs)}.\n` +
          `Actual calls:\n  ${actual || '(none)'}`,
        );
      }
    }
  },
};
