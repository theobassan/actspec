import { describe, it, expect } from 'vitest';
import { GITHUB_DEFAULTS, RUNNER_DEFAULTS } from '../src/index.js';

describe('GITHUB_DEFAULTS', () => {
  it('repository is the fixed synthetic default', () => {
    expect(GITHUB_DEFAULTS.repository).toBe('owner/repo');
  });

  it('repository_owner matches repository prefix', () => {
    expect(GITHUB_DEFAULTS.repository_owner).toBe('owner');
  });

  it('repository_id is a string', () => {
    expect(GITHUB_DEFAULTS.repository_id).toBe('1');
  });

  it('actor is octocat', () => {
    expect(GITHUB_DEFAULTS.actor).toBe('octocat');
  });

  it('actor_id is a string', () => {
    expect(GITHUB_DEFAULTS.actor_id).toBe('1');
  });

  it('triggering_actor is octocat', () => {
    expect(GITHUB_DEFAULTS.triggering_actor).toBe('octocat');
  });

  it('event_name defaults to push', () => {
    expect(GITHUB_DEFAULTS.event_name).toBe('push');
  });

  it('event defaults to empty object', () => {
    expect(GITHUB_DEFAULTS.event).toEqual({});
  });

  it('sha is 40 zeros', () => {
    expect(GITHUB_DEFAULTS.sha).toBe('0000000000000000000000000000000000000000');
    expect(GITHUB_DEFAULTS.sha).toHaveLength(40);
  });

  it('run_id defaults to 1', () => {
    expect(GITHUB_DEFAULTS.run_id).toBe('1');
  });

  it('run_number defaults to 1', () => {
    expect(GITHUB_DEFAULTS.run_number).toBe('1');
  });

  it('run_attempt defaults to 1', () => {
    expect(GITHUB_DEFAULTS.run_attempt).toBe('1');
  });

  it('ref defaults to refs/heads/main', () => {
    expect(GITHUB_DEFAULTS.ref).toBe('refs/heads/main');
  });

  it('ref_name defaults to main', () => {
    expect(GITHUB_DEFAULTS.ref_name).toBe('main');
  });

  it('ref_type defaults to branch', () => {
    expect(GITHUB_DEFAULTS.ref_type).toBe('branch');
  });

  it('ref_protected defaults to false', () => {
    expect(GITHUB_DEFAULTS.ref_protected).toBe(false);
  });

  it('base_ref defaults to empty string', () => {
    expect(GITHUB_DEFAULTS.base_ref).toBe('');
  });

  it('head_ref defaults to empty string', () => {
    expect(GITHUB_DEFAULTS.head_ref).toBe('');
  });

  it('workflow defaults to CI', () => {
    expect(GITHUB_DEFAULTS.workflow).toBe('CI');
  });

  it('workflow_ref follows repository default', () => {
    expect(GITHUB_DEFAULTS.workflow_ref).toBe(
      'owner/repo/.github/workflows/ci.yml@refs/heads/main',
    );
  });

  it('job defaults to test', () => {
    expect(GITHUB_DEFAULTS.job).toBe('test');
  });

  it('token starts with ghs_', () => {
    expect(GITHUB_DEFAULTS.token).toMatch(/^ghs_/);
  });

  it('retention_days defaults to 90', () => {
    expect(GITHUB_DEFAULTS.retention_days).toBe('90');
  });

  it('server_url is https://github.com', () => {
    expect(GITHUB_DEFAULTS.server_url).toBe('https://github.com');
  });

  it('api_url is https://api.github.com', () => {
    expect(GITHUB_DEFAULTS.api_url).toBe('https://api.github.com');
  });

  it('graphql_url is https://api.github.com/graphql', () => {
    expect(GITHUB_DEFAULTS.graphql_url).toBe('https://api.github.com/graphql');
  });
});

describe('RUNNER_DEFAULTS', () => {
  it('os defaults to Linux', () => {
    expect(RUNNER_DEFAULTS.os).toBe('Linux');
  });

  it('arch defaults to X64', () => {
    expect(RUNNER_DEFAULTS.arch).toBe('X64');
  });

  it('name defaults to actharness', () => {
    expect(RUNNER_DEFAULTS.name).toBe('actharness');
  });

  it('tool_cache defaults to /opt/hostedtoolcache', () => {
    expect(RUNNER_DEFAULTS.tool_cache).toBe('/opt/hostedtoolcache');
  });

  it('environment defaults to github-hosted', () => {
    expect(RUNNER_DEFAULTS.environment).toBe('github-hosted');
  });

  it('debug defaults to empty string', () => {
    expect(RUNNER_DEFAULTS.debug).toBe('');
  });
});
