import {
  actharness,
  github,
  runner,
  pushEvent,
  pullRequestEvent,
  workflowDispatchEvent,
  issueEvent,
  releaseEvent,
} from 'actharness';

test('default context uses GITHUB_DEFAULTS and RUNNER_DEFAULTS', async () => {
  const result = await actharness('./action.yml').run();

  expect(result).toHaveOutput('event-name', 'push');
  expect(result).toHaveOutput('repository', 'owner/repo');
  expect(result).toHaveOutput('actor', 'octocat');
  expect(result).toHaveOutput('runner-os', 'Linux');
});

test('github() overrides apply to context', async () => {
  const result = await actharness('./action.yml').run({
    github: github({ event_name: 'workflow_dispatch', repository: 'my-org/my-action', actor: 'deploy-bot' }),
  });

  expect(result).toHaveOutput('event-name', 'workflow_dispatch');
  expect(result).toHaveOutput('repository', 'my-org/my-action');
  expect(result).toHaveOutput('actor', 'deploy-bot');
});

test('runner() override applies to context', async () => {
  const result = await actharness('./action.yml').run({
    runner: runner({ os: 'Windows' }),
  });

  expect(result).toHaveOutput('runner-os', 'Windows');
});

test('pushEvent payload is accessible via github.event.*', async () => {
  const result = await actharness('./action.yml').run({
    github: github({ event_name: 'push' }),
    eventPayload: pushEvent({ ref: 'refs/heads/feature' }),
  });

  expect(result).toHaveOutput('event-name', 'push');
  expect(result).toHaveOutput('event-ref', 'refs/heads/feature');
});

test('pullRequestEvent payload is accessible via github.event.*', async () => {
  const result = await actharness('./action.yml').run({
    github: github({ event_name: 'pull_request' }),
    eventPayload: pullRequestEvent({ number: 42, action: 'synchronize' }),
  });

  expect(result).toHaveOutput('event-name', 'pull_request');
  expect(result).toHaveOutput('event-number', '42');
  expect(result).toHaveOutput('event-action', 'synchronize');
});

test('workflowDispatchEvent payload is accessible via github.event.*', async () => {
  const result = await actharness('./action.yml').run({
    github: github({ event_name: 'workflow_dispatch' }),
    eventPayload: workflowDispatchEvent({ ref: 'refs/tags/v1.2.3' }),
  });

  expect(result).toHaveOutput('event-name', 'workflow_dispatch');
  expect(result).toHaveOutput('event-ref', 'refs/tags/v1.2.3');
});

test('issueEvent payload is accessible via github.event.*', async () => {
  const result = await actharness('./action.yml').run({
    github: github({ event_name: 'issues' }),
    eventPayload: issueEvent({ number: 7, action: 'labeled' }),
  });

  expect(result).toHaveOutput('event-name', 'issues');
  expect(result).toHaveOutput('event-issue-number', '7');
  expect(result).toHaveOutput('event-action', 'labeled');
});

test('releaseEvent payload is accessible via github.event.*', async () => {
  const result = await actharness('./action.yml').run({
    github: github({ event_name: 'release' }),
    eventPayload: releaseEvent({ tagName: 'v2.0.0', action: 'published' }),
  });

  expect(result).toHaveOutput('event-name', 'release');
  expect(result).toHaveOutput('event-tag', 'v2.0.0');
  expect(result).toHaveOutput('event-action', 'published');
});
