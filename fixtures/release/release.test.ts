// Covers three v0.1 acceptance scenarios in one fixture: a mocked `uses:`,
// a skipped step via `if:`, and `$GITHUB_ENV` threading between steps.
import { actharness } from 'actharness';

test('skips publish on dry-run and records the mocked checkout inputs', async () => {
  const checkout = actharness.mock('actions/checkout@v4', { outputs: { ref: 'abc123' } });

  const result = await actharness('./action.yml').run({ inputs: { 'dry-run': true } });

  expect(checkout).toHaveBeenCalledWith({ 'fetch-depth': '0' });
  expect(result).toHaveStepSkipped('publish');
  expect(result).toHaveStepSucceeded('version');
  expect(result).toHaveOutput('sha', 'abc123');
});

test('runs publish when not a dry-run, seeing the threaded $GITHUB_ENV', async () => {
  actharness.mock('actions/checkout@v4', { outputs: { ref: 'abc123' } });

  const result = await actharness('./action.yml').run({ inputs: { 'dry-run': false } });

  expect(result).toHaveStepSucceeded('publish');
  expect(result.step('publish')).toHaveStdoutContaining('Publishing 1.2.3');
});
