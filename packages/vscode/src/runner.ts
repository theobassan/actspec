import * as vscode from 'vscode';
import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createResultParser } from './result-parser.js';

export async function runTests(
  run: vscode.TestRun,
  items: vscode.TestItem[],
  token: vscode.CancellationToken,
  filter?: string,
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    run.appendOutput('actharness: no workspace folder found\r\n');
    return;
  }
  const workspaceRoot = folders[0]!.uri.fsPath;
  const cliDir = path.join(workspaceRoot, 'node_modules', '@actharness', 'cli');
  const bridgePath = path.join(cliDir, 'dist', 'runner-bridge.js');
  const registerPath = path.join(cliDir, 'dist', 'register.js');

  if (!existsSync(bridgePath)) {
    run.appendOutput(
      'actharness: not found in node_modules. Run `npm install --save-dev actharness`.\r\n',
    );
    for (const item of items) run.errored(item, new vscode.TestMessage('actharness not installed'));
    return;
  }

  let tsxEsmUrl: string;
  try {
    // resolve tsx/esm relative to the CLI package so it uses actharness's own tsx dependency
    const tsxPath = createRequire(import.meta.url).resolve('tsx/esm', { paths: [cliDir] });
    tsxEsmUrl = pathToFileURL(tsxPath).href;
  } catch {
    run.appendOutput('actharness: tsx not found in node_modules.\r\n');
    for (const item of items) run.errored(item, new vscode.TestMessage('tsx not found'));
    return;
  }

  const registerUrl = pathToFileURL(registerPath).href;

  // Build lookup map and collect unique files
  const itemsById = new Map<string, vscode.TestItem>();
  const fileSet = new Set<string>();
  for (const item of items) {
    itemsById.set(item.id, item);
    if (item.uri) fileSet.add(item.uri.fsPath);
  }
  const files = [...fileSet];

  for (const item of items) run.started(item);

  const nodeExe =
    vscode.workspace.getConfiguration('actharness').get<string>('nodeExecutable') ?? 'node';

  const spawnArgs = [
    '--import', tsxEsmUrl,
    '--import', registerUrl,
    bridgePath,
    '--files', files.join(','),
    '--register-url', registerUrl,
    '--tsx-esm-url', tsxEsmUrl,
    ...(filter ? ['--pattern', filter] : []),
  ];

  const child = spawn(nodeExe, spawnArgs, {
    cwd: workspaceRoot,
    env: { ...process.env },
  });

  const cancelDisposable = token.onCancellationRequested(() => {
    child.kill('SIGTERM');
    for (const item of items) {
      if (!parser.completedIds.has(item.id)) run.skipped(item);
    }
  });

  const parser = createResultParser(run, itemsById);
  let stdoutBuf = '';
  let stderrBuf = '';

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop()!;
    for (const line of lines) parser.onLine(line);
  });

  child.stderr.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    run.appendOutput(chunk.toString().replace(/\n/g, '\r\n'));
  });

  await new Promise<void>((resolve) => {
    child.on('close', (code) => {
      if (stdoutBuf.trim()) parser.onLine(stdoutBuf);

      // Items not finalized by the parser on non-zero exit are errored
      if (code !== 0 && code !== null) {
        const errMsg = stderrBuf.trim() || `Bridge exited with code ${code}`;
        for (const item of items) {
          if (!parser.completedIds.has(item.id)) {
            run.errored(item, new vscode.TestMessage(errMsg));
          }
        }
      }

      cancelDisposable.dispose();
      resolve();
    });
  });
}
