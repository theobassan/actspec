import { actharness } from 'actharness';

test('::notice:: emits a notice-level annotation', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveAnnotation({ level: 'notice', message: 'deployment started' });
});

test('::debug:: emits a debug-level annotation', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveAnnotation({ level: 'debug', message: 'internal cache state: ready' });
});

test('::add-mask:: redacts the value from all subsequent stdout', async () => {
  const result = await actharness('./action.yml').run();

  expect(result.step('mask-and-echo')).not.toHaveStdoutContaining('s3cr3t');
  expect(result.step('mask-and-echo')).toHaveStdoutContaining('***');
});

test('toHaveAnnotation matches message with a RegExp', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveAnnotation({ level: 'notice', message: /deployment/ });
  expect(result).toHaveAnnotation({ level: 'debug', message: /cache.*ready/ });
});

test('step handle toHaveAnnotation scopes to annotations from that step', async () => {
  const result = await actharness('./action.yml').run();

  expect(result.step('emit-notice')).toHaveAnnotation({ level: 'notice', message: 'deployment started' });
  expect(result.step('emit-debug')).toHaveAnnotation({ level: 'debug', message: /cache.*ready/ });
  expect(result.step('emit-notice')).not.toHaveAnnotation({ level: 'debug' });
});
