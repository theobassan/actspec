import * as vscode from 'vscode';
import { discoverFile, discoverWorkspace } from './discover.js';

export function createWatcher(ctrl: vscode.TestController): vscode.Disposable {
  const testWatcher = vscode.workspace.createFileSystemWatcher(
    '**/*.{actharness,test}.ts',
  );
  testWatcher.onDidCreate((uri) => void discoverFile(ctrl, uri));
  testWatcher.onDidChange((uri) => void discoverFile(ctrl, uri));
  testWatcher.onDidDelete((uri) => ctrl.items.delete(uri.toString()));

  const configWatcher = vscode.workspace.createFileSystemWatcher(
    '**/actharness.config.{ts,js,json}',
  );
  configWatcher.onDidCreate(() => void discoverWorkspace(ctrl));
  configWatcher.onDidChange(() => void discoverWorkspace(ctrl));
  configWatcher.onDidDelete(() => void discoverWorkspace(ctrl));

  return vscode.Disposable.from(testWatcher, configWatcher);
}
