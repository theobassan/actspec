import { actharness } from 'actharness';

test('secret is interpolated into uses: with: block and accessible in run: steps', async () => {
  const http = actharness.mock('actions/http-client@v1', { outputs: {} });

  const result = await actharness('./action.yml').run({
    secrets: { API_KEY: 'secret-token-abc' },
  });

  expect(result).toHaveSucceeded();
  expect(http).toHaveBeenCalledWith({
    authorization: 'Bearer secret-token-abc',
    url: 'https://api.example.com/data',
  });
  expect(result).toHaveOutput('key-length', '16');
});

test('missing secret resolves to empty string', async () => {
  actharness.mock('actions/http-client@v1', { outputs: {} });

  const result = await actharness('./action.yml').run();

  expect(result).toHaveOutput('key-length', '0');
});
