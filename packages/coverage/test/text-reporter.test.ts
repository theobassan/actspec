import { describe, it, expect } from 'vitest';
import { buildTextReport, buildTextSummary } from '../src/text-reporter.js';
import type { CoverageReport, CoverageStat } from '../src/types.js';

function makeStat(covered: number, total: number): CoverageStat {
  return { covered, total, pct: total === 0 ? 100 : (covered / total) * 100 };
}

function makeReport(overrides: Partial<{
  stepsC: number; stepsT: number;
  ifC: number; ifT: number;
  inC: number; inT: number;
  outC: number; outT: number;
}> = {}): CoverageReport {
  const { stepsC = 0, stepsT = 0, ifC = 0, ifT = 0, inC = 0, inT = 0, outC = 0, outT = 0 } = overrides;
  return {
    files: {},
    total: {
      steps: makeStat(stepsC, stepsT),
      ifBranches: makeStat(ifC, ifT),
      inputs: makeStat(inC, inT),
      outputs: makeStat(outC, outT),
    },
  };
}

function makeReportWithFile(path: string): CoverageReport {
  const stat = (c: number, t: number) => makeStat(c, t);
  const fc = {
    path,
    steps: stat(2, 4),
    ifBranches: stat(1, 2),
    inputs: stat(0, 3),
    outputs: stat(0, 0),
    ifBranchTable: [],
    inputTable: [],
    outputTable: [],
    stepHits: {},
    uncoveredSteps: [],
  };
  const total = {
    steps: stat(2, 4),
    ifBranches: stat(1, 2),
    inputs: stat(0, 3),
    outputs: stat(0, 0),
  };
  return { files: { [path]: fc }, total };
}

// ── buildTextReport ───────────────────────────────────────────────────────────

describe('buildTextReport', () => {
  it('returns a string with header columns', () => {
    const report = makeReport();
    const text = buildTextReport(report, '/root');
    expect(text).toContain('Steps');
    expect(text).toContain('If-Branches');
    expect(text).toContain('Inputs');
    expect(text).not.toContain('With-Inputs');
  });

  it('includes "All files" total row', () => {
    const text = buildTextReport(makeReport(), '/root');
    expect(text).toContain('All files');
  });

  it('includes file rows with relative paths', () => {
    const text = buildTextReport(makeReportWithFile('/root/action.yml'), '/root');
    expect(text).toContain('action.yml');
  });

  it('shows n/a for zero-total stats', () => {
    const text = buildTextReport(makeReport(), '/root');
    expect(text).toContain('n/a');
  });

  it('shows percentage and fraction for non-zero stats', () => {
    const text = buildTextReport(makeReportWithFile('/root/action.yml'), '/root');
    expect(text).toMatch(/\d+\.\d+%/);
    expect(text).toMatch(/\d+\/\d+/);
  });

  it('sorts files alphabetically', () => {
    const stat = makeStat(1, 2);
    const base = { ifBranches: stat, inputs: stat, outputs: stat, ifBranchTable: [], inputTable: [], outputTable: [], stepHits: {}, uncoveredSteps: [] };
    const report: CoverageReport = {
      files: {
        '/root/z.yml': { path: '/root/z.yml', steps: stat, ...base },
        '/root/a.yml': { path: '/root/a.yml', steps: stat, ...base },
      },
      total: { steps: stat, ifBranches: stat, inputs: stat, outputs: stat },
    };
    const text = buildTextReport(report, '/root');
    expect(text.indexOf('a.yml')).toBeLessThan(text.indexOf('z.yml'));
  });
});

// ── buildTextSummary ──────────────────────────────────────────────────────────

describe('buildTextSummary', () => {
  it('returns "No coverage data." when all totals are zero', () => {
    const text = buildTextSummary(makeReport());
    expect(text).toBe('No coverage data.');
  });

  it('shows Steps metric with bar when steps total > 0', () => {
    const text = buildTextSummary(makeReport({ stepsC: 1, stepsT: 2 }));
    expect(text).toContain('Steps:');
    expect(text).toMatch(/[█░]/);
  });

  it('shows If-Branches metric when ifBranches total > 0', () => {
    const text = buildTextSummary(makeReport({ ifC: 0, ifT: 2 }));
    expect(text).toContain('If-Branches:');
  });

  it('shows Inputs metric when inputs total > 0', () => {
    const text = buildTextSummary(makeReport({ inC: 1, inT: 1 }));
    expect(text).toContain('Inputs:');
  });

  it('shows Outputs metric when outputs total > 0', () => {
    const text = buildTextSummary(makeReport({ outC: 1, outT: 2 }));
    expect(text).toContain('Outputs:');
  });

  it('joins multiple metrics with |', () => {
    const text = buildTextSummary(makeReport({ stepsC: 1, stepsT: 2, ifC: 1, ifT: 2 }));
    expect(text).toContain('|');
  });

  it('bar function clamps pct below 0 to 0 (all empty bar)', () => {
    const text = buildTextSummary(makeReport({ stepsC: 0, stepsT: 10 }));
    // 0% → all empty chars
    expect(text).toMatch(/░{10}/);
  });

  it('bar function clamps pct above 100 to 100 (all filled bar)', () => {
    // 100% → all filled chars
    const text = buildTextSummary(makeReport({ stepsC: 10, stepsT: 10 }));
    expect(text).toMatch(/█{10}/);
  });

  it('bar function clamps pct < 0 (covers pct < 0 branch)', () => {
    // inject a stat with negative pct directly
    const report: CoverageReport = {
      files: {},
      total: {
        steps: { covered: 0, total: 10, pct: -5 },
        ifBranches: { covered: 0, total: 0, pct: 0 },
        inputs: { covered: 0, total: 0, pct: 0 },
        outputs: { covered: 0, total: 0, pct: 0 },
      },
    };
    const text = buildTextSummary(report);
    // clamped to 0 → all empty
    expect(text).toMatch(/░{10}/);
  });

  it('bar function clamps pct > 100 (covers pct > 100 branch)', () => {
    const report: CoverageReport = {
      files: {},
      total: {
        steps: { covered: 12, total: 10, pct: 120 },
        ifBranches: { covered: 0, total: 0, pct: 0 },
        inputs: { covered: 0, total: 0, pct: 0 },
        outputs: { covered: 0, total: 0, pct: 0 },
      },
    };
    const text = buildTextSummary(report);
    // clamped to 100 → all filled
    expect(text).toMatch(/█{10}/);
  });
});
