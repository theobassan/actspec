// Unit tests for ShellSandbox — real shell processes (sh, python3, node, {0}, timeout).
// No mocking: all processes run for real on this machine.

import { describe, it, expect } from 'vitest';
import { ShellSandbox } from '../src/shell-sandbox.js';

describe('ShellSandbox — shell types (real processes)', () => {
  it('sh shell runs a script', async () => {
    const sandbox = new ShellSandbox();
    const result = await sandbox.shell({ script: 'echo hello', shell: 'sh', env: {}, cwd: '/' });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.timedOut).toBe(false);
  });

  it('python3 shell runs a .py script', async () => {
    const sandbox = new ShellSandbox();
    const result = await sandbox.shell({
      script: 'print("hello from python")',
      shell: 'python3',
      env: {},
      cwd: '/',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello from python');
  });

  it('node shell runs a .js script', async () => {
    const sandbox = new ShellSandbox();
    const result = await sandbox.shell({
      script: 'console.log("hello from node")',
      shell: 'node',
      env: {},
      cwd: '/',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello from node');
  });

  it('custom {0} shell expands the script path placeholder', async () => {
    const sandbox = new ShellSandbox();
    const result = await sandbox.shell({
      script: 'echo from-custom',
      shell: 'bash {0}',
      env: {},
      cwd: '/',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('from-custom');
  });

  it('fallthrough: unrecognised shell name is used as-is', async () => {
    const sandbox = new ShellSandbox();
    const result = await sandbox.shell({
      script: 'echo fallthrough',
      shell: '/bin/sh',
      env: {},
      cwd: '/',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('fallthrough');
  });

  it('sends SIGKILL when process survives SIGTERM (covers SIGKILL fallback)', async () => {
    const sandbox = new ShellSandbox();
    // trap ignores SIGTERM; sleep redirects its stdio so it doesn't hold the pipe
    // open after sh is SIGKILL'd — pipe closes when sh dies, triggering close event
    const result = await sandbox.shell({
      script: 'trap "" TERM; sleep 10 >/dev/null 2>&1',
      shell: 'sh',
      env: {},
      cwd: '/',
      timeout: 100,
    });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
  }, 10_000);

  it('captures stderr output from real shell', async () => {
    const sandbox = new ShellSandbox();
    const result = await sandbox.shell({ script: 'echo errtext >&2', shell: 'sh', env: {}, cwd: '/' });
    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe('errtext');
  });

  it('timeout: timedOut=true and exitCode=124 when script exceeds timeout', async () => {
    const sandbox = new ShellSandbox();
    // exec replaces sh with sleep directly so SIGTERM reaches the sleep process and
    // the pipe closes immediately — avoids orphaned grandchild holding the pipe open.
    const result = await sandbox.shell({
      script: 'exec sleep 100',
      shell: 'sh',
      env: {},
      cwd: '/',
      timeout: 50,
    });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
  }, 10_000);
});
