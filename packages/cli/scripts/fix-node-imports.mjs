// Post-build: esbuild strips `node:` from built-in specifiers when platform=node.
// `node:test` has no bare-name alias, so restoring the prefix is required.
// Applies to both cli.js (imports run) and register.js (imports describe/it/test/…).
import { readFileSync, writeFileSync } from 'node:fs';

for (const file of ['dist/cli.js', 'dist/register.js', 'dist/lifecycle.js', 'dist/runner-bridge.js']) {
  const src = readFileSync(file, 'utf8');
  const fixed = src.replace(/from "test"(\s*;?)/g, 'from "node:test"$1');
  if (fixed === src) {
    console.error('fix-node-imports: pattern not found in', file);
    process.exit(1);
  }
  writeFileSync(file, fixed);
}
