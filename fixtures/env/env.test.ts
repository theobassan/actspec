import { actharness } from 'actharness';

test('env seed is accessible in run: steps as environment variables', async () => {
  const result = await actharness('./action.yml').run({
    env: { BASE_URL: 'https://prod.example.com' },
  });

  expect(result).toHaveOutput('base-url', 'https://prod.example.com');
});

test('step-level env: overrides the seed for that step only', async () => {
  const result = await actharness('./action.yml').run({
    env: { BASE_URL: 'https://prod.example.com' },
  });

  expect(result).toHaveOutput('base-url', 'https://prod.example.com');
  expect(result).toHaveOutput('step-url', 'https://staging.example.com');
});

test('working-directory: changes cwd for that step', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveOutput('cwd-name', 'subdir');
});

test('$GITHUB_PATH prepends paths for subsequent steps', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveOutput('has-custom-bin', 'true');
});
