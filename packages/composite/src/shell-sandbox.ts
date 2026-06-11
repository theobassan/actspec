// ShellSandbox — implements SandboxFactory by spawning child processes.
// Writes the script to a temp file, runs the shell, captures stdout/stderr.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SandboxFactory, ShellSandboxOptions, ShellSandboxResult } from '@actharness/core';

function buildShellArgv(shell: string, scriptPath: string): { bin: string; args: string[] } {
  const normalized = shell.trim();
  if (normalized === 'bash') {
    return { bin: 'bash', args: ['--noprofile', '--norc', '-eo', 'pipefail', scriptPath] };
  }
  if (normalized === 'sh') {
    return { bin: 'sh', args: ['-e', scriptPath] };
  }
  if (normalized === 'pwsh' || normalized === 'powershell') {
    return { bin: 'pwsh', args: ['-NonInteractive', '-command', `. '${scriptPath}'`] };
  }
  if (normalized === 'python' || normalized === 'python3') {
    return { bin: normalized, args: [scriptPath] };
  }
  if (normalized === 'node') {
    return { bin: 'node', args: [scriptPath] };
  }
  // Custom shell with {0} placeholder
  if (normalized.includes('{0}')) {
    const expanded = normalized.replace('{0}', scriptPath);
    const parts = expanded.split(' ');
    return { bin: parts[0]!, args: parts.slice(1) };
  }
  return { bin: normalized, args: [scriptPath] };
}

export class ShellSandbox implements SandboxFactory {
  async shell(opts: ShellSandboxOptions): Promise<ShellSandboxResult> {
    const scriptDir = mkdtempSync(join(tmpdir(), 'actharness-script-'));
    const ext = (opts.shell === 'python' || opts.shell === 'python3') ? '.py'
      : opts.shell === 'node' ? '.js'
      : '.sh';
    const scriptPath = join(scriptDir, `script${ext}`);

    writeFileSync(scriptPath, opts.script, { mode: 0o700 });

    const { bin, args } = buildShellArgv(opts.shell, scriptPath);

    return new Promise<ShellSandboxResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(bin, args, {
        env: { ...process.env, ...opts.env },
        cwd: opts.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });

      let timer: ReturnType<typeof setTimeout> | undefined;
      if (opts.timeout) {
        timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 2_000);
        }, opts.timeout);
      }

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        rmSync(scriptDir, { recursive: true, force: true });
        resolve({
          exitCode: timedOut ? 124 : (code ?? 1),
          stdout,
          stderr,
          timedOut,
        });
      });
    });
  }
}
