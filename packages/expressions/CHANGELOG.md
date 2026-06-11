# @actharness/expressions

## 0.1.0

### Minor Changes

- Initial release of `@actharness/expressions`.

  A standalone JavaScript implementation of the [GitHub Actions `${{ }}` expression language](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/evaluate-expressions-in-workflows-and-actions). Zero runtime dependencies — can be used independently of the rest of actharness.

  **Features:**
  - **Expression evaluation** — evaluates logical, comparison, and arithmetic expressions with full GitHub Actions type coercion rules
  - **Template evaluation** — evaluates mixed strings like `"Hello ${{ inputs.name }}!"`, preserving the native type when the template is a single expression block
  - **Context access** — resolves `github.*`, `inputs.*`, `steps.*`, `env.*`, and any other context object you provide
  - **Full function library** — `contains`, `startsWith`, `endsWith`, `format`, `join`, `toJSON`, `fromJSON`, `hashFiles`, and all other built-in functions
  - **`hashFiles` override** — the default implementation reads from `GITHUB_WORKSPACE`; override per-call for deterministic tests
  - **Error reporting** — throws typed `ExpressionError` with descriptive messages for unknown functions, type errors, and parse failures
  - **Lower-level access** — `tokenize()` and `parse()` exposed for tooling use cases

  **Conformance:**

  Tested against a 443-vector corpus derived from `nektos/act`'s expression test suite, plus property fuzz tests with fast-check. Matches the C# `actions/runner` behavior for all known edge cases.
