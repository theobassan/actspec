# @actharness/composite

## 0.1.0

### Minor Changes

- Initial release of `@actharness/composite`.

  The composite action executor. Handles `runs.using: composite` actions end-to-end — self-registering into `@actharness/core`'s executor registry on import so no explicit wiring is needed.

  **What it handles:**
  - **Step loop** — iterates steps in order, evaluating `if:` conditions via `@actharness/expressions`, respecting `continue-on-error`, and stopping on failure
  - **Shell execution** — spawns `bash`, `sh`, `pwsh`, and other shells inside a hermetic `ShellSandbox` with correct env scoping and working-directory isolation
  - **`uses:` dispatch** — delegates to `@actharness/core`'s mock resolver: replays registered mocks, recurses into local actions, or no-ops unknown remote refs
  - **Env-file threading** — reads `$GITHUB_OUTPUT`, `$GITHUB_ENV`, `$GITHUB_PATH` after each step and propagates the results into the context for subsequent steps
  - **Action outputs** — evaluates `outputs.<name>.value` expressions against the final `steps` context once all steps have completed

  No public API — import the package as a side effect to activate the executor:

  ```ts
  import '@actharness/composite';
  ```

  If you use the `actharness` meta package, this is already included.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @actharness/core@0.1.0
  - @actharness/types@0.1.0
