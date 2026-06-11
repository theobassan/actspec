import { describe, it, expect } from 'vitest';
import { GITHUB_DEFAULTS, RUNNER_DEFAULTS } from '@actharness/types';
import {
  github,
  runner,
  pushEvent,
  pullRequestEvent,
  workflowDispatchEvent,
  issueEvent,
  releaseEvent,
} from '../src/index.js';

describe('github()', () => {
  it('returns GITHUB_DEFAULTS when no overrides', () => {
    const ctx = github();
    expect(ctx.repository).toBe(GITHUB_DEFAULTS.repository);
    expect(ctx.actor).toBe(GITHUB_DEFAULTS.actor);
    expect(ctx.event_name).toBe(GITHUB_DEFAULTS.event_name);
  });

  it('merges overrides over defaults', () => {
    const ctx = github({ actor: 'custom', repository: 'org/repo' });
    expect(ctx.actor).toBe('custom');
    expect(ctx.repository).toBe('org/repo');
    expect(ctx.sha).toBe(GITHUB_DEFAULTS.sha);
  });

  it('does not mutate GITHUB_DEFAULTS', () => {
    github({ actor: 'modified' });
    expect(GITHUB_DEFAULTS.actor).toBe('octocat');
  });
});

describe('runner()', () => {
  it('returns RUNNER_DEFAULTS when no overrides', () => {
    const ctx = runner();
    expect(ctx.os).toBe(RUNNER_DEFAULTS.os);
    expect(ctx.arch).toBe(RUNNER_DEFAULTS.arch);
  });

  it('merges overrides over defaults', () => {
    const ctx = runner({ os: 'macOS', arch: 'ARM64' });
    expect(ctx.os).toBe('macOS');
    expect(ctx.arch).toBe('ARM64');
    expect(ctx.name).toBe(RUNNER_DEFAULTS.name);
  });
});

describe('pushEvent()', () => {
  it('returns defaults when no options', () => {
    const event = pushEvent();
    expect(event['ref']).toBe('refs/heads/main');
    expect((event['repository'] as Record<string, unknown>)['full_name']).toBe('owner/repo');
  });

  it('applies overrides', () => {
    const event = pushEvent({
      ref: 'refs/heads/feature',
      after: 'abc123',
    });
    expect(event['ref']).toBe('refs/heads/feature');
    expect(event['after']).toBe('abc123');
  });

  it('uses provided repository and pusher values', () => {
    const event = pushEvent({
      repository: { full_name: 'org/custom', name: 'custom', owner: { login: 'org' } },
      pusher: { name: 'bob', email: 'bob@example.com' },
    });
    const repo = event['repository'] as Record<string, unknown>;
    expect(repo['full_name']).toBe('org/custom');
    expect(repo['name']).toBe('custom');
    expect((repo['owner'] as Record<string, unknown>)['login']).toBe('org');
    const pusher = event['pusher'] as Record<string, unknown>;
    expect(pusher['name']).toBe('bob');
    expect(pusher['email']).toBe('bob@example.com');
  });
});

describe('pullRequestEvent()', () => {
  it('returns defaults when no options', () => {
    const event = pullRequestEvent();
    expect(event['action']).toBe('opened');
    expect(event['number']).toBe(1);
    const pr = event['pull_request'] as Record<string, unknown>;
    expect(pr['state']).toBe('open');
  });

  it('applies overrides', () => {
    const event = pullRequestEvent({ action: 'closed', number: 42, merged: true });
    expect(event['action']).toBe('closed');
    expect(event['number']).toBe(42);
    const pr = event['pull_request'] as Record<string, unknown>;
    expect(pr['merged']).toBe(true);
  });

  it('sets base and head refs', () => {
    const event = pullRequestEvent({
      base: { ref: 'main' },
      head: { ref: 'feature' },
    });
    const pr = event['pull_request'] as Record<string, unknown>;
    expect((pr['base'] as Record<string, unknown>)['ref']).toBe('main');
    expect((pr['head'] as Record<string, unknown>)['ref']).toBe('feature');
  });

  it('uses provided user login', () => {
    const event = pullRequestEvent({ user: { login: 'alice' } });
    const pr = event['pull_request'] as Record<string, unknown>;
    expect((pr['user'] as Record<string, unknown>)['login']).toBe('alice');
  });
});

describe('workflowDispatchEvent()', () => {
  it('returns defaults when no options', () => {
    const event = workflowDispatchEvent();
    expect(event['ref']).toBe('refs/heads/main');
    expect(event['inputs']).toEqual({});
  });

  it('applies input overrides', () => {
    const event = workflowDispatchEvent({
      inputs: { env: 'prod', version: '1.2.3' },
    });
    const inputs = event['inputs'] as Record<string, string>;
    expect(inputs['env']).toBe('prod');
    expect(inputs['version']).toBe('1.2.3');
  });
});

describe('issueEvent()', () => {
  it('returns defaults when no options', () => {
    const event = issueEvent();
    expect(event['action']).toBe('opened');
    const issue = event['issue'] as Record<string, unknown>;
    expect(issue['state']).toBe('open');
  });

  it('applies overrides', () => {
    const event = issueEvent({ action: 'closed', state: 'closed', number: 7 });
    expect(event['action']).toBe('closed');
    const issue = event['issue'] as Record<string, unknown>;
    expect(issue['state']).toBe('closed');
    expect(issue['number']).toBe(7);
  });

  it('uses provided user login', () => {
    const event = issueEvent({ user: { login: 'bob' } });
    const issue = event['issue'] as Record<string, unknown>;
    expect((issue['user'] as Record<string, unknown>)['login']).toBe('bob');
  });
});

describe('releaseEvent()', () => {
  it('returns defaults when no options', () => {
    const event = releaseEvent();
    expect(event['action']).toBe('published');
    const release = event['release'] as Record<string, unknown>;
    expect(release['tag_name']).toBe('v1.0.0');
    expect(release['prerelease']).toBe(false);
  });

  it('applies overrides', () => {
    const event = releaseEvent({ tagName: 'v2.0.0-rc.1', prerelease: true });
    const release = event['release'] as Record<string, unknown>;
    expect(release['tag_name']).toBe('v2.0.0-rc.1');
    expect(release['prerelease']).toBe(true);
  });
});
