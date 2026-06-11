<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1><code>@actharness/matchers</code></h1>
  <p>Assertion matchers for actharness.</p>
  <a href="https://www.npmjs.com/package/@actharness/matchers"><img src="https://img.shields.io/npm/v/@actharness/matchers?color=3fb950&label=npm" alt="npm"></a>
  <a href="https://github.com/actharness/actharness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-3fb950" alt="license"></a>
</div>

<br>

Assertion matchers for [actharness](https://github.com/theobassan/actharness) — runs inside `actharness test` or any Node test runner.

## Usage

When running via `actharness test`, `expect` is available globally with no imports needed:

```ts
const result = await actharness('./action.yml').run({ inputs: { name: 'World' } });

expect(result).toHaveSucceeded();
expect(result).toHaveOutput('greeting', 'Hello, World!');
expect(result).toHaveStepSucceeded('build');
expect(result.step('build')).toHaveStdoutContaining('Building...');
```

For direct use outside `actharness test`:

```ts
import { expect } from '@actharness/matchers';
```

## Result matchers

```ts
expect(result).toHaveSucceeded()
expect(result).toHaveFailed()
expect(result).toHaveOutput(name, value)
expect(result).toHaveStep(id)               // step ran (not skipped)
expect(result).toHaveStepSucceeded(id)
expect(result).toHaveStepFailed(id)
expect(result).toHaveStepSkipped(id)
expect(result).toHaveStepOutput(id, name, value)
expect(result).toHaveAnnotation({ level?, message? })
```

## Step matchers

```ts
// Pass result.step('id') directly — if the step is absent, all matchers throw
// "Expected step to exist, but step was not found"
expect(result.step('build')).toHaveSucceeded()
expect(result.step('build')).toHaveFailed()
expect(result.step('build')).toHaveOutput(name, value)
expect(result.step('build')).toHaveAnnotation({ level?, message? })
expect(result.step('build')).toHaveStdoutContaining(substring)
expect(result.step('build')).toHaveStderrContaining(substring)
```

## Mock matchers

```ts
const checkout = actharness.mock('actions/checkout@v4');

expect(checkout).toHaveBeenCalled()
expect(checkout).toHaveBeenCalledTimes(2)
expect(checkout).toHaveBeenCalledWith({ ref: 'main' })
```

## Negation

Every matcher supports `.not`:

```ts
expect(result).not.toHaveSucceeded()
expect(checkout).not.toHaveBeenCalled()
```
