// Runner bridge — spawned as a subprocess by the VSCode extension.
// Usage: node --import tsx/esm --import register.js runner-bridge.js
//   --files a.ts,b.ts [--pattern regex] --register-url <url> --tsx-esm-url <url>

import { run } from 'node:test';
import { parseRunnerBridgeArgs } from './runner-bridge-args.js';

const { files, pattern, registerUrl, tsxEsmUrl } = parseRunnerBridgeArgs(process.argv.slice(2));
const execArgv = ['--import', tsxEsmUrl, '--import', registerUrl];
const stream = run({
  files,
  execArgv,
  ...(pattern ? { testNamePatterns: [pattern] } : {}),
} as Parameters<typeof run>[0]);

for await (const event of stream) {
  process.stdout.write(JSON.stringify(event) + '\n');
}
