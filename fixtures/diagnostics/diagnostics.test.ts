import { actharness } from 'actharness';

test('continues when continue-on-error step fails; covers step outputs, mock call counts, annotations, stderr', async () => {
  const fetch = actharness.mock('actions/http-get@v1', { outputs: {} });

  const result = await actharness('./action.yml').run();

  expect(result).toHaveSucceeded();
  expect(result).toHaveStep('compute');
  expect(result).toHaveStepSucceeded('compute');
  expect(result).not.toHaveStepFailed('compute');
  expect(result).toHaveStepSucceeded('flaky');
  expect(result).toHaveOutput('tag', 'v1.0.0');
  expect(result).toHaveStepOutput('compute', 'tag', 'v1.0.0');
  expect(result.step('compute')).toHaveStderrContaining('computing...');
  expect(result).toHaveAnnotation({ level: 'warning', message: 'low disk space' });
  expect(fetch).toHaveBeenCalledWith({"url":"https://api.example.com/data"});
  expect(fetch).toHaveBeenCalledWith({"url":"https://api.example.com/retry"});
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('fails the action when abort step runs', async () => {
  actharness.mock('actions/http-get@v1', { outputs: {} });

  const result = await actharness('./action.yml').run({ inputs: { fail: true } });

  expect(result).toHaveFailed();
  expect(result).toHaveStepFailed('abort');
  expect(result).toHaveAnnotation({ level: 'error', message: 'abort requested' });
});
