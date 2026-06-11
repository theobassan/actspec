<div align="center">
  <img src="icon.png" width="96" alt="actharness">
  <h1>actharness</h1>
  <p>Unit testing for GitHub Actions — run tests from the VS Code Test Explorer.</p>
</div>

<br>

This extension integrates [actharness](https://github.com/actharness/actharness) with the VS Code Test Explorer, letting you discover, run, and debug GitHub Actions unit tests without leaving your editor.

## Features

- Discover `*.actharness.ts` and `*.test.ts` test files automatically
- Run individual tests or entire suites from the Test Explorer
- See pass/fail inline in the editor gutter
- Re-run tests on file save via the built-in watch mode

## Requirements

- Node.js ≥ 22
- `actharness` installed in your project (`npm install --save-dev actharness`)

## Configuration

| Setting                     | Default | Description                                                        |
| --------------------------- | ------- | ------------------------------------------------------------------ |
| `actharness.nodeExecutable` | `node`  | Path to the Node.js executable. Useful when using `mise` or `nvm`. |

## Getting started

```bash
npm install --save-dev actharness
npx actharness init action.yml   # scaffold action.test.ts
```

Then open the Test Explorer panel and click **Run All**.

## License

[MIT](https://github.com/actharness/actharness/blob/main/LICENSE)
