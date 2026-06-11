// GitHub context fixtures — typed defaults + merge helper.
// Re-exports GITHUB_DEFAULTS with a convenience merge function.

import type { GitHubContext, RunnerContext } from '@actharness/types';
import { GITHUB_DEFAULTS, RUNNER_DEFAULTS } from '@actharness/types';

export { GITHUB_DEFAULTS, RUNNER_DEFAULTS };

/** Merge partial overrides with the GitHub defaults. */
export function github(overrides?: Partial<GitHubContext>): GitHubContext {
  return { ...GITHUB_DEFAULTS, ...overrides };
}

/** Merge partial overrides with the runner defaults. */
export function runner(overrides?: Partial<RunnerContext>): RunnerContext {
  return { ...RUNNER_DEFAULTS, ...overrides };
}
