import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { offsetToLoc, nodeRangeToIstanbul } from '../src/source-map.js';
import { buildActionCoverage } from '../src/coverage-map.js';
import { CoverageCollector } from '../src/collector.js';
import type { ParsedAction, StepResult } from '@actharness/types';

// Side-effectful import — covers index.ts (all re-exports)
import '../src/index.js';

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));

// ── source-map utilities ──────────────────────────────────────────────────────

describe('offsetToLoc', () => {
  it('returns line 1, col 0 for offset 0', () => {
    expect(offsetToLoc('hello', 0)).toEqual({ line: 1, column: 0 });
  });

  it('increments column within first line', () => {
    expect(offsetToLoc('hello', 3)).toEqual({ line: 1, column: 3 });
  });

  it('increments line on newline', () => {
    expect(offsetToLoc('line1\nline2', 6)).toEqual({ line: 2, column: 0 });
  });

  it('handles multiple newlines', () => {
    expect(offsetToLoc('a\nb\nc', 4)).toEqual({ line: 3, column: 0 });
  });

  it('clamps offset beyond source length', () => {
    const result = offsetToLoc('abc', 1000);
    expect(result.line).toBe(1);
    expect(result.column).toBe(3);
  });
});

describe('nodeRangeToIstanbul', () => {
  it('converts start and end offsets to Istanbul range', () => {
    const source = 'line1\nline2\n';
    const range = nodeRangeToIstanbul(source, 0, 5);
    expect(range.start).toEqual({ line: 1, column: 0 });
    expect(range.end).toEqual({ line: 1, column: 5 });
  });
});

// ── buildActionCoverage ───────────────────────────────────────────────────────

function makeAction(opts: {
  file?: string;
  steps?: Array<{ id?: string; if?: string }>;
}): ParsedAction {
  const steps = (opts.steps ?? []).map((s, i) => {
    const step: import('@actharness/types').ParsedStep = {
      id: s.id ?? `step-${i}`,
      run: 'echo hi',
      shell: 'bash',
      _range: { start: i * 20, end: i * 20 + 19 },
    };
    if (s.if !== undefined) step.if = s.if;
    return step;
  });

  const action: ParsedAction = {
    name: 'Test Action',
    runs: { using: 'composite', steps },
    _dir: '/fake',
  };
  if (opts.file !== undefined) action._file = opts.file;
  return action;
}

function makeStepResult(
  id: string,
  opts: { ran?: boolean; ifResult?: boolean; outputs?: Record<string, string> } = {},
): StepResult {
  const result: StepResult = {
    id,
    name: id,
    phase: 'main',
    ran: opts.ran ?? true,
    outcome: opts.ran === false ? 'skipped' : 'success',
    conclusion: opts.ran === false ? 'skipped' : 'success',
    outputs: opts.outputs ?? {},
    stdout: '',
    stderr: '',
  };
  if (opts.ifResult !== undefined) {
    result.if = { expression: 'success()', result: opts.ifResult };
  }
  return result;
}

describe('buildActionCoverage', () => {
  it('returns a file coverage with the correct path', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 'step-0' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('step-0')]);
    expect((coverage as unknown as { path: string }).path).toBe('/fake/action.yml');
  });

  it('counts a ran step as statement hit = 1', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1', { ran: true })]);
    const data = coverage as unknown as { s: Record<string, number> };
    expect(data.s['0']).toBe(1);
  });

  it('counts a step with no if: and ran: false (job-state skip) as statement hit = 0', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1', { ran: false })]);
    const data = coverage as unknown as { s: Record<string, number> };
    expect(data.s['0']).toBe(0);
  });

  it('counts a step absent from results as statement hit = 0', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1' }] });
    const coverage = buildActionCoverage(action, []);
    const data = coverage as unknown as { s: Record<string, number> };
    expect(data.s['0']).toBe(0);
  });

  it('counts a step with explicit if: and ran: false (condition false) as statement hit = 0', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1', if: 'failure()' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1', { ran: false })]);
    const data = coverage as unknown as { s: Record<string, number> };
    expect(data.s['0']).toBe(0);
  });

  it('records if: branch when ifResult is true', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1', if: 'failure()' }] });
    const result = makeStepResult('s1', { ran: true, ifResult: true });
    const coverage = buildActionCoverage(action, [result]);
    const data = coverage as unknown as { b: Record<string, [number, number]> };
    expect(data.b['0']?.[0]).toBe(1);
    expect(data.b['0']?.[1]).toBe(0);
  });

  it('records if: branch when ifResult is false', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1', if: 'failure()' }] });
    const result = makeStepResult('s1', { ran: false, ifResult: false });
    const coverage = buildActionCoverage(action, [result]);
    const data = coverage as unknown as { b: Record<string, [number, number]> };
    expect(data.b['0']?.[0]).toBe(0);
    expect(data.b['0']?.[1]).toBe(1);
  });

  it('returns per-run count of 1 when step ran (accumulation is handled by Istanbul map)', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1' }] });
    const run1 = buildActionCoverage(action, [makeStepResult('s1', { ran: true })]);
    const run2 = buildActionCoverage(action, [makeStepResult('s1', { ran: true })]);
    const data1 = run1 as unknown as { s: Record<string, number> };
    const data2 = run2 as unknown as { s: Record<string, number> };
    expect(data1.s['0']).toBe(1);
    expect(data2.s['0']).toBe(1);
  });

  it('handles missing _file gracefully', () => {
    const action = makeAction({ steps: [{ id: 's1' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1')]);
    expect(coverage).toBeDefined();
  });

  it('handles nonexistent file gracefully', () => {
    const action = makeAction({ file: '/nonexistent/action.yml', steps: [{ id: 's1' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1')]);
    expect(coverage).toBeDefined();
  });

  it('uses nodeRangeToIstanbul when file exists and step has _range', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'actharness-cov-range-'));
    const filePath = join(tmpDir, 'action.yml');
    writeFileSync(filePath, 'name: T\nruns:\n  using: composite\n  steps: []\n');
    const action = makeAction({ file: filePath, steps: [{ id: 's1' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1')]);
    const data = coverage as unknown as { statementMap: Record<string, unknown> };
    expect(data.statementMap['0']).toBeDefined();
  });

  it('falls back to empty statementMap when action has no steps', () => {
    const action: ParsedAction = {
      name: 'No steps',
      runs: { using: 'composite' },
      _dir: '/fake',
      _file: '/fake/action.yml',
    };
    const coverage = buildActionCoverage(action, []);
    const data = coverage as unknown as { s: Record<string, number> };
    expect(Object.keys(data.s)).toHaveLength(0);
  });

  it('falls back to "action" name when action.name is falsy', () => {
    const action: ParsedAction = {
      name: '',
      runs: { using: 'composite', steps: [] },
      _dir: '/fake',
      _file: '/fake/action.yml',
    };
    const coverage = buildActionCoverage(action, []);
    const data = coverage as unknown as { fnMap: Record<string, { name: string }> };
    expect(data.fnMap['0']?.name).toBe('action');
  });

  it('skips if-branch when step.if is success()', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1', if: 'success()' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1', { ran: true })]);
    const data = coverage as unknown as { b: Record<string, unknown> };
    expect(data.b['0']).toBeUndefined();
  });

  it('uses __step_N__ id when step has no id field', () => {
    const action: ParsedAction = {
      name: 'Unnamed',
      runs: {
        using: 'composite',
        steps: [{ run: 'echo hi', shell: 'bash', _range: { start: 0, end: 10 } }],
      },
      _dir: '/fake',
      _file: '/fake/action.yml',
    };
    const coverage = buildActionCoverage(action, [makeStepResult('__step_1__', { ran: true })]);
    const data = coverage as unknown as { s: Record<string, number> };
    expect(data.s['0']).toBe(1);
  });

  it('returns per-run if-branch counts of 1/0 or 0/1 for each run', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1', if: 'failure()' }] });
    const run1 = buildActionCoverage(action, [makeStepResult('s1', { ran: true, ifResult: true })]);
    const run2 = buildActionCoverage(action, [makeStepResult('s1', { ran: true, ifResult: false })]);
    const data1 = run1 as unknown as { b: Record<string, [number, number]> };
    const data2 = run2 as unknown as { b: Record<string, [number, number]> };
    expect(data1.b['0']).toEqual([1, 0]);
    expect(data2.b['0']).toEqual([0, 1]);
  });

  it('statementMap entry includes _stepId', () => {
    const action = makeAction({ file: '/fake/action.yml', steps: [{ id: 's1' }] });
    const coverage = buildActionCoverage(action, [makeStepResult('s1')]);
    const data = coverage as unknown as { statementMap: Record<string, { _stepId?: string }> };
    expect(data.statementMap['0']?._stepId).toBe('s1');
  });
});

// ── CoverageCollector ─────────────────────────────────────────────────────────

describe('CoverageCollector', () => {
  it('starts with empty coverage map', () => {
    const collector = new CoverageCollector();
    const data = collector.coverageMap.toJSON();
    expect(Object.keys(data)).toHaveLength(0);
  });

  it('reset() clears the map', () => {
    const collector = new CoverageCollector();
    collector.reset();
    expect(Object.keys(collector.coverageMap.toJSON())).toHaveLength(0);
  });

  it('createListener() returns a function', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    expect(typeof listener).toBe('function');
  });

  it('listener ignores runs with no actionDir', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    listener(
      {
        conclusion: 'success',
        outputs: {},
        steps: [],
        step: () => undefined,
        env: {},
        annotations: [],
        stdout: '',
        stderr: '',
      },
      { sourceFile: undefined, actionDir: undefined },
    );
    expect(Object.keys(collector.coverageMap.toJSON())).toHaveLength(0);
  });

  it('flush() writes JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'actharness-cov-test-'));
    const collector = new CoverageCollector();
    collector.flush(dir);
    expect(existsSync(join(dir, 'coverage-actharness.json'))).toBe(true);
  });

  it('listener processes valid actionDir and records coverage', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    listener(
      {
        conclusion: 'success',
        outputs: {},
        steps: [{ id: 'step1', name: 'run', phase: 'main', ran: true, outcome: 'success', conclusion: 'success', outputs: {}, stdout: '', stderr: '' }],
        step: () => undefined,
        env: {},
        annotations: [],
        stdout: '',
        stderr: '',
      },
      { actionDir: join(FIXTURES, 'simple'), sourceFile: undefined },
    );
    expect(Object.keys(collector.coverageMap.toJSON())).toHaveLength(1);
  });

  it('listener accumulates output data across multiple runs (covers outRecord already-exists branch)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const result = {
      conclusion: 'success' as const,
      outputs: {},
      steps: [{ id: 'step1', name: 'run', phase: 'main' as const, ran: true, outcome: 'success' as const, conclusion: 'success' as const, outputs: { greeting: 'hello' }, stdout: '', stderr: '' }],
      step: () => undefined,
      env: {},
      annotations: [],
      stdout: '',
      stderr: '',
    };
    listener(result, { actionDir: join(FIXTURES, 'with-outputs'), sourceFile: undefined });
    listener(result, { actionDir: join(FIXTURES, 'with-outputs'), sourceFile: undefined });
    const report = collector.toCoverageReport();
    expect(Object.values(report.files).length).toBeGreaterThan(0);
  });

  it('listener ignores runs when parseAction fails (invalid dir)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    listener(
      { conclusion: 'success', outputs: {}, steps: [], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: '/nonexistent/dir', sourceFile: undefined },
    );
    expect(Object.keys(collector.coverageMap.toJSON())).toHaveLength(0);
  });

  it('merge() merges coverage from another collector', () => {
    const c1 = new CoverageCollector();
    const c2 = new CoverageCollector();
    c1.merge(c2);
    expect(Object.keys(c1.coverageMap.toJSON())).toHaveLength(0);
  });

  it('flush() writes extended fragment with istanbulMap and inputExercises', () => {
    const dir = mkdtempSync(join(tmpdir(), 'actharness-cov-flush-'));
    const collector = new CoverageCollector();
    collector.flush(dir);
    const raw = JSON.parse(readFileSync(join(dir, 'coverage-actharness.json'), 'utf8')) as Record<string, unknown>;
    expect(raw).toHaveProperty('istanbulMap');
    expect(raw).toHaveProperty('inputExercises');
    expect(Array.isArray(raw['inputExercises'])).toBe(true);
  });

  it('toFragment() serializes istanbulMap and inputExercises', () => {
    const collector = new CoverageCollector();
    const frag = collector.toFragment();
    expect(frag).toHaveProperty('istanbulMap');
    expect(frag).toHaveProperty('inputExercises');
  });

  it('CoverageCollector.fromParts() reconstructs a collector from an empty map', () => {
    const c = CoverageCollector.fromParts({}, []);
    expect(c).toBeInstanceOf(CoverageCollector);
    expect(Object.keys(c.coverageMap.toJSON())).toHaveLength(0);
  });

  it('CoverageCollector.fromParts() reconstructs a collector with Istanbul data', () => {
    const istanbulMap = {
      '/fake/action.yml': {
        path: '/fake/action.yml',
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { '0': 1 }, branchMap: {}, b: {}, fnMap: {}, f: {},
      },
    };
    const c = CoverageCollector.fromParts(istanbulMap, []);
    expect(c.coverageMap.toJSON()['/fake/action.yml']).toBeDefined();
  });

  it('CoverageCollector.fromParts() reconstructs a collector with inputExercises', () => {
    const c = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: { name: { provided: 1, default: 0 } }, inputDefs: { name: { hasDefault: false } } },
    ]);
    const report = c.toCoverageReport();
    expect(Object.keys(report.files)).toHaveLength(0); // no Istanbul data, but inputData exists
  });

  it('toCoverageReport() returns empty report when no data', () => {
    const collector = new CoverageCollector();
    const report = collector.toCoverageReport();
    expect(Object.keys(report.files)).toHaveLength(0);
    expect(report.total.steps).toEqual({ covered: 0, total: 0, pct: 0 });
    expect(report.total.ifBranches).toEqual({ covered: 0, total: 0, pct: 0 });
    expect(report.total.inputs).toEqual({ covered: 0, total: 0, pct: 0 });
  });

  it('toCoverageReport() computes step stats from Istanbul data', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {
            '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 }, _stepId: 's0' },
            '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 }, _stepId: 's1' },
          },
          s: { '0': 1, '1': 0 },
          branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = collector.toCoverageReport();
    expect(Object.keys(report.files)).toHaveLength(1);
    expect(report.files['/fake/action.yml']!.steps).toEqual({ covered: 1, total: 2, pct: 50 });
    expect(report.total.steps).toEqual({ covered: 1, total: 2, pct: 50 });
  });

  it('toCoverageReport() computes uncoveredSteps from statementMap._stepId', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {
            '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 }, _stepId: 's0' },
            '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 }, _stepId: 's1' },
          },
          s: { '0': 1, '1': 0 },
          branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.uncoveredSteps).toEqual(['s1']);
  });

  it('toCoverageReport() uncoveredSteps excludes steps without _stepId in statementMap', () => {
    // statementMap entry without _stepId should not appear in uncoveredSteps
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {
            '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          },
          s: { '0': 0 },
          branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.uncoveredSteps).toEqual([]);
  });

  it('toCoverageReport() computes ifBranch stats and ifBranchTable (truthy hit, falsy miss)', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {},
          s: {},
          branchMap: {
            '0': { loc: {}, type: 'if', locations: [], line: 1, _stepId: 's1', _expression: 'failure()' },
          },
          b: { '0': [1, 0] },
          fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.ifBranches).toEqual({ covered: 1, total: 2, pct: 50 });
    expect(report.files['/fake/action.yml']!.ifBranchTable).toHaveLength(1);
    expect(report.files['/fake/action.yml']!.ifBranchTable[0]).toMatchObject({ step: 's1', expression: 'failure()', trueCount: 1, falseCount: 0 });
  });

  it('toCoverageReport() branchStatOf covers t===0 (truthy miss) branch', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {},
          s: {},
          branchMap: {
            '0': { loc: {}, type: 'if', locations: [], line: 1, _stepId: 's1', _expression: 'failure()' },
          },
          b: { '0': [0, 1] },
          fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.ifBranches).toEqual({ covered: 1, total: 2, pct: 50 });
    expect(report.files['/fake/action.yml']!.ifBranchTable[0]).toMatchObject({ trueCount: 0, falseCount: 1 });
  });

  it('toCoverageReport() ifBranchTable uses falseCount=0 when b entry is missing', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {},
          s: {},
          branchMap: {
            '0': { loc: {}, type: 'if', locations: [], line: 1, _stepId: 's1', _expression: 'failure()' },
          },
          b: {},
          fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.ifBranchTable[0]).toMatchObject({ trueCount: 0, falseCount: 0 });
  });

  it('toCoverageReport() ignores branchMap entries without _stepId/_expression', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {},
          s: {},
          branchMap: {
            '0': { loc: {}, type: 'if', locations: [], line: 1 },
          },
          b: { '0': [1, 1] },
          fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.ifBranchTable).toHaveLength(0);
  });

  it('toCoverageReport() computes input stats from _inputData', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [
        {
          path: '/fake/action.yml',
          inputCounts: { token: { provided: 2, default: 0 }, name: { provided: 1, default: 1 } },
          inputDefs: { token: { hasDefault: false }, name: { hasDefault: true } },
        },
      ],
    );
    const report = collector.toCoverageReport();
    // token: no default → 1 slot, covered=1 (provided>0)
    // name: has default → 2 slots, covered=2 (both>0)
    expect(report.files['/fake/action.yml']!.inputs).toEqual({ covered: 3, total: 3, pct: 100 });
  });

  it('toCoverageReport() reports 0% inputs when no inputs exercised (hasDefault=false)', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [
        {
          path: '/fake/action.yml',
          inputCounts: { name: { provided: 0, default: 0 } },
          inputDefs: { name: { hasDefault: false } },
        },
      ],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.inputs).toEqual({ covered: 0, total: 1, pct: 0 });
  });

  it('toCoverageReport() covers provided=0 and default=0 false branches when hasDefault=true', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [
        {
          path: '/fake/action.yml',
          inputCounts: { name: { provided: 0, default: 0 } },
          inputDefs: { name: { hasDefault: true } },
        },
      ],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.inputs).toEqual({ covered: 0, total: 2, pct: 0 });
  });

  it('toCoverageReport() returns 100% inputs when inputDefs is empty (total=0)', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [
        { path: '/fake/action.yml', inputCounts: {}, inputDefs: {} },
      ],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.inputs).toEqual({ covered: 0, total: 0, pct: 100 });
  });

  it('toCoverageReport() uses ?? fallback when inputCounts is missing a key from inputDefs', () => {
    const collector = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [
        {
          path: '/fake/action.yml',
          inputCounts: {},
          inputDefs: { name: { hasDefault: false } },
        },
      ],
    );
    const report = collector.toCoverageReport();
    expect(report.files['/fake/action.yml']!.inputs).toEqual({ covered: 0, total: 1, pct: 0 });
  });

  it('listener handles action with no inputs (action.inputs ?? {} null branch)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    listener(
      {
        conclusion: 'success',
        outputs: {},
        steps: [],
        step: () => undefined,
        env: {},
        annotations: [],
        stdout: '',
        stderr: '',
      },
      {
        actionDir: join(FIXTURES, 'simple'),
        sourceFile: undefined,
        inputsExercised: { 'some-key': 'provided' },
      },
    );
    const frag = collector.toFragment();
    expect(frag.inputExercises[0]?.inputCounts['some-key']?.provided).toBe(1);
    expect(frag.inputExercises[0]?.inputDefs).toEqual({});
  });

  it('listener populates _inputData with inputDefs when action has declared inputs', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    listener(
      {
        conclusion: 'success',
        outputs: {},
        steps: [{ id: 'step1', name: 'run', phase: 'main', ran: true, outcome: 'success', conclusion: 'success', outputs: {}, stdout: '', stderr: '' }],
        step: () => undefined,
        env: {},
        annotations: [],
        stdout: '',
        stderr: '',
      },
      {
        actionDir: join(FIXTURES, 'with-inputs'),
        sourceFile: undefined,
        inputsExercised: { greeting: 'provided', token: 'provided' },
      },
    );
    const frag = collector.toFragment();
    expect(frag.inputExercises).toHaveLength(1);
    const entry = frag.inputExercises[0]!;
    expect(entry.inputDefs['greeting']?.hasDefault).toBe(true);
    expect(entry.inputDefs['token']?.hasDefault).toBe(false);
    expect(entry.inputCounts['greeting']?.provided).toBe(1);
  });

  it('listener merges inputsExercised on second call for same file', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const runArgs = {
      conclusion: 'success' as const,
      outputs: {} as Record<string, string>,
      steps: [{ id: 'step1', name: 'run', phase: 'main' as const, ran: true, outcome: 'success' as const, conclusion: 'success' as const, outputs: {} as Record<string, string>, stdout: '', stderr: '' }],
      step: () => undefined as ReturnType<() => undefined>,
      env: {} as Record<string, string>,
      annotations: [] as import('@actharness/types').Annotation[],
      stdout: '',
      stderr: '',
    };
    const metaBase = { actionDir: join(FIXTURES, 'with-inputs'), sourceFile: undefined as string | undefined };
    listener(runArgs, { ...metaBase, inputsExercised: { greeting: 'provided' } });
    listener(runArgs, { ...metaBase, inputsExercised: { greeting: 'default' } });
    const frag = collector.toFragment();
    const entry = frag.inputExercises[0];
    expect(entry?.inputCounts['greeting']?.provided).toBe(1);
    expect(entry?.inputCounts['greeting']?.default).toBe(1);
  });

  it('listener creates new inputCounts entry for unseen input name on second call', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const runArgs = {
      conclusion: 'success' as const,
      outputs: {} as Record<string, string>,
      steps: [],
      step: () => undefined as ReturnType<() => undefined>,
      env: {} as Record<string, string>,
      annotations: [] as import('@actharness/types').Annotation[],
      stdout: '',
      stderr: '',
    };
    const meta = { actionDir: join(FIXTURES, 'with-inputs'), sourceFile: undefined as string | undefined };
    listener(runArgs, { ...meta, inputsExercised: { greeting: 'provided' } });
    listener(runArgs, { ...meta, inputsExercised: { 'extra-unlisted': 'provided' } });
    const frag = collector.toFragment();
    const entry = frag.inputExercises[0];
    expect(entry?.inputCounts['extra-unlisted']?.provided).toBe(1);
  });

  it('merge() merges inputData from another collector', () => {
    const c1 = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: { name: { provided: 1, default: 0 } }, inputDefs: { name: { hasDefault: true } } },
    ]);
    const c2 = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: { name: { provided: 0, default: 1 } }, inputDefs: { name: { hasDefault: true } } },
    ]);
    c1.merge(c2);
    const frag = c1.toFragment();
    const entry = frag.inputExercises.find((e) => e.path === '/fake/action.yml');
    expect(entry?.inputCounts['name']?.provided).toBe(1);
    expect(entry?.inputCounts['name']?.default).toBe(1);
  });

  it('merge() adds new inputData path from other collector', () => {
    const c1 = new CoverageCollector();
    const c2 = CoverageCollector.fromParts({}, [
      { path: '/new/action.yml', inputCounts: { token: { provided: 1, default: 0 } }, inputDefs: { token: { hasDefault: false } } },
    ]);
    c1.merge(c2);
    const frag = c1.toFragment();
    expect(frag.inputExercises).toHaveLength(1);
    expect(frag.inputExercises[0]?.path).toBe('/new/action.yml');
  });

  it('merge() uses ?? 0 when existing.inputCounts[name] is missing (covers lines 184-185)', () => {
    const c1 = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: {}, inputDefs: {} },
    ]);
    const c2 = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: { name: { provided: 3, default: 2 } }, inputDefs: { name: { hasDefault: true } } },
    ]);
    c1.merge(c2);
    const frag = c1.toFragment();
    const entry = frag.inputExercises.find((e) => e.path === '/fake/action.yml');
    expect(entry?.inputCounts['name']?.provided).toBe(3);
    expect(entry?.inputCounts['name']?.default).toBe(2);
  });

  it('merge() adds new inputDefs entry when missing', () => {
    const c1 = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: { name: { provided: 1, default: 0 } }, inputDefs: {} },
    ]);
    const c2 = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: { name: { provided: 0, default: 1 } }, inputDefs: { name: { hasDefault: true } } },
    ]);
    c1.merge(c2);
    const frag = c1.toFragment();
    const entry = frag.inputExercises.find((e) => e.path === '/fake/action.yml');
    expect(entry?.inputDefs['name']?.hasDefault).toBe(true);
  });

  it('reset() clears _inputData', () => {
    const collector = CoverageCollector.fromParts({}, [
      { path: '/fake/action.yml', inputCounts: { name: { provided: 1, default: 0 } }, inputDefs: {} },
    ]);
    collector.reset();
    const frag = collector.toFragment();
    expect(frag.inputExercises).toHaveLength(0);
  });

  it('_stepReachedData: action.runs.steps ?? [] branch (no steps in action)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    listener(
      { conclusion: 'success', outputs: {}, steps: [], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: join(FIXTURES, 'custom-runner'), sourceFile: undefined },
    );
    const frag = collector.toFragment();
    expect(Object.keys(frag.stepReachedExercises[0]?.counts ?? {})).toHaveLength(0);
  });

  it('_stepReachedData: step.id ?? __step_N__ branch (step without id)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    listener(
      { conclusion: 'success', outputs: {}, steps: [], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: join(FIXTURES, 'uses-with'), sourceFile: undefined },
    );
    const frag = collector.toFragment();
    const entry = frag.stepReachedExercises[0]!;
    expect('__step_2__' in entry.counts).toBe(true);
  });

  it('toCoverageReport() builds inputTable from _buildInputTable', () => {
    const c = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [
        {
          path: '/fake/action.yml',
          inputCounts: { name: { provided: 1, default: 1 }, token: { provided: 0, default: 0 } },
          inputDefs: { name: { hasDefault: true }, token: { hasDefault: false } },
        },
      ],
    );
    const report = c.toCoverageReport();
    const fc = report.files['/fake/action.yml']!;
    expect(fc.inputTable).toHaveLength(2);
    const nameRow = fc.inputTable.find((r) => r.name === 'name')!;
    expect(nameRow.hasDefault).toBe(true);
    expect(nameRow.coveredProvided).toBe(true);
    expect(nameRow.coveredDefault).toBe(true);
    const tokenRow = fc.inputTable.find((r) => r.name === 'token')!;
    expect(tokenRow.hasDefault).toBe(false);
    expect(tokenRow.coveredProvided).toBe(false);
    expect(tokenRow.coveredDefault).toBe(true); // no default → always true
  });

  it('toCoverageReport() builds stepHits from statementMap._stepId', () => {
    const c = CoverageCollector.fromParts(
      {
        '/fake/action.yml': {
          path: '/fake/action.yml',
          statementMap: {
            '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 }, _stepId: 's0' },
            '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 }, _stepId: 's1' },
          },
          s: { '0': 3, '1': 0 },
          branchMap: {}, b: {}, fnMap: {}, f: {},
        },
      },
      [],
    );
    const report = c.toCoverageReport();
    const fc = report.files['/fake/action.yml']!;
    expect(fc.stepHits['s0']).toBe(3);
    expect(fc.stepHits['s1']).toBe(0);
  });

  // ── Output coverage ───────────────────────────────────────────────────────────

  it('createListener() accumulates output counts from result.outputs', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const fixtureDir = join(FIXTURES, 'with-outputs');
    const fixturePath = join(fixtureDir, 'action.yml');
    listener(
      { conclusion: 'success', outputs: { greeting: 'hello' }, steps: [makeStepResult('step1', { outputs: { greeting: 'hello' } })], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );
    const report = collector.toCoverageReport();
    const fc = report.files[fixturePath]!;
    expect(fc.outputs).toEqual({ covered: 1, total: 1, pct: 100 });
    expect(fc.outputTable).toEqual([{ name: 'greeting', covered: true, count: 1 }]);
  });

  it('createListener() marks output as uncovered when result.outputs value is empty', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const fixtureDir = join(FIXTURES, 'with-outputs');
    const fixturePath = join(fixtureDir, 'action.yml');
    listener(
      { conclusion: 'success', outputs: { greeting: '' }, steps: [makeStepResult('step1')], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );
    const report = collector.toCoverageReport();
    expect(report.files[fixturePath]!.outputs).toEqual({ covered: 0, total: 1, pct: 0 });
    expect(report.files[fixturePath]!.outputTable[0]?.covered).toBe(false);
  });

  it('_isOutputProduced: step not found in results falls back to ?? {} (outputKey not in empty object)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const fixtureDir = join(FIXTURES, 'with-outputs');
    const fixturePath = join(fixtureDir, 'action.yml');
    listener(
      { conclusion: 'success', outputs: {}, steps: [], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );
    const report = collector.toCoverageReport();
    expect(report.files[fixturePath]!.outputTable.find((r) => r.name === 'greeting')?.covered).toBe(false);
  });

  it('_isOutputProduced: non-step-pattern value expression falls back to result.outputs (line 100)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const fixtureDir = join(FIXTURES, 'with-context-output');
    const fixturePath = join(fixtureDir, 'action.yml');
    listener(
      { conclusion: 'success', outputs: { 'event-name': 'push', 'no-value': '' }, steps: [makeStepResult('step1')], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );
    const report = collector.toCoverageReport();
    const fc = report.files[fixturePath]!;
    expect(fc.outputTable.find((r) => r.name === 'event-name')?.covered).toBe(true);
    expect(fc.outputTable.find((r) => r.name === 'no-value')?.covered).toBe(false);
  });

  it('_isOutputProduced: undefined valueExpr branch (line 92) returns truthy when output present', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const fixtureDir = join(FIXTURES, 'with-context-output');
    const fixturePath = join(fixtureDir, 'action.yml');
    listener(
      { conclusion: 'success', outputs: { 'event-name': '', 'no-value': 'present' }, steps: [makeStepResult('step1')], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );
    const report = collector.toCoverageReport();
    const fc = report.files[fixturePath]!;
    expect(fc.outputTable.find((r) => r.name === 'no-value')?.covered).toBe(true);
  });

  it('_stepReachedData: explicit non-success() if step counts all appearances (hasExplicitIf=true, stepResult found)', () => {
    const collector = new CoverageCollector();
    const listener = collector.createListener();
    const fixtureDir = join(FIXTURES, 'with-if');
    const fixturePath = join(fixtureDir, 'action.yml');
    listener(
      { conclusion: 'success', outputs: {}, steps: [makeStepResult('step1', { ran: false }), makeStepResult('step2', { ran: true })], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );
    const frag = collector.toFragment();
    const entry = frag.stepReachedExercises.find((e) => e.path === fixturePath)!;
    expect(entry.counts['step1']).toBe(1); // explicit non-success() if: stepResult found → reached even with ran:false
    expect(entry.counts['step2']).toBe(1); // explicit if: success() → treated as no-if, counts ran:true
  });

  it('_computeOutputStat: no _outputData for path returns pct=100 and empty table', () => {
    const c = CoverageCollector.fromParts(
      { '/fake/action.yml': { path: '/fake/action.yml', statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {} } },
      [],
    );
    const report = c.toCoverageReport();
    const fc = report.files['/fake/action.yml']!;
    expect(fc.outputs).toEqual({ covered: 0, total: 0, pct: 100 });
    expect(fc.outputTable).toEqual([]);
  });

  it('fromParts() restores outputExercises', () => {
    const c = CoverageCollector.fromParts(
      {},
      [],
      [{ path: '/fake/action.yml', counts: { greeting: 3 } }],
    );
    const frag = c.toFragment();
    expect(frag.outputExercises[0]).toEqual({ path: '/fake/action.yml', counts: { greeting: 3 } });
  });

  it('fromParts() restores stepReachedExercises', () => {
    const c = CoverageCollector.fromParts(
      {},
      [],
      [],
      [{ path: '/fake/action.yml', counts: { step1: 3, step2: 0 } }],
    );
    const frag = c.toFragment();
    expect(frag.stepReachedExercises[0]).toEqual({ path: '/fake/action.yml', counts: { step1: 3, step2: 0 } });
  });

  it('merge() accumulates _stepReachedData for same path (existing and new stepIds)', () => {
    const path = '/fake/action.yml';
    const a = CoverageCollector.fromParts({}, [], [], [{ path, counts: { step1: 2 } }]);
    const b = CoverageCollector.fromParts({}, [], [], [{ path, counts: { step1: 1, step2: 3 } }]);
    a.merge(b);
    const frag = a.toFragment();
    const entry = frag.stepReachedExercises.find((e) => e.path === path)!;
    expect(entry.counts['step1']).toBe(3);
    expect(entry.counts['step2']).toBe(3);
  });

  it('merge() combines outputData for same path (accumulates counts)', () => {
    const fixtureDir = join(FIXTURES, 'with-outputs');
    const fixturePath = join(fixtureDir, 'action.yml');

    const a = new CoverageCollector();
    a.createListener()(
      { conclusion: 'success', outputs: { greeting: 'hello' }, steps: [makeStepResult('step1', { outputs: { greeting: 'hello' } })], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );

    const b = new CoverageCollector();
    b.createListener()(
      { conclusion: 'success', outputs: { greeting: 'world' }, steps: [makeStepResult('step1', { outputs: { greeting: 'world' } })], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );

    a.merge(b);
    const fc = a.toCoverageReport().files[fixturePath]!;
    expect(fc.outputs.covered).toBe(1);
    expect(fc.outputs.total).toBe(1);
  });

  it('merge() adds outputData for new path (not yet in target)', () => {
    const fixtureDir = join(FIXTURES, 'with-outputs');
    const fixturePath = join(fixtureDir, 'action.yml');

    const a = new CoverageCollector();
    const b = new CoverageCollector();
    b.createListener()(
      { conclusion: 'success', outputs: { greeting: 'hi' }, steps: [makeStepResult('step1', { outputs: { greeting: 'hi' } })], step: () => undefined, env: {}, annotations: [], stdout: '', stderr: '' },
      { actionDir: fixtureDir, sourceFile: undefined },
    );
    a.merge(b);
    const frag = a.toFragment();
    expect(frag.outputExercises.find((e) => e.path === fixturePath)?.counts['greeting']).toBe(1);
  });

  it('_computeOutputStat: empty counts returns total=0 and pct=100', () => {
    const path = '/fake/action.yml';
    const c = CoverageCollector.fromParts(
      { [path]: { path, statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {} } },
      [],
      [{ path, counts: {} }],
    );
    const fc = c.toCoverageReport().files[path]!;
    expect(fc.outputs).toEqual({ covered: 0, total: 0, pct: 100 });
    expect(fc.outputTable).toEqual([]);
  });

  it('merge() adds new output key to existing path via ?? 0', () => {
    const path = '/fake/action.yml';
    const a = CoverageCollector.fromParts({}, [], [{ path, counts: { a: 1 } }]);
    const b = CoverageCollector.fromParts({}, [], [{ path, counts: { b: 2 } }]);
    a.merge(b);
    const frag = a.toFragment();
    const entry = frag.outputExercises.find((e) => e.path === path)!;
    expect(entry.counts['a']).toBe(1);
    expect(entry.counts['b']).toBe(2);
  });
});
