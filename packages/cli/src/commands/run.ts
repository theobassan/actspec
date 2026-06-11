// actharness run — execute a composite action from the CLI.

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { actharness, globalMock } from '@actharness/core';
import type { ActionMockDef, RunResult } from '@actharness/types';

// Side-effectful: registers the composite executor.
import '@actharness/composite';

export interface RunOptions {
  actionPath: string;
  inputs: Record<string, string>;
  mocks: Array<{ ref: string; def: ActionMockDef }>;
  mockFile: string | undefined;
  setupFile: string | undefined;
  eventName: string | undefined;
  json: boolean;
}

export function parseRunArgs(args: string[]): RunOptions | string {
  const inputs: Record<string, string> = {};
  const mocks: Array<{ ref: string; def: ActionMockDef }> = [];
  let mockFile: string | undefined;
  let setupFile: string | undefined;
  let eventName: string | undefined;
  let json = false;
  let actionPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--input' && i + 1 < args.length) {
      const pair = args[++i]!;
      const eq = pair.indexOf('=');
      if (eq !== -1) {
        inputs[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    } else if (arg === '--mock' && i + 1 < args.length) {
      const pair = args[++i]!;
      const eq = pair.indexOf('=');
      if (eq !== -1) {
        const ref = pair.slice(0, eq);
        const jsonStr = pair.slice(eq + 1);
        try {
          const def = JSON.parse(jsonStr) as ActionMockDef;
          mocks.push({ ref, def });
        } catch {
          return `actharness: invalid JSON for --mock ${ref}: ${jsonStr}`;
        }
      }
    } else if (arg === '--mock-file' && i + 1 < args.length) {
      mockFile = resolve(process.cwd(), args[++i]!);
    } else if (arg === '--setup' && i + 1 < args.length) {
      setupFile = resolve(process.cwd(), args[++i]!);
    } else if (arg === '--event' && i + 1 < args.length) {
      eventName = args[++i];
    } else if (arg === '--record') {
      return 'actharness: --record/replay is deferred — not available in v0.1';
    } else if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('--')) {
      actionPath = arg;
    }
  }

  if (!actionPath) {
    return 'actharness: run requires an action path (e.g. actharness run ./action.yml)';
  }

  return {
    actionPath: resolve(process.cwd(), actionPath),
    inputs,
    mocks,
    mockFile,
    setupFile,
    eventName,
    json,
  };
}

export function parseMockFile(content: string): Array<{ ref: string; def: ActionMockDef }> {
  const doc = parseYaml(content) as Record<string, unknown> | null;
  const mocks: Array<{ ref: string; def: ActionMockDef }> = [];

  if (doc && typeof doc === 'object' && 'uses' in doc && doc['uses']) {
    const uses = doc['uses'] as Record<string, unknown>;
    for (const [ref, defRaw] of Object.entries(uses)) {
      mocks.push({ ref, def: defRaw as ActionMockDef });
    }
  }

  return mocks;
}

export function printHumanResult(result: RunResult): void {
  const icon = result.conclusion === 'success' ? '✓' : '✗';
  console.log(`${icon} ${result.conclusion}`);

  if (Object.keys(result.outputs).length > 0) {
    console.log('\nOutputs:');
    for (const [k, v] of Object.entries(result.outputs)) {
      console.log(`  ${k}: ${v}`);
    }
  }

  if (result.steps.length > 0) {
    console.log('\nSteps:');
    for (const step of result.steps) {
      const stepIcon = step.conclusion === 'success' ? '✓' : step.conclusion === 'skipped' ? '-' : '✗';
      console.log(`  ${stepIcon} ${step.name || step.id} (${step.conclusion})`);
    }
  }

  if (result.annotations.length > 0) {
    console.log('\nAnnotations:');
    for (const ann of result.annotations) {
      console.log(`  [${ann.level}] ${ann.message}`);
    }
  }
}

export async function runCommand(args: string[]): Promise<number> {
  const opts = parseRunArgs(args);
  if (typeof opts === 'string') {
    console.error(opts);
    return 1;
  }

  const { actionPath, inputs, mocks, mockFile, setupFile, eventName, json } = opts;
  const action = actharness(actionPath);

  for (const { ref, def } of mocks) {
    globalMock(ref, def);
  }

  if (mockFile) {
    try {
      const content = readFileSync(mockFile, 'utf8');
      const fileMocks = parseMockFile(content);
      for (const { ref, def } of fileMocks) {
        globalMock(ref, def);
      }
    } catch (err) {
      console.error(`actharness: failed to load mock file ${mockFile}: ${String(err)}`);
      return 1;
    }
  }

  if (setupFile) {
    try {
      const mod = await import(setupFile) as Record<string, unknown>;
      const setupFn = mod['default'] ?? mod['setup'];
      if (typeof setupFn === 'function') {
        await (setupFn as () => Promise<void>)();
      }
    } catch (err) {
      console.error(`actharness: failed to load setup file ${setupFile}: ${String(err)}`);
      return 1;
    }
  }

  const runInput: import('@actharness/types').RunInput = {};
  if (Object.keys(inputs).length > 0) runInput.inputs = inputs;
  if (eventName) runInput.github = { event_name: eventName };

  try {
    const result = await action.run(runInput);
    if (json) {
      console.log(
        JSON.stringify(
          {
            conclusion: result.conclusion,
            outputs: result.outputs,
            steps: result.steps,
            env: result.env,
            annotations: result.annotations,
            stdout: result.stdout,
            stderr: result.stderr,
          },
          null,
          2,
        ),
      );
    } else {
      printHumanResult(result);
    }
    return result.conclusion === 'success' ? 0 : 1;
  } catch (err) {
    console.error(`actharness: action failed: ${String(err)}`);
    return 1;
  }
}
