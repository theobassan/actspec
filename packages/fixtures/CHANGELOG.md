# @actharness/fixtures

## 0.1.0

### Minor Changes

- Initial release of `@actharness/fixtures`.

  Factory functions for GitHub Actions contexts and webhook event payloads. Each factory produces a complete, internally-consistent object with documented defaults — override only the fields your test actually cares about.

  **Context factories:**

  ```ts
  import { github, runner } from 'actharness';

  const ctx = github({ repository: 'my-org/my-action', event_name: 'push' });
  const env = runner({ os: 'Linux' });
  ```

  **Event payload factories:**

  ```ts
  import {
    pushEvent,
    pullRequestEvent,
    workflowDispatchEvent,
    issueEvent,
    releaseEvent,
  } from 'actharness';

  const event = pushEvent({ ref: 'refs/heads/main' });
  const prEvent = pullRequestEvent({ action: 'opened', number: 42 });
  ```

  **Raw defaults:**

  `GITHUB_DEFAULTS` and `RUNNER_DEFAULTS` are exported as the single source of truth for default context values — the same values actharness uses when no context is provided to `action.run()`. All default values match the documented context schema.

### Patch Changes

- Updated dependencies
  - @actharness/types@0.1.0
