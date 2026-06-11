import { actharness } from 'actharness';

test('mockImplementation receives call inputs and returns dynamic outputs', async () => {
  actharness.mock('actions/api@v1', ({ with: w }) => ({
    outputs: { response: `called ${w['endpoint']}` },
  }));

  const action = actharness('./action.yml');
  const result = await action.run();

  expect(result).toHaveOutput('first-response', 'called /users');
  expect(result).toHaveOutput('second-response', 'called /status');
});

test('mockImplementationOnce overrides only the next call, then falls back', async () => {
  const api = actharness.mock('actions/api@v1', { outputs: { response: 'default' } });
  api.mockImplementationOnce(() => ({ outputs: { response: 'one-time' } }));

  const action = actharness('./action.yml');
  const result = await action.run();

  expect(result).toHaveOutput('first-response', 'one-time');
  expect(result).toHaveOutput('second-response', 'default');
});

test('mockOutputs re-stubs the outputs after construction', async () => {
  const api = actharness.mock('actions/api@v1', { outputs: { response: 'v1' } });
  api.mockOutputs({ response: 'v2' });

  const action = actharness('./action.yml');
  const result = await action.run();

  expect(result).toHaveOutput('first-response', 'v2');
  expect(result).toHaveOutput('second-response', 'v2');
});

test('mockConclusion forces the step to fail', async () => {
  const api = actharness.mock('actions/api@v1', { outputs: {} });
  api.mockConclusion('failure');

  const action = actharness('./action.yml');
  const result = await action.run();

  expect(result).toHaveFailed();
  expect(result).toHaveStepFailed('first-call');
});

test('toHaveBeenCalled() verifies the mock was called at least once', async () => {
  const api = actharness.mock('actions/api@v1', { outputs: { response: 'ok' } });

  const action = actharness('./action.yml');
  await action.run();

  expect(api).toHaveBeenCalled();
  expect(api).not.toHaveBeenCalledTimes(1);
});

test('mock.clear() resets call history', async () => {
  const api = actharness.mock('actions/api@v1', { outputs: { response: 'ok' } });

  const action = actharness('./action.yml');
  await action.run();
  expect(api).toHaveBeenCalledTimes(2);

  api.clear();
  expect(api).not.toHaveBeenCalled();
});

test('actharness.resetMocks() clears call history on all mocks', async () => {
  const api = actharness.mock('actions/api@v1', { outputs: { response: 'ok' } });

  const action = actharness('./action.yml');
  await action.run();
  expect(api).toHaveBeenCalledTimes(2);

  actharness.resetMocks();
  expect(api).not.toHaveBeenCalled();
});
