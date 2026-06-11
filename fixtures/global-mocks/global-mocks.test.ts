import { actharness } from 'actharness';

// File-level mock: registered outside any describe/test; goes into the file-root scope.
actharness.mock('actions/checkout@v4', { outputs: { sha: 'file-sha' } });
actharness.mock('actions/status-check@v1', { outputs: { status: 'file-status' } });

test('file-level mocks are visible in all tests', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveOutput('checkout-sha', 'file-sha');
  expect(result).toHaveOutput('status', 'file-status');
});

test('test-level mock overrides file-level mock', async () => {
  actharness.mock('actions/checkout@v4', { outputs: { sha: 'test-sha' } });

  const result = await actharness('./action.yml').run();

  expect(result).toHaveOutput('checkout-sha', 'test-sha');
  // file-level mock for status still visible
  expect(result).toHaveOutput('status', 'file-status');
});

describe('describe-level mocks via beforeEach', () => {
  beforeEach(() => {
    actharness.mock('actions/checkout@v4', { outputs: { sha: 'describe-sha' } });
    actharness.mock('actions/status-check@v1', { outputs: { status: 'describe-status' } });
  });

  afterEach(() => {
    actharness.resetMocks();
  });

  test('beforeEach mock is visible in test body', async () => {
    const result = await actharness('./action.yml').run();

    expect(result).toHaveOutput('checkout-sha', 'describe-sha');
    expect(result).toHaveOutput('status', 'describe-status');
  });

  test('test-level mock overrides describe-level mock', async () => {
    actharness.mock('actions/checkout@v4', { outputs: { sha: 'test-override-sha' } });

    const result = await actharness('./action.yml').run();

    expect(result).toHaveOutput('checkout-sha', 'test-override-sha');
    // status mock from beforeEach still visible (not overridden in this test)
    expect(result).toHaveOutput('status', 'describe-status');
  });

  describe('nested describe', () => {
    beforeEach(() => {
      actharness.mock('actions/checkout@v4', { outputs: { sha: 'nested-sha' } });
    });

    test('inner describe mock overrides outer describe mock', async () => {
      const result = await actharness('./action.yml').run();

      // inner beforeEach mock wins over outer beforeEach mock
      expect(result).toHaveOutput('checkout-sha', 'nested-sha');
      // outer describe's status mock still visible (not overridden by inner beforeEach)
      expect(result).toHaveOutput('status', 'describe-status');
    });
  });
});

describe('actharness.resetMocks() in afterEach isolates tests', () => {
  beforeEach(() => {
    actharness.mock('actions/checkout@v4', { outputs: { sha: 'reset-test-sha' } });
  });

  afterEach(() => {
    actharness.resetMocks();
  });

  test('first test sees beforeEach mock', async () => {
    const result = await actharness('./action.yml').run();
    expect(result).toHaveOutput('checkout-sha', 'reset-test-sha');
  });

  test('second test also sees a fresh beforeEach mock (not carried over)', async () => {
    const result = await actharness('./action.yml').run();
    expect(result).toHaveOutput('checkout-sha', 'reset-test-sha');
  });
});
