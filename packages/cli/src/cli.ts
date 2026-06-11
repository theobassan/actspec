// actharness CLI entry — dispatches to subcommands.

import { testCommand } from './commands/test.js';
import { runCommand } from './commands/run.js';
import { initCommand } from './commands/init.js';

const [, , command, ...rest] = process.argv;

let exitCode = 0;
switch (command) {
  case 'test':
    exitCode = await testCommand(rest);
    break;
  case 'run':
    exitCode = await runCommand(rest);
    break;
  case 'init':
    exitCode = await initCommand(rest);
    break;
  case 'types':
    console.error('actharness: types command is deferred — not available in v0.1');
    exitCode = 1;
    break;
  case undefined:
  default:
    console.error(`actharness: unknown command '${command ?? ''}'`);
    console.error('Usage: actharness <test|run|init> [options]');
    exitCode = 1;
}

process.exit(exitCode);
