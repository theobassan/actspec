import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tests, Uri } from 'vscode';
import { activate, deactivate, collectLeaves, getFullTitle, escapeRegex } from '../src/extension.js';

vi.mock('../src/discover.js', () => ({
  discoverWorkspace: vi.fn().mockResolvedValue(undefined),
  discoverFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/runner.js', () => ({
  runTests: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/watcher.js', () => ({
  createWatcher: vi.fn().mockReturnValue({ dispose: vi.fn() }),
}));

import { discoverFile, discoverWorkspace } from '../src/discover.js';
import { runTests } from '../src/runner.js';
import { createWatcher } from '../src/watcher.js';

function makeContext() {
  const subscriptions: { dispose(): void }[] = [];
  return { subscriptions };
}

function makeItem(id: string, label: string, parent?: ReturnType<typeof makeItem>) {
  const item = {
    id,
    label,
    canResolveChildren: false,
    parent: parent as typeof item | undefined,
    children: {
      size: 0,
      items: new Map<string, typeof item>(),
      add(child: typeof item) {
        this.items.set(child.id, child);
        this.size = this.items.size;
      },
      delete(childId: string) {
        this.items.delete(childId);
        this.size = this.items.size;
      },
      get(childId: string) { return this.items.get(childId); },
      forEach(cb: (item: typeof item) => void) { this.items.forEach(cb); },
    },
    uri: Uri.file(`/ws/${id}.ts`),
    range: undefined as unknown,
  };
  return item;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

describe('activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a TestController and registers a Run profile', () => {
    const createSpy = vi.spyOn(tests, 'createTestController');
    const context = makeContext();
    activate(context as never);
    expect(createSpy).toHaveBeenCalledWith('actharness', 'actharness');
    expect(context.subscriptions.length).toBeGreaterThan(0);
  });

  it('calls discoverWorkspace on activation', () => {
    const context = makeContext();
    activate(context as never);
    expect(discoverWorkspace).toHaveBeenCalled();
  });

  it('calls createWatcher and adds it to subscriptions', () => {
    const context = makeContext();
    activate(context as never);
    expect(createWatcher).toHaveBeenCalled();
  });

  it('resolveHandler calls discoverFile when item has uri', async () => {
    const ctrl = tests.createTestController('actharness', 'actharness');
    vi.spyOn(tests, 'createTestController').mockReturnValueOnce(ctrl);
    const context = makeContext();
    activate(context as never);

    const uri = Uri.file('/ws/greet.test.ts');
    const item = { id: uri.toString(), label: 'greet.test.ts', uri, canResolveChildren: false, children: { size: 0, add() {}, delete() {}, get() {}, forEach() {} }, parent: undefined };
    await ctrl.resolveHandler!(item as never);
    expect(discoverFile).toHaveBeenCalledWith(ctrl, uri);
  });

  it('resolveHandler calls discoverWorkspace when item has no uri', async () => {
    const ctrl = tests.createTestController('actharness', 'actharness');
    vi.spyOn(tests, 'createTestController').mockReturnValueOnce(ctrl);
    const context = makeContext();
    activate(context as never);

    await ctrl.resolveHandler!(undefined);
    expect(discoverWorkspace).toHaveBeenCalled();
  });
});

describe('deactivate', () => {
  it('runs without error', () => {
    expect(() => deactivate()).not.toThrow();
  });
});

describe('collectLeaves', () => {
  it('returns leaf items directly', () => {
    const item = makeItem('leaf', 'leaf');
    const out: AnyItem[] = [];
    collectLeaves(item as never, out);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(item);
  });

  it('recurses into children to collect leaves', () => {
    const parent = makeItem('parent', 'parent');
    const child1 = makeItem('child1', 'child1');
    const child2 = makeItem('child2', 'child2');
    parent.children.add(child1 as never);
    parent.children.add(child2 as never);
    const out: AnyItem[] = [];
    collectLeaves(parent as never, out);
    expect(out).toHaveLength(2);
    expect(out).toContain(child1);
    expect(out).toContain(child2);
  });

  it('recurses deeply', () => {
    const root = makeItem('root', 'root');
    const mid = makeItem('mid', 'mid');
    const leaf = makeItem('leaf', 'leaf');
    root.children.add(mid as never);
    mid.children.size = 1;
    mid.children.items.set('leaf', leaf as never);
    const out: AnyItem[] = [];
    collectLeaves(root as never, out);
    expect(out).toContain(leaf);
  });
});

describe('getFullTitle', () => {
  it('returns empty string for file-level items (no parent)', () => {
    const item = makeItem('file', 'file.test.ts');
    expect(getFullTitle(item as never)).toBe('');
  });

  it('returns label for a top-level test (parent is file item)', () => {
    const file = makeItem('file', 'file.test.ts');
    const test = makeItem('test', 'runs');
    test.parent = file as never;
    expect(getFullTitle(test as never)).toBe('runs');
  });

  it('builds full path for nested test', () => {
    const file = makeItem('file', 'file.test.ts');
    const suite = makeItem('suite', 'suite name');
    const test = makeItem('test', 'test name');
    suite.parent = file as never;
    test.parent = suite as never;
    expect(getFullTitle(test as never)).toBe('suite name > test name');
  });

  it('builds full path for deeply nested test', () => {
    const file = makeItem('file', 'file.test.ts');
    const outer = makeItem('outer', 'outer');
    const inner = makeItem('inner', 'inner');
    const test = makeItem('test', 'deep');
    outer.parent = file as never;
    inner.parent = outer as never;
    test.parent = inner as never;
    expect(getFullTitle(test as never)).toBe('outer > inner > deep');
  });
});

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegex('a.b')).toBe('a\\.b');
    expect(escapeRegex('a*b')).toBe('a\\*b');
    expect(escapeRegex('(test)')).toBe('\\(test\\)');
    expect(escapeRegex('a+b?')).toBe('a\\+b\\?');
  });

  it('returns plain string unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
  });
});

describe('runHandler (via activate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function captureRunHandler() {
    let capturedHandler: ((request: AnyItem, token: AnyItem) => Promise<void>) | null = null;

    // Build a controller whose createRunProfile captures the handler
    const ctrl = tests.createTestController('actharness', 'actharness');
    const origCreate = ctrl.createRunProfile.bind(ctrl);
    vi.spyOn(ctrl, 'createRunProfile').mockImplementation((label, kind, handler, isDefault) => {
      capturedHandler = handler as typeof capturedHandler;
      return origCreate(label, kind, handler, isDefault);
    });

    // Intercept the createTestController call inside activate so it returns our ctrl
    vi.spyOn(tests, 'createTestController').mockReturnValueOnce(ctrl);

    const context = makeContext();
    activate(context as never);
    return { ctrl, handler: capturedHandler! };
  }

  it('runs all leaf tests when no include is set', async () => {
    const { ctrl, handler } = captureRunHandler();
    const leaf = makeItem('leaf', 'leaf test');
    ctrl.items.add(leaf as never);

    const run = {
      started: vi.fn(), passed: vi.fn(), failed: vi.fn(),
      skipped: vi.fn(), errored: vi.fn(), appendOutput: vi.fn(), end: vi.fn(),
    };
    vi.spyOn(ctrl, 'createTestRun').mockReturnValue(run as never);

    const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
    await handler({ include: undefined }, token);

    expect(runTests).toHaveBeenCalledWith(run, [leaf], token, undefined);
    expect(run.end).toHaveBeenCalled();
  });

  it('adds exact-match filter for single leaf test selection', async () => {
    const { ctrl, handler } = captureRunHandler();
    const file = makeItem('f', 'file.test.ts');
    const suite = makeItem('s', 'my suite');
    const test = makeItem('t', 'passes');
    suite.parent = file as never;
    test.parent = suite as never;

    const run = {
      started: vi.fn(), passed: vi.fn(), failed: vi.fn(),
      skipped: vi.fn(), errored: vi.fn(), appendOutput: vi.fn(), end: vi.fn(),
    };
    vi.spyOn(ctrl, 'createTestRun').mockReturnValue(run as never);

    const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
    await handler({ include: [test] }, token);

    expect(runTests).toHaveBeenCalledWith(
      run,
      [test],
      token,
      '^my suite > passes$',
    );
  });

  it('adds prefix filter for suite selection', async () => {
    const { ctrl, handler } = captureRunHandler();
    const file = makeItem('f', 'file.test.ts');
    const suite = makeItem('s', 'my suite');
    const child = makeItem('c', 'child test');
    suite.parent = file as never;
    child.parent = suite as never;
    suite.children.add(child as never);

    const run = {
      started: vi.fn(), passed: vi.fn(), failed: vi.fn(),
      skipped: vi.fn(), errored: vi.fn(), appendOutput: vi.fn(), end: vi.fn(),
    };
    vi.spyOn(ctrl, 'createTestRun').mockReturnValue(run as never);

    const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
    await handler({ include: [suite] }, token);

    // Suite has children → prefix match (no $)
    expect(runTests).toHaveBeenCalledWith(run, [child], token, '^my suite');
  });

  it('adds no filter for file-level selection', async () => {
    const { ctrl, handler } = captureRunHandler();
    const file = makeItem('f', 'file.test.ts');
    const test = makeItem('t', 'passes');
    test.parent = file as never;
    file.children.add(test as never);

    const run = {
      started: vi.fn(), passed: vi.fn(), failed: vi.fn(),
      skipped: vi.fn(), errored: vi.fn(), appendOutput: vi.fn(), end: vi.fn(),
    };
    vi.spyOn(ctrl, 'createTestRun').mockReturnValue(run as never);

    const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
    await handler({ include: [file] }, token);

    // File item → getFullTitle returns '' → no filter
    expect(runTests).toHaveBeenCalledWith(run, [test], token, undefined);
  });
});
