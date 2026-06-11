# @actharness/types

## 0.1.0

### Minor Changes

- Initial release of `@actharness/types`.

  The zero-dependency DAG root for actharness. Contains all public TypeScript interfaces and the `GITHUB_DEFAULTS` / `RUNNER_DEFAULTS` constants that are the single source of truth for context defaults across the actharness package ecosystem.

  **Exported types:**
  - `RunResult`, `StepResult`, `Annotation`, `ExpressionTrace` — action execution results
  - `RunInput`, `ActharnessOptions`, `Determinism` — inputs and options for `action.run()`
  - `GitHubContext`, `RunnerContext` — the full `${{ github.* }}` and `${{ runner.* }}` context shapes
  - `ActionMock`, `ActionMockDef`, `ActionMockCall`, `ActionMockImpl` — mock definition and call-record types
  - `ShellMock`, `ShellCommandImpl`, `ShellMockResult` — shell command mock types
  - `ParsedAction` — the in-memory model of a parsed `action.yml`

  **Exported constants:**
  - `GITHUB_DEFAULTS` — default `github` context values (repository, ref, event_name, etc.)
  - `RUNNER_DEFAULTS` — default `runner` context values (os, arch, temp, tool_cache, etc.)
