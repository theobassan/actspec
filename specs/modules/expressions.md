# `@actharness/expressions`

The `${{ … }}` engine. **Standalone** (zero `@actharness/*` deps) and independently publishable — it's valuable to the wider community. The hardest module, and the one most likely to be subtly wrong; it is spec'd from source truth, not memory.

## Owns (public types)
[API.md §7](../../docs/API.md): `evaluate`, `evaluateTemplate`, `tokenize`, `parse`, `ExpressionContexts`, `ExprValue`.

## Depends on
Nothing (no `@actharness/*`, ideally no runtime deps).

## Behavior (MUST)
**The complete normative spec is [docs/EXPRESSIONS.md](../../docs/EXPRESSIONS.md).** It is binding. Highlights that trip up every naïve port (all grounded in the C# runner source):
- String→number ≈ JS `Number()` incl. **hex/octal** (`'0xff'`→255); `''`→0; else `NaN`.
- Number→string is **C# `"G15"`** (uppercase E, ≤15 sig digits); array→`'Array'`, object→`'Object'`.
- `==`/`<`/`>` on **same-type strings** are `OrdinalIgnoreCase` (not number-coerced); object equality is **reference**.
- `&&`/`||` **return the operand**; truthiness: `0`/`NaN`/`''`/`null` falsy, `'false'`/`'0'`/empty-collections truthy.
- `Infinity`/`NaN` are real value-literals; function names match case-insensitively; SDK funcs + a runtime-registered tier (`hashFiles`, status fns).
- Missing dereference → `null` (never throw); object filters `.*`/`[*]` → array.

`ExpressionContexts.functions` MUST allow the runtime to register/override functions (e.g. a deterministic `hashFiles`, or the status functions).

## Acceptance
- **Conformance corpus green** — every case in [corpus/expressions/](../../corpus/expressions/). The committed file is a 149-vector seed; **v0.0 harvests the full vendored vector tables** (the C# runner's + `nektos/act`'s expression test cases, as data) and the engine MUST be green on the complete set — not just the seed (`$number` sentinel for NaN/Infinity). **This is the gate.**
- **Parser/eval fuzzing** against the grammar *(part of the gate)* — no crashes; balanced errors for malformed input.
- **Differential vs act** *(optional, non-blocking — not a v0.0 gate)* — generate inputs, run this engine and `nektos/act`, diff results; investigate divergences (act's object-compare *throw* is a known act bug — follow the runner). Excluded from the gate because act needs an external Go binary and is an imperfect oracle; the vendored tables are the authoritative ground truth. Same ongoing bucket as fuzzing.
- **Template typing** — a bare `${{ fromJSON('{"a":1}') }}` preserves the object; mixed text coerces to string (with `Array`/`Object`/G15 rules).

## Done-when
**Full vendored corpus + fuzz green in CI**; public types equal API.md §7; zero runtime deps; **v0.0 completes the harvest** of the full act/runner vector set into the corpus (provenance in [corpus NOTICE](../../corpus/expressions/NOTICE)); live differential-vs-act remains an optional, non-blocking extra.
