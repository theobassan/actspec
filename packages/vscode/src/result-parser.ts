import * as vscode from 'vscode';

interface RawEvent {
  type: string;
  data: RawEventData;
}

interface RawEventData {
  name: string;
  nesting: number;
  file?: string;
  details?: {
    duration_ms: number;
    error?: { message: string; stack?: string };
  };
  message?: string;
}

export interface ParsedResultParser {
  onLine: (line: string) => void;
  completedIds: Set<string>;
}

export function createResultParser(
  run: vscode.TestRun,
  itemsById: Map<string, vscode.TestItem>,
): ParsedResultParser {
  const completedIds = new Set<string>();
  // Per-file nesting stacks: file path → name at each nesting level
  const nestingStacks = new Map<string, string[]>();

  function onLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let event: RawEvent;
    try {
      event = JSON.parse(trimmed) as RawEvent;
    } catch {
      return;
    }

    const { type, data } = event;
    const filePath = data.file ?? '';
    const { name, nesting } = data;

    if (!nestingStacks.has(filePath)) {
      nestingStacks.set(filePath, []);
    }
    const stack = nestingStacks.get(filePath)!;
    stack[nesting] = name;

    if (type === 'test:start') {
      const item = resolveItem(filePath, stack, nesting, itemsById);
      if (item) run.started(item);
      return;
    }

    if (type === 'test:pass') {
      const item = resolveItem(filePath, stack, nesting, itemsById);
      if (item) {
        run.passed(item, data.details?.duration_ms);
        completedIds.add(item.id);
      }
      return;
    }

    if (type === 'test:fail') {
      const item = resolveItem(filePath, stack, nesting, itemsById);
      if (item) {
        run.failed(item, buildMessage(data), data.details?.duration_ms);
        completedIds.add(item.id);
      }
      return;
    }

    if (type === 'test:skip' || type === 'test:dequeue') {
      const item = resolveItem(filePath, stack, nesting, itemsById);
      if (item) {
        run.skipped(item);
        completedIds.add(item.id);
      }
      return;
    }

    if (type === 'test:stdout' || type === 'test:stderr') {
      const message = data.message ?? '';
      if (message) run.appendOutput(message.replace(/\n/g, '\r\n'));
      return;
    }
  }

  return { onLine, completedIds };
}

function resolveItem(
  filePath: string,
  stack: string[],
  nesting: number,
  itemsById: Map<string, vscode.TestItem>,
): vscode.TestItem | undefined {
  if (!filePath) return undefined;
  const fullTitle = stack.slice(0, nesting + 1).join(' > ');
  const fileUri = vscode.Uri.file(filePath).toString();
  return itemsById.get(`${fileUri}::${fullTitle}`);
}

function buildMessage(data: RawEventData): vscode.TestMessage {
  const error = data.details?.error;
  const msg = new vscode.TestMessage(error?.message ?? 'Test failed');
  const loc = parseStackLocation(error?.stack ?? '');
  if (loc) {
    msg.location = new vscode.Location(
      vscode.Uri.file(loc.file),
      new vscode.Position(loc.line - 1, 0),
    );
  }
  return msg;
}

export function parseStackLocation(
  stack: string,
): { file: string; line: number; col: number } | null {
  // Match "at Something (/path/to/file.ts:10:5)" or "at /path/to/file.ts:10:5"
  const match =
    /at .+?\((.+?):(\d+):(\d+)\)/.exec(stack) ?? /at (.+?):(\d+):(\d+)/.exec(stack);
  if (!match) return null;
  const file = match[1]!;
  const line = parseInt(match[2]!, 10);
  const col = parseInt(match[3]!, 10);
  return { file, line, col };
}
