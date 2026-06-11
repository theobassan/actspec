# actharness — Roadmap

> Thinking space for what's done, what's next, and what's deliberately deferred. Complements the version specs in `specs/versions/` (detail), [ARCHITECTURE.md](ARCHITECTURE.md) (design), and [DECISIONS.md](DECISIONS.md) (rationale).

---

## Version milestones

| Version | Status | Adds | Coverage gained |
|---------|--------|------|-----------------|
| **v0.0** | published | `@actharness/expressions` standalone — full engine, corpus (459 vectors), fuzz CI | none (no test framework yet) |
| **v0.1** | in progress | `using: composite` — ShellSandbox, conformance corpus, CLI (`actharness test` / `actharness run` / `actharness init`) | step · `if:`-branch · input/default · output |
| **v0.2** | planned | `using: node20/24/…` — JsSandbox, net mock | + JS line + branch coverage (V8/Istanbul) |
| **v0.3** | planned | `using: docker` — ContainerSandbox (mock / docker / podman backends) | (Docker actions covered as steps) |
| **v0.4** | planned | Workflows — WorkflowRunner, job DAG, matrix, reusable workflows | + job coverage · `needs:` edges |
| **v0.5+** | future | Future `using:` types; new executors | inherits step + branch free |

---

## Coverage roadmap

The coverage layer is **cross-cutting** — it ships in v0.1 and deepens as executors are added. Each layer is independent; a missing layer doesn't block others.

| Layer | Metric | Status | Notes |
|-------|--------|--------|-------|
| Step coverage | `steps` | ✅ v0.1 | which steps ran vs were skipped |
| `if:`-branch coverage | `ifBranches` | ✅ v0.1 | each `if:` seen both true AND false |
| Input/default coverage | `inputs` | ✅ v0.1 | declared inputs + defaults exercised |
| Output coverage | `outputs` | ✅ v0.1 | declared outputs actually produced |
| JS line + branch coverage | `jsLines` | v0.2 | V8 inspector API inside JsSandbox worker; near-free via Istanbul |
| Job coverage | `jobs` | v0.4 | workflow jobs run/skipped; `needs:` edges taken |
| Bash line/branch coverage | — | opt-in, hard | lines/branches inside `run:` scripts; see [Bash coverage](#bash-coverage) below |
| Expression sub-branch | — | later, hard | sub-conditions inside `${{ a && b \|\| c }}`; needs AST instrumentation in `@actharness/expressions` |

---

## Deferred features

Explicitly deferred — not forgotten. The seams support them; they ship when the core is validated and trusted.

| Feature | Rationale |
|---------|-----------|
| `@actharness/gen` — typed-action codegen (`action.yml` → `Action<In, Out>`) | Post-v0.1; depends on a stable public surface |
| CLI `--record` / replay | Useful but not v0.1-blocking |
| Hardened isolation (`isolation: vm \| container \| deny-net`) | Opt-in upgrade path; default is hermeticity for determinism, not containment |
| Bash line/branch coverage | Opt-in, hard; see below |

---

## Bash coverage

Shell script coverage (lines and branches inside `run:` steps) is the one coverage layer with no clean "free" path.

### Options

| Approach | Coverage | Cross-platform | External dep |
|----------|----------|:-:|:-:|
| `kcov` (ptrace + DWARF) | lines + branches | Linux only | system binary |
| `bashcov` (Ruby DEBUG trap) | lines only | Linux/macOS | Ruby |
| `PS4` + `set -x` trace parsing | lines only, rough | all shells | none |
| Build from scratch (TS bash parser + instrumenter) | lines + branches | all shells | none |

Building from scratch is project-scale: bash grammar is ambiguous and context-sensitive, requiring a full parser and source-mapping back to the original YAML line ranges. Integration with an existing tool (`kcov`) is the pragmatic path.

### Current decision

Keep as-is — opt-in, hard, not scheduled in any version milestone yet.

### Open questions (to resolve before scheduling)

- Is `kcov` an acceptable system dependency, or must bash coverage be zero-dep?
- Is line-only coverage (DEBUG trap) sufficient, or is if/else branch coverage required?
- How do we map tool output back to `action.yml` YAML line ranges? The script is extracted from YAML, so line numbers don't directly correspond.
- Does this belong in actharness proper or as a separately installable plugin?
