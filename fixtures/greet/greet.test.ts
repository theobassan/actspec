// The walking skeleton (specs/versions/v0.1.md). When this passes end-to-end,
// the v0.1 architecture is validated. Paths are illustrative — the build wires
// these fixtures into the package test setup.
import { actharness } from 'actharness';

test('sets the greeting output from a real bash step', async () => {
  const action = actharness('./action.yml');
  const result = await action.run({ inputs: { name: 'World' } });

  expect(result).toHaveSucceeded();
  expect(result).toHaveStepSucceeded('hello');
  expect(result).toHaveOutput('greeting', 'Hello World');
});

test('applies the input default when omitted', async () => {
  const result = await actharness('./action.yml').run();
  expect(result).toHaveOutput('greeting', 'Hello nobody');
});

test('step handle matchers work on a step result', async () => {
  const result = await actharness('./action.yml').run({ inputs: { name: 'World' } });
  expect(result.step('hello')).toHaveSucceeded();
  expect(result.step('hello')).toHaveOutput('greeting', 'Hello World');
});
