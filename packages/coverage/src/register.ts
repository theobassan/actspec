// Side-effectful register — subscribes to @actharness/core run sink and flushes on exit.
// Import '@actharness/coverage/register' to activate coverage collection.

import { registerRunListener } from '@actharness/core';
import { CoverageCollector } from './collector.js';

const COVERAGE_DIR = process.env['ACTHARNESS_COVERAGE_DIR'] ?? '.actharness-coverage';

const collector = new CoverageCollector();
registerRunListener(collector.createListener());

// Flush on process exit so coverage is available even if process terminates unexpectedly
process.on('exit', () => {
  try {
    collector.flush(COVERAGE_DIR);
  } catch {
    // best-effort
  }
});

export { collector };
