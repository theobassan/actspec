import * as vscode from 'vscode';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ts from 'typescript';

const DEFAULT_PATTERNS = ['**/*.{actharness,test}.ts'];

export async function discoverWorkspace(
  ctrl: vscode.TestController,
  loadPatternsImpl: (root: string) => Promise<string[]> = loadPatterns,
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return;

  const folder = folders[0]!;
  const workspaceRoot = folder.uri.fsPath;
  const patterns = await loadPatternsImpl(workspaceRoot);

  const seen = new Set<string>();
  for (const pattern of patterns) {
    const uris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, pattern),
      '**/node_modules/**',
    );
    for (const uri of uris) {
      const key = uri.toString();
      if (!seen.has(key)) {
        seen.add(key);
        await discoverFile(ctrl, uri);
      }
    }
  }
}

export async function discoverFile(
  ctrl: vscode.TestController,
  uri: vscode.Uri,
): Promise<void> {
  const fileId = uri.toString();
  ctrl.items.delete(fileId);

  let source: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    source = Buffer.from(bytes).toString('utf8');
  } catch {
    return;
  }

  const fileItem = ctrl.createTestItem(fileId, path.basename(uri.fsPath), uri);
  fileItem.canResolveChildren = false;

  const sourceFile = ts.createSourceFile(uri.fsPath, source, ts.ScriptTarget.Latest, true);
  visitChildren(sourceFile, fileItem, fileItem, uri, sourceFile, ctrl, '');

  ctrl.items.add(fileItem);
}

// ── AST traversal ─────────────────────────────────────────────────────────────

function visitChildren(
  node: ts.Node,
  parent: vscode.TestItem,
  fileItem: vscode.TestItem,
  uri: vscode.Uri,
  sourceFile: ts.SourceFile,
  ctrl: vscode.TestController,
  titlePath: string,
): void {
  ts.forEachChild(node, (child) => {
    visitNode(child, parent, fileItem, uri, sourceFile, ctrl, titlePath);
  });
}

function visitNode(
  node: ts.Node,
  parent: vscode.TestItem,
  fileItem: vscode.TestItem,
  uri: vscode.Uri,
  sourceFile: ts.SourceFile,
  ctrl: vscode.TestController,
  titlePath: string,
): void {
  if (ts.isCallExpression(node)) {
    const info = extractTestCall(node);
    if (info) {
      const { kind, name } = info;
      const fullTitle = titlePath ? `${titlePath} > ${name}` : name;
      const id = `${fileItem.id}::${fullTitle}`;

      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const item = ctrl.createTestItem(id, name, uri);
      item.range = new vscode.Range(
        new vscode.Position(start.line, start.character),
        new vscode.Position(end.line, end.character),
      );
      parent.children.add(item);

      if (kind === 'describe') {
        const callback = node.arguments[1];
        if (callback) {
          const body = getFunctionBody(callback);
          if (body) {
            visitChildren(body, item, fileItem, uri, sourceFile, ctrl, fullTitle);
          }
        }
      }
      return;
    }
  }

  ts.forEachChild(node, (child) => {
    visitNode(child, parent, fileItem, uri, sourceFile, ctrl, titlePath);
  });
}

interface TestCallInfo {
  kind: 'describe' | 'test' | 'it';
  name: string;
}

function extractTestCall(node: ts.CallExpression): TestCallInfo | null {
  const callee = node.expression;
  let kind: 'describe' | 'test' | 'it';

  if (ts.isIdentifier(callee)) {
    const name = callee.text;
    if (name === 'describe' || name === 'test' || name === 'it') {
      kind = name;
    } else {
      return null;
    }
  } else if (ts.isPropertyAccessExpression(callee)) {
    if (!ts.isIdentifier(callee.expression)) return null;
    const base = callee.expression.text;
    const prop = callee.name.text;
    if ((base === 'describe' || base === 'test' || base === 'it') && prop === 'skip') {
      kind = base;
    } else {
      return null;
    }
  } else {
    return null;
  }

  const firstArg = node.arguments[0];
  if (!firstArg || !ts.isStringLiteral(firstArg)) return null;

  return { kind, name: firstArg.text };
}

function getFunctionBody(node: ts.Expression): ts.ConciseBody | null {
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    return node.body;
  }
  return null;
}

// ── Config loading ─────────────────────────────────────────────────────────────

export async function loadPatterns(
  workspaceRoot: string,
  importFn: (url: string) => Promise<unknown> = (url) => import(url),
): Promise<string[]> {
  try {
    const cliConfigPath = path.join(
      workspaceRoot,
      'node_modules',
      '@actharness',
      'cli',
      'dist',
      'config.js',
    );
    const mod = (await importFn(pathToFileURL(cliConfigPath).href)) as {
      loadConfig: (cwd: string) => Promise<{ patterns?: string[] }>;
    };
    const config = await mod.loadConfig(workspaceRoot);
    if (config.patterns?.length) return config.patterns;
  } catch {
    // actharness not installed or config failed — use defaults
  }
  return DEFAULT_PATTERNS;
}
