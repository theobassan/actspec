import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tests, Uri, workspace } from 'vscode';
import { discoverFile, discoverWorkspace, loadPatterns } from '../src/discover.js';

function makeCtrl() {
  return tests.createTestController('test', 'test');
}

function makeUri(fsPath: string) {
  return Uri.file(fsPath);
}

function source(code: string) {
  return new TextEncoder().encode(code);
}

describe('discoverFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers a top-level it() call', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`it('greets', () => {})`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem).toBeDefined();
    const child = fileItem!.children.get(`${uri.toString()}::greets`);
    expect(child).toBeDefined();
    expect(child!.label).toBe('greets');
  });

  it('discovers a top-level test() call', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`test('runs', () => {})`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem!.children.get(`${uri.toString()}::runs`)).toBeDefined();
  });

  it('nests it() inside describe()', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`describe('suite', () => { it('passes', () => {}) })`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    const suite = fileItem!.children.get(`${uri.toString()}::suite`);
    expect(suite).toBeDefined();
    const child = suite!.children.get(`${uri.toString()}::suite > passes`);
    expect(child).toBeDefined();
    expect(child!.label).toBe('passes');
  });

  it('discovers describe.skip and it.skip', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`
        describe.skip('skipped suite', () => {})
        it.skip('skipped test', () => {})
        test.skip('skipped test2', () => {})
      `),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem!.children.get(`${uri.toString()}::skipped suite`)).toBeDefined();
    expect(fileItem!.children.get(`${uri.toString()}::skipped test`)).toBeDefined();
    expect(fileItem!.children.get(`${uri.toString()}::skipped test2`)).toBeDefined();
  });

  it('assigns a range to discovered items', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`it('has range', () => {})`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    const child = fileItem!.children.get(`${uri.toString()}::has range`);
    expect(child!.range).toBeDefined();
  });

  it('replaces existing file items on re-discovery', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`it('first', () => {})`),
    );
    await discoverFile(ctrl, uri);

    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`it('second', () => {})`),
    );
    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem!.children.get(`${uri.toString()}::first`)).toBeUndefined();
    expect(fileItem!.children.get(`${uri.toString()}::second`)).toBeDefined();
  });

  it('does nothing when the file cannot be read', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/missing.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));

    await discoverFile(ctrl, uri);

    expect(ctrl.items.get(uri.toString())).toBeUndefined();
  });

  it('ignores dynamic test patterns without crashing', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/dynamic.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`['a','b'].forEach(name => test(name, () => {}))`),
    );

    await expect(discoverFile(ctrl, uri)).resolves.toBeUndefined();
    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem).toBeDefined();
    // No children — dynamic test has no string literal as first arg
    expect(fileItem!.children.size).toBe(0);
  });

  it('handles a describe callback that is not a function expression', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    // describe with a variable reference as callback — not a function literal
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`describe('suite', myFn)`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    // Suite is discovered but no children (callback not parseable as inline function)
    const suite = fileItem!.children.get(`${uri.toString()}::suite`);
    expect(suite).toBeDefined();
    expect(suite!.children.size).toBe(0);
  });

  it('discovers deeply nested describes', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/nested.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`
        describe('outer', () => {
          describe('inner', () => {
            it('deep test', () => {})
          })
        })
      `),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    const outer = fileItem!.children.get(`${uri.toString()}::outer`);
    const inner = outer!.children.get(`${uri.toString()}::outer > inner`);
    const deep = inner!.children.get(`${uri.toString()}::outer > inner > deep test`);
    expect(deep).toBeDefined();
    expect(deep!.label).toBe('deep test');
  });

  it('ignores property-access callees with non-identifier base', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    // obj.method.skip('name', fn) — callee.expression is a PropertyAccessExpression, not Identifier
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`obj.method.skip('should be ignored', () => {})`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem!.children.size).toBe(0);
  });

  it('ignores element-access callees', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    // arr[0]('name', fn) — ElementAccessExpression as callee
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`arr[0]('should be ignored', () => {})`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem!.children.size).toBe(0);
  });

  it('ignores unknown identifier callees', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    // foo('name', fn) — identifier that is not describe/test/it
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`foo('should be ignored', () => {})`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem!.children.size).toBe(0);
  });

  it('ignores property-access with unsupported method', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    // describe.only('name', fn) — prop is 'only', not 'skip'
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`describe.only('should be ignored', () => {})`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    expect(fileItem!.children.size).toBe(0);
  });

  it('discovers describe with no callback argument', async () => {
    const ctrl = makeCtrl();
    const uri = makeUri('/ws/greet.test.ts');
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
      source(`describe('suite')`),
    );

    await discoverFile(ctrl, uri);

    const fileItem = ctrl.items.get(uri.toString());
    const suite = fileItem!.children.get(`${uri.toString()}::suite`);
    expect(suite).toBeDefined();
    expect(suite!.children.size).toBe(0);
  });
});

describe('discoverWorkspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when there are no workspace folders', async () => {
    const ctrl = makeCtrl();
    vi.spyOn(workspace, 'workspaceFolders', 'get').mockReturnValue(undefined);

    await discoverWorkspace(ctrl);

    expect(ctrl.items.size).toBe(0);
  });

  it('discovers files using default patterns', async () => {
    const ctrl = makeCtrl();
    const folder = { uri: Uri.file('/ws'), name: 'ws', index: 0 };
    vi.spyOn(workspace, 'workspaceFolders', 'get').mockReturnValue([folder]);
    const uri = Uri.file('/ws/greet.test.ts');
    vi.spyOn(workspace, 'findFiles').mockResolvedValue([uri]);
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(source(`it('a', () => {})`));

    await discoverWorkspace(ctrl, async () => ['**/*.test.ts']);

    expect(ctrl.items.get(uri.toString())).toBeDefined();
  });

  it('uses custom patterns from loadPatternsImpl', async () => {
    const ctrl = makeCtrl();
    const folder = { uri: Uri.file('/ws'), name: 'ws', index: 0 };
    vi.spyOn(workspace, 'workspaceFolders', 'get').mockReturnValue([folder]);
    const uri = Uri.file('/ws/greet.actharness.ts');
    vi.spyOn(workspace, 'findFiles').mockResolvedValue([uri]);
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(source(`it('b', () => {})`));

    const customLoader = vi.fn().mockResolvedValue(['**/*.actharness.ts']);
    await discoverWorkspace(ctrl, customLoader);

    expect(customLoader).toHaveBeenCalledWith('/ws');
    expect(ctrl.items.get(uri.toString())).toBeDefined();
  });

  it('deduplicates URIs across multiple patterns', async () => {
    const ctrl = makeCtrl();
    const folder = { uri: Uri.file('/ws'), name: 'ws', index: 0 };
    vi.spyOn(workspace, 'workspaceFolders', 'get').mockReturnValue([folder]);
    const uri = Uri.file('/ws/greet.test.ts');
    // findFiles returns the same URI twice (two patterns both match)
    vi.spyOn(workspace, 'findFiles').mockResolvedValue([uri]);
    vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(source(`it('c', () => {})`));

    await discoverWorkspace(ctrl, async () => ['**/*.test.ts', '**/*.actharness.ts']);

    // Only one item added despite being returned by both pattern globs
    let count = 0;
    ctrl.items.forEach(() => count++);
    expect(count).toBe(1);
  });
});

describe('loadPatterns', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns DEFAULT_PATTERNS when importFn throws', async () => {
    const result = await loadPatterns(
      '/ws',
      () => Promise.reject(new Error('not found')),
    );
    expect(result).toEqual(['**/*.{actharness,test}.ts']);
  });

  it('returns DEFAULT_PATTERNS when called with default importFn (no CLI installed)', async () => {
    // Uses the real default importFn which tries to import a nonexistent file URL
    const result = await loadPatterns('/nonexistent-workspace-path-xyz');
    expect(result).toEqual(['**/*.{actharness,test}.ts']);
  });

  it('returns DEFAULT_PATTERNS when config has no patterns', async () => {
    const result = await loadPatterns('/ws', async () => ({
      loadConfig: async () => ({}),
    }));
    expect(result).toEqual(['**/*.{actharness,test}.ts']);
  });

  it('returns custom patterns from config', async () => {
    const result = await loadPatterns('/ws', async () => ({
      loadConfig: async () => ({ patterns: ['**/*.actharness.ts'] }),
    }));
    expect(result).toEqual(['**/*.actharness.ts']);
  });
});
