// GitHub event payload factories.
// Produces minimal but valid event objects for common trigger types.

// ── Push event ────────────────────────────────────────────────────────────────

export interface PushEventOptions {
  ref?: string;
  before?: string;
  after?: string;
  repository?: { full_name?: string; name?: string; owner?: { login?: string } };
  pusher?: { name?: string; email?: string };
}

export function pushEvent(opts: PushEventOptions = {}): Record<string, unknown> {
  return {
    ref: opts.ref ?? 'refs/heads/main',
    before: opts.before ?? '0000000000000000000000000000000000000000',
    after: opts.after ?? '1111111111111111111111111111111111111111',
    repository: {
      full_name: opts.repository?.full_name ?? 'owner/repo',
      name: opts.repository?.name ?? 'repo',
      owner: { login: opts.repository?.owner?.login ?? 'owner' },
    },
    pusher: {
      name: opts.pusher?.name ?? 'octocat',
      email: opts.pusher?.email ?? 'octocat@github.com',
    },
  };
}

// ── Pull request event ────────────────────────────────────────────────────────

export interface PullRequestEventOptions {
  action?: 'opened' | 'synchronize' | 'closed' | 'reopened' | 'edited' | string;
  number?: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  merged?: boolean;
  base?: { ref?: string; sha?: string };
  head?: { ref?: string; sha?: string };
  user?: { login?: string };
}

export function pullRequestEvent(opts: PullRequestEventOptions = {}): Record<string, unknown> {
  return {
    action: opts.action ?? 'opened',
    number: opts.number ?? 1,
    pull_request: {
      number: opts.number ?? 1,
      title: opts.title ?? 'Test PR',
      body: opts.body ?? '',
      state: opts.state ?? 'open',
      merged: opts.merged ?? false,
      base: {
        ref: opts.base?.ref ?? 'main',
        sha: opts.base?.sha ?? '0000000000000000000000000000000000000000',
      },
      head: {
        ref: opts.head?.ref ?? 'feature-branch',
        sha: opts.head?.sha ?? '1111111111111111111111111111111111111111',
      },
      user: { login: opts.user?.login ?? 'octocat' },
    },
  };
}

// ── Workflow dispatch event ───────────────────────────────────────────────────

export interface WorkflowDispatchEventOptions {
  inputs?: Record<string, string>;
  ref?: string;
  workflow?: string;
}

export function workflowDispatchEvent(
  opts: WorkflowDispatchEventOptions = {},
): Record<string, unknown> {
  return {
    inputs: opts.inputs ?? {},
    ref: opts.ref ?? 'refs/heads/main',
    workflow: opts.workflow ?? '.github/workflows/ci.yml',
  };
}

// ── Issue event ───────────────────────────────────────────────────────────────

export interface IssueEventOptions {
  action?: 'opened' | 'closed' | 'edited' | 'labeled' | string;
  number?: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  user?: { login?: string };
}

export function issueEvent(opts: IssueEventOptions = {}): Record<string, unknown> {
  return {
    action: opts.action ?? 'opened',
    issue: {
      number: opts.number ?? 1,
      title: opts.title ?? 'Test Issue',
      body: opts.body ?? '',
      state: opts.state ?? 'open',
      user: { login: opts.user?.login ?? 'octocat' },
    },
  };
}

// ── Release event ─────────────────────────────────────────────────────────────

export interface ReleaseEventOptions {
  action?: 'published' | 'created' | 'edited' | string;
  tagName?: string;
  name?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export function releaseEvent(opts: ReleaseEventOptions = {}): Record<string, unknown> {
  return {
    action: opts.action ?? 'published',
    release: {
      tag_name: opts.tagName ?? 'v1.0.0',
      name: opts.name ?? 'v1.0.0',
      draft: opts.draft ?? false,
      prerelease: opts.prerelease ?? false,
    },
  };
}
