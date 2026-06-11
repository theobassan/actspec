# @actharness/coverage

## 0.1.0

### Minor Changes

- Initial release of `@actharness/coverage`.

  Istanbul-compatible coverage for `action.yml` files. Observes every `action.run()` via the `@actharness/core` run sink and aggregates results across the full suite — zero changes to how tests are written.

  **Coverage metrics:**

  | Metric       | What it tracks                                                        |
  | ------------ | --------------------------------------------------------------------- |
  | `steps`      | Which steps executed vs. were skipped by `if:` conditions             |
  | `ifBranches` | Each `if:` condition seen as both `true` and `false` across the suite |
  | `inputs`     | Which declared inputs and their defaults were exercised               |

  **CLI usage:**

  ```bash
  actharness test --coverage
  actharness test --coverage --reporter lcov,html,text --threshold steps=100 --threshold ifBranches=80
  ```

  **Reporters:**

  Full Istanbul reporter set is supported: `text`, `text-summary`, `html`, `html-spa`, `lcov`, `lcovonly`, `cobertura`, `clover`, `teamcity`, `json`, `json-summary`. Output is Istanbul-compatible — `coverage-final.json` can be merged with other coverage via `nyc merge`.

  **`if:` branch visibility:**

  The coverage report exposes a truth table per step showing which `if:` conditions were seen as `true`, seen as `false`, or never exercised — making it easy to identify untested skip paths in your action.

  **Include / exclude:**

  Files matching `include` that were never executed appear in the report at 0%, making untested action files visible in CI. Files matching `exclude` are removed from the report entirely.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @actharness/core@0.1.0
  - @actharness/types@0.1.0
