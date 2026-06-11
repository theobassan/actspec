<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1><code>@actharness/fixtures</code></h1>
  <p>GitHub context and event payload factories for actharness.</p>
  <a href="https://www.npmjs.com/package/@actharness/fixtures"><img src="https://img.shields.io/npm/v/@actharness/fixtures?color=3fb950&label=npm" alt="npm"></a>
  <a href="https://github.com/actharness/actharness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-3fb950" alt="license"></a>
</div>

<br>

Context and event factories for [actharness](https://github.com/theobassan/actharness). Produces complete, internally-consistent GitHub Actions contexts and webhook payloads with documented defaults.

## Usage

```ts
import { github, runner, pushEvent } from '@actharness/fixtures';

// Build a complete github context, overriding just what the test cares about
const ctx = github({ repository: 'my-org/my-action', event_name: 'push' });

// Build a push event payload
const event = pushEvent({ ref: 'refs/heads/main' });

const result = await action.run({
  github: ctx,
  eventPayload: event,
});
```

## Context factories

```ts
github(overrides?)   // → GitHubContext  (all fields from ${{ github.* }})
runner(overrides?)   // → RunnerContext  (all fields from ${{ runner.* }})
```

## Event factories

```ts
pushEvent(overrides?)
pullRequestEvent(overrides?)
workflowDispatchEvent(overrides?)
issueEvent(overrides?)
releaseEvent(overrides?)
```

## Raw defaults

```ts
import { GITHUB_DEFAULTS, RUNNER_DEFAULTS } from '@actharness/fixtures';
```

All default values match the documented [CONTEXTS.md](../../docs/CONTEXTS.md) schema — the same values `actharness` uses when no context is provided.
