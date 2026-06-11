import * as vscode from 'vscode';
import { discoverFile, discoverWorkspace } from './discover.js';
import { runTests } from './runner.js';
import { createWatcher } from './watcher.js';

export function activate(context: vscode.ExtensionContext): void {
  const ctrl = vscode.tests.createTestController('actharness', 'actharness');
  context.subscriptions.push(ctrl);

  ctrl.createRunProfile(
    'Run',
    vscode.TestRunProfileKind.Run,
    (request, token) => void runHandler(ctrl, request, token),
    true,
  );

  ctrl.resolveHandler = async (item) => {
    if (item?.uri) {
      await discoverFile(ctrl, item.uri);
    } else {
      await discoverWorkspace(ctrl);
    }
  };

  void discoverWorkspace(ctrl);

  const watcher = createWatcher(ctrl);
  context.subscriptions.push(watcher);
}

export function deactivate(): void {}

async function runHandler(
  ctrl: vscode.TestController,
  request: vscode.TestRunRequest,
  token: vscode.CancellationToken,
): Promise<void> {
  const run = ctrl.createTestRun(request);

  // Collect all leaf test items that will actually run
  const items: vscode.TestItem[] = [];
  if (request.include) {
    for (const item of request.include) collectLeaves(item, items);
  } else {
    ctrl.items.forEach((item) => collectLeaves(item, items));
  }

  // Build pattern filter when a single item (not a file root) is selected
  let filter: string | undefined;
  if (request.include?.length === 1) {
    const selected = request.include[0]!;
    const title = getFullTitle(selected);
    if (title) {
      const isLeaf = selected.children.size === 0;
      filter = isLeaf ? `^${escapeRegex(title)}$` : `^${escapeRegex(title)}`;
    }
  }

  try {
    await runTests(run, items, token, filter);
  } finally {
    run.end();
  }
}

export function collectLeaves(item: vscode.TestItem, out: vscode.TestItem[]): void {
  if (item.children.size === 0) {
    out.push(item);
  } else {
    item.children.forEach((child) => collectLeaves(child, out));
  }
}

export function getFullTitle(item: vscode.TestItem): string {
  // File-level items have no parent — return '' so no pattern is added
  if (!item.parent) return '';
  const parts: string[] = [item.label];
  let current: vscode.TestItem | undefined = item.parent;
  while (current?.parent) {
    parts.unshift(current.label);
    current = current.parent;
  }
  return parts.join(' > ');
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
