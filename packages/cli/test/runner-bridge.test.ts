import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseRunnerBridgeArgs } from '../src/runner-bridge-args.js';

// ── parseRunnerBridgeArgs ────────────────────────────────────────────────────

describe('parseRunnerBridgeArgs', () => {
  it('parses --files as a comma-separated list', () => {
    const result = parseRunnerBridgeArgs(['--files', 'a.ts,b.ts,c.ts']);
    expect(result.files).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('filters empty segments from --files', () => {
    const result = parseRunnerBridgeArgs(['--files', 'a.ts,,b.ts']);
    expect(result.files).toEqual(['a.ts', 'b.ts']);
  });

  it('parses --pattern', () => {
    const result = parseRunnerBridgeArgs(['--pattern', '^greets$']);
    expect(result.pattern).toBe('^greets$');
  });

  it('parses --register-url', () => {
    const result = parseRunnerBridgeArgs(['--register-url', 'file:///reg.js']);
    expect(result.registerUrl).toBe('file:///reg.js');
  });

  it('parses --tsx-esm-url', () => {
    const result = parseRunnerBridgeArgs(['--tsx-esm-url', 'file:///tsx.js']);
    expect(result.tsxEsmUrl).toBe('file:///tsx.js');
  });

  it('returns defaults when no args are provided', () => {
    const result = parseRunnerBridgeArgs([]);
    expect(result.files).toEqual([]);
    expect(result.pattern).toBeUndefined();
    expect(result.registerUrl).toBe('');
    expect(result.tsxEsmUrl).toBe('');
  });

  it('ignores unknown flags', () => {
    const result = parseRunnerBridgeArgs(['--unknown', 'value', '--files', 'a.ts']);
    expect(result.files).toEqual(['a.ts']);
  });
});

// ── runner-bridge.ts (top-level script) ─────────────────────────────────────

const mockRun = vi.fn();

vi.mock('node:test', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:test')>();
  return { ...actual, run: mockRun };
});

describe('runner-bridge.ts', () => {
  const savedArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.argv = savedArgv;
  });

  it('streams events as JSON lines to stdout', async () => {
    const event = { type: 'test:pass', data: { name: 'greets', nesting: 0 } };

    async function* mockStream() {
      yield event;
    }
    mockRun.mockReturnValue(mockStream());

    process.argv = [
      'node', 'runner-bridge.js',
      '--files', '/ws/greet.test.ts',
      '--register-url', 'file:///register.js',
      '--tsx-esm-url', 'file:///tsx/esm.js',
    ];

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await import('../src/runner-bridge.js');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(event) + '\n');
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ['/ws/greet.test.ts'],
        execArgv: ['--import', 'file:///tsx/esm.js', '--import', 'file:///register.js'],
      }),
    );

    writeSpy.mockRestore();
  });

  it('passes testNamePatterns when --pattern is provided', async () => {
    async function* mockStream() {}
    mockRun.mockReturnValue(mockStream());

    process.argv = [
      'node', 'runner-bridge.js',
      '--files', '/ws/greet.test.ts',
      '--pattern', '^greets$',
      '--register-url', 'file:///register.js',
      '--tsx-esm-url', 'file:///tsx/esm.js',
    ];

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await import('../src/runner-bridge.js');

    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({ testNamePatterns: ['^greets$'] }),
    );
  });
});
