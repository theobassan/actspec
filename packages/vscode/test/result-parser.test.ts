import { describe, it, expect, vi } from 'vitest';
import { TestItem, TestMessage, TestRun } from 'vscode';
import { createResultParser, parseStackLocation } from '../src/result-parser.js';

function makeItem(id: string, uri = 'file:///ws/greet.test.ts'): TestItem {
  return {
    id,
    label: id.split('::').pop() ?? id,
    uri: { toString: () => uri, fsPath: uri.replace('file://', '') } as never,
    canResolveChildren: false,
    children: { size: 0, add() {}, delete() {}, get() { return undefined; }, forEach() {} },
    parent: undefined,
  };
}

function makeRun(): TestRun & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {
    started: [],
    passed: [],
    failed: [],
    skipped: [],
    errored: [],
    appendOutput: [],
  };
  return {
    calls,
    started: vi.fn((...args) => calls['started']!.push(args)),
    passed: vi.fn((...args) => calls['passed']!.push(args)),
    failed: vi.fn((...args) => calls['failed']!.push(args)),
    skipped: vi.fn((...args) => calls['skipped']!.push(args)),
    errored: vi.fn((...args) => calls['errored']!.push(args)),
    appendOutput: vi.fn((...args) => calls['appendOutput']!.push(args)),
    end: vi.fn(),
  } as TestRun & { calls: Record<string, unknown[][]> };
}

const FILE = '/ws/greet.test.ts';
const FILE_URI = `file://${FILE}`;

function itemId(title: string) {
  return `${FILE_URI}::${title}`;
}

function line(event: object) {
  return JSON.stringify(event);
}

describe('createResultParser', () => {
  it('calls started on test:start', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'), FILE_URI);
    const { onLine } = createResultParser(run, new Map([[item.id, item]]));

    onLine(line({ type: 'test:start', data: { name: 'greets', nesting: 0, file: FILE } }));

    expect(run.started).toHaveBeenCalledWith(item);
  });

  it('calls passed on test:pass with duration', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'), FILE_URI);
    const { onLine } = createResultParser(run, new Map([[item.id, item]]));

    onLine(line({
      type: 'test:pass',
      data: { name: 'greets', nesting: 0, file: FILE, details: { duration_ms: 42 } },
    }));

    expect(run.passed).toHaveBeenCalledWith(item, 42);
  });

  it('calls failed on test:fail with message', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'), FILE_URI);
    const { onLine } = createResultParser(run, new Map([[item.id, item]]));

    onLine(line({
      type: 'test:fail',
      data: {
        name: 'greets',
        nesting: 0,
        file: FILE,
        details: {
          duration_ms: 10,
          error: { message: 'expected 1 to equal 2', stack: '' },
        },
      },
    }));

    expect(run.failed).toHaveBeenCalledOnce();
    const [calledItem, msg] = (run.calls['failed']![0] ?? []) as [TestItem, TestMessage];
    expect(calledItem).toBe(item);
    expect(msg.message).toBe('expected 1 to equal 2');
  });

  it('calls skipped on test:skip', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'), FILE_URI);
    const { onLine } = createResultParser(run, new Map([[item.id, item]]));

    onLine(line({ type: 'test:skip', data: { name: 'greets', nesting: 0, file: FILE } }));

    expect(run.skipped).toHaveBeenCalledWith(item);
  });

  it('resolves nested test via nesting stack', () => {
    const run = makeRun();
    const suite = makeItem(itemId('suite'));
    const child = makeItem(itemId('suite > passes'));
    const items = new Map([
      [suite.id, suite],
      [child.id, child],
    ]);
    const { onLine } = createResultParser(run, items);

    // describe:start sets nesting 0
    onLine(line({ type: 'test:start', data: { name: 'suite', nesting: 0, file: FILE } }));
    // test:pass at nesting 1 → full title is "suite > passes"
    onLine(line({
      type: 'test:pass',
      data: { name: 'passes', nesting: 1, file: FILE, details: { duration_ms: 5 } },
    }));

    expect(run.passed).toHaveBeenCalledWith(child, 5);
  });

  it('tracks completedIds on pass/fail/skip', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'));
    const { onLine, completedIds } = createResultParser(run, new Map([[item.id, item]]));

    expect(completedIds.has(item.id)).toBe(false);
    onLine(line({ type: 'test:pass', data: { name: 'greets', nesting: 0, file: FILE, details: { duration_ms: 1 } } }));
    expect(completedIds.has(item.id)).toBe(true);
  });

  it('appends stdout/stderr output', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());

    onLine(line({ type: 'test:stdout', data: { name: '', nesting: 0, message: 'hello\n' } }));

    expect(run.appendOutput).toHaveBeenCalledWith('hello\r\n');
  });

  it('does not append output when message is empty/missing', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());

    onLine(line({ type: 'test:stdout', data: { name: '', nesting: 0 } }));

    expect(run.appendOutput).not.toHaveBeenCalled();
  });

  it('uses fallback message text when error has no message', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'));
    const { onLine } = createResultParser(run, new Map([[item.id, item]]));

    onLine(line({
      type: 'test:fail',
      data: { name: 'greets', nesting: 0, file: FILE, details: { duration_ms: 1 } },
    }));

    const [, msg] = (run.calls['failed']![0] ?? []) as [TestItem, TestMessage];
    expect(msg.message).toBe('Test failed');
  });

  it('ignores unknown event types', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());

    expect(() =>
      onLine(line({ type: 'test:diagnostic', data: { name: '', nesting: 0 } })),
    ).not.toThrow();
  });

  it('ignores empty lines', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());
    expect(() => onLine('')).not.toThrow();
    expect(() => onLine('   ')).not.toThrow();
    expect(run.started).not.toHaveBeenCalled();
  });

  it('ignores malformed JSON lines', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());
    expect(() => onLine('not json at all')).not.toThrow();
  });

  it('returns undefined when event has no file (filePath is empty)', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'));
    const { onLine } = createResultParser(run, new Map([[item.id, item]]));

    // Event without file property — filePath will be ''
    onLine(line({
      type: 'test:pass',
      data: { name: 'greets', nesting: 0, details: { duration_ms: 1 } },
    }));

    // Item should NOT be updated since filePath is empty
    expect(run.passed).not.toHaveBeenCalled();
  });

  it('ignores events with no matching TestItem', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());

    expect(() =>
      onLine(line({ type: 'test:pass', data: { name: 'unknown', nesting: 0, file: FILE, details: { duration_ms: 1 } } })),
    ).not.toThrow();
    expect(run.passed).not.toHaveBeenCalled();
  });

  it('does not call started when test:start has no matching item', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());

    onLine(line({ type: 'test:start', data: { name: 'unknown', nesting: 0, file: FILE } }));

    expect(run.started).not.toHaveBeenCalled();
  });

  it('does not call failed when test:fail has no matching item', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());

    onLine(line({ type: 'test:fail', data: { name: 'unknown', nesting: 0, file: FILE, details: { duration_ms: 1 } } }));

    expect(run.failed).not.toHaveBeenCalled();
  });

  it('does not call skipped when test:skip has no matching item', () => {
    const run = makeRun();
    const { onLine } = createResultParser(run, new Map());

    onLine(line({ type: 'test:skip', data: { name: 'unknown', nesting: 0, file: FILE } }));

    expect(run.skipped).not.toHaveBeenCalled();
  });

  it('sets location on failure when stack has file:line:col', () => {
    const run = makeRun();
    const item = makeItem(itemId('greets'));
    const { onLine } = createResultParser(run, new Map([[item.id, item]]));

    const stack = `Error: boom\n    at Object.<anonymous> (/ws/greet.test.ts:10:5)`;
    onLine(line({
      type: 'test:fail',
      data: { name: 'greets', nesting: 0, file: FILE, details: { duration_ms: 1, error: { message: 'boom', stack } } },
    }));

    const [, msg] = (run.calls['failed']![0] ?? []) as [TestItem, TestMessage];
    expect(msg.location).toBeDefined();
    expect(msg.location!.range).toBeDefined();
  });
});

describe('parseStackLocation', () => {
  it('extracts file, line, col from "at X (file:line:col)" form', () => {
    const result = parseStackLocation(
      'Error: fail\n    at Object.<anonymous> (/path/to/file.ts:12:3)',
    );
    expect(result).toEqual({ file: '/path/to/file.ts', line: 12, col: 3 });
  });

  it('extracts from bare "at file:line:col" form', () => {
    const result = parseStackLocation('at /path/to/file.ts:5:1');
    expect(result).toEqual({ file: '/path/to/file.ts', line: 5, col: 1 });
  });

  it('returns null for empty stack', () => {
    expect(parseStackLocation('')).toBeNull();
  });

  it('returns null when no at-line is present', () => {
    expect(parseStackLocation('Error: something happened')).toBeNull();
  });
});
