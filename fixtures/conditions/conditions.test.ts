import { actharness } from 'actharness';

test('matrix context values are accessible in expressions', async () => {
  const result = await actharness('./action.yml').run({
    matrix: { environment: 'production' },
  });

  expect(result).toHaveOutput('env-label', 'production');
});

test('success() is true by default; failure() and cancelled() steps are skipped', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveSucceeded();
  expect(result).toHaveStepSucceeded('read-matrix');
  expect(result).toHaveStepSkipped('on-failure');
  expect(result).toHaveStepSkipped('on-cancelled');
  expect(result).toHaveStepSucceeded('always-runs');
});

test('failure() becomes true after a step fails; failure handler and always() run', async () => {
  const result = await actharness('./action.yml').run({
    inputs: { 'should-fail': true },
  });

  expect(result).toHaveFailed();
  expect(result).toHaveStepSucceeded('on-failure');
  expect(result).toHaveStepSkipped('on-cancelled');
  expect(result).toHaveStepSucceeded('always-runs');
});

test('jobStatus: cancelled makes cancelled() true; success() steps are skipped', async () => {
  const result = await actharness('./action.yml').run({
    jobStatus: 'cancelled',
  });

  expect(result).toHaveStepSkipped('read-matrix');
  expect(result).toHaveStepSkipped('on-failure');
  expect(result).toHaveStepSucceeded('on-cancelled');
  expect(result).toHaveStepSucceeded('always-runs');
});

test('jobStatus: failure makes failure() true from the start', async () => {
  const result = await actharness('./action.yml').run({
    jobStatus: 'failure',
  });

  expect(result).toHaveStepSkipped('read-matrix');
  expect(result).toHaveStepSucceeded('on-failure');
  expect(result).toHaveStepSkipped('on-cancelled');
  expect(result).toHaveStepSucceeded('always-runs');
});

test('step handle toHaveFailed works on a failed step', async () => {
  const result = await actharness('./action.yml').run({
    inputs: { 'should-fail': true },
  });

  expect(result.step('trigger-failure')).toHaveFailed();
});
