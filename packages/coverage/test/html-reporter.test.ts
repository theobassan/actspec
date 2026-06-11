import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndexHtml, buildFileHtml, generateHtmlReport } from '../src/html-reporter.js';
import type { CoverageReport, FileCoverage } from '../src/types.js';

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));

function makeStat(covered: number, total: number) {
  return { covered, total, pct: total === 0 ? 100 : (covered / total) * 100 };
}

function makeEmptyReport(): CoverageReport {
  const stat = { covered: 0, total: 0, pct: 0 };
  return { files: {}, total: { steps: stat, ifBranches: stat, inputs: stat, outputs: stat } };
}

function makeFileCoverage(path: string, opts: {
  stepsCovered?: number; stepsTotal?: number;
  ifCovered?: number; ifTotal?: number;
  inCovered?: number; inTotal?: number;
  outCovered?: number; outTotal?: number;
  ifBranchTable?: FileCoverage['ifBranchTable'];
  inputTable?: FileCoverage['inputTable'];
  outputTable?: FileCoverage['outputTable'];
  stepHits?: Record<string, number>;
  stepReached?: Record<string, number>;
} = {}): FileCoverage {
  const stepHits = opts.stepHits ?? {};
  const stepReached = opts.stepReached ?? Object.fromEntries(Object.entries(stepHits).map(([k, v]) => [k, v]));
  return {
    path,
    steps: makeStat(opts.stepsCovered ?? 0, opts.stepsTotal ?? 0),
    ifBranches: makeStat(opts.ifCovered ?? 0, opts.ifTotal ?? 0),
    inputs: makeStat(opts.inCovered ?? 0, opts.inTotal ?? 0),
    outputs: makeStat(opts.outCovered ?? 0, opts.outTotal ?? 0),
    ifBranchTable: opts.ifBranchTable ?? [],
    inputTable: opts.inputTable ?? [],
    outputTable: opts.outputTable ?? [],
    stepHits,
    stepReached,
    uncoveredSteps: [],
  };
}

// ── buildIndexHtml ────────────────────────────────────────────────────────────

describe('buildIndexHtml', () => {
  it('returns an HTML string with doctype', () => {
    const html = buildIndexHtml(makeEmptyReport(), '/root');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('includes "actharness coverage" title', () => {
    const html = buildIndexHtml(makeEmptyReport(), '/root');
    expect(html).toContain('actharness coverage');
  });

  it('includes table headers for all metrics', () => {
    const html = buildIndexHtml(makeEmptyReport(), '/root');
    expect(html).toContain('Steps');
    expect(html).toContain('If-Branches');
    expect(html).toContain('Inputs');
    expect(html).not.toContain('With-Inputs');
  });

  it('includes file link when report has files', () => {
    const fc = makeFileCoverage('/root/action.yml');
    const report: CoverageReport = {
      files: { '/root/action.yml': fc },
      total: fc.steps ? { steps: fc.steps, ifBranches: fc.ifBranches, inputs: fc.inputs, outputs: fc.outputs } : makeEmptyReport().total,
    };
    const html = buildIndexHtml(report, '/root');
    expect(html).toContain('action.yml.html');
    expect(html).toContain('action.yml');
  });

  it('shows n/a for zero-total stats', () => {
    const html = buildIndexHtml(makeEmptyReport(), '/root');
    expect(html).toContain('n/a');
  });

  it('shows percentage for non-zero stats', () => {
    const fc = makeFileCoverage('/root/action.yml', { stepsCovered: 2, stepsTotal: 4 });
    const report: CoverageReport = {
      files: { '/root/action.yml': fc },
      total: { steps: fc.steps, ifBranches: fc.ifBranches, inputs: fc.inputs, outputs: fc.outputs },
    };
    const html = buildIndexHtml(report, '/root');
    expect(html).toContain('50.0%');
  });

  it('applies pct-high class when pct >= 80 (covers pctClass high branch)', () => {
    const fc = makeFileCoverage('/root/action.yml', { stepsCovered: 9, stepsTotal: 10 });
    const report: CoverageReport = {
      files: { '/root/action.yml': fc },
      total: { steps: fc.steps, ifBranches: fc.ifBranches, inputs: fc.inputs, outputs: fc.outputs },
    };
    const html = buildIndexHtml(report, '/root');
    expect(html).toContain('pct-high');
  });

  it('applies pct-low class when pct < 50 (covers pctClass low branch)', () => {
    const fc = makeFileCoverage('/root/action.yml', { stepsCovered: 1, stepsTotal: 10 });
    const report: CoverageReport = {
      files: { '/root/action.yml': fc },
      total: { steps: fc.steps, ifBranches: fc.ifBranches, inputs: fc.inputs, outputs: fc.outputs },
    };
    const html = buildIndexHtml(report, '/root');
    expect(html).toContain('pct-low');
  });

  it('applies pct-medium class when pct is 50-79', () => {
    const fc = makeFileCoverage('/root/action.yml', { stepsCovered: 6, stepsTotal: 10 });
    const report: CoverageReport = {
      files: { '/root/action.yml': fc },
      total: { steps: fc.steps, ifBranches: fc.ifBranches, inputs: fc.inputs, outputs: fc.outputs },
    };
    const html = buildIndexHtml(report, '/root');
    expect(html).toContain('pct-medium');
  });
});

// ── buildFileHtml ─────────────────────────────────────────────────────────────

describe('buildFileHtml', () => {
  it('returns an HTML string with doctype', () => {
    const fc = makeFileCoverage('/nonexistent/action.yml');
    const html = buildFileHtml(fc, '/root');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('includes nav link back to index (file in subdirectory)', () => {
    const fc = makeFileCoverage('/root/sub/action.yml');
    const html = buildFileHtml(fc, '/root');
    expect(html).toContain('href="../index.html"');
  });

  it('includes nav link back to index (file at root level)', () => {
    const fc = makeFileCoverage('/root/action.yml');
    const html = buildFileHtml(fc, '/root');
    expect(html).toContain('href="index.html"');
  });

  it('shows error message when source file cannot be read', () => {
    const fc = makeFileCoverage('/nonexistent/path/action.yml');
    const html = buildFileHtml(fc, '/root');
    expect(html).toContain('Could not read source');
  });

  it('renders source view for a real file with steps', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepsCovered: 1, stepsTotal: 1,
      stepHits: { 'step1': 3 },
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('source-view');
    expect(html).toContain('×3'); // hit count badge
  });

  it('renders T/F branch badges for steps with if: branches', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepsCovered: 1, stepsTotal: 1,
      ifBranchTable: [{ step: 'step1', expression: 'failure()', trueCount: 1, falseCount: 0 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('badge-t-hit');
    expect(html).toContain('badge-f-miss');
  });

  it('renders the if-branch table section when ifBranchTable is non-empty', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      ifBranchTable: [{ step: 's1', expression: 'failure()', trueCount: 0, falseCount: 1 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('If-Branch Coverage');
    expect(html).toContain('failure()');
    expect(html).toContain('pill-green'); // falseCount=1
    expect(html).toContain('pill-red');   // trueCount=0
  });

  it('renders input coverage table when inputTable is non-empty', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      inputTable: [
        { name: 'greeting', hasDefault: true, coveredProvided: true, coveredDefault: false, providedCount: 1, defaultCount: 0 },
        { name: 'token', hasDefault: false, coveredProvided: false, coveredDefault: true, providedCount: 0, defaultCount: 0 },
      ],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('Input Coverage');
    expect(html).toContain('greeting');
    expect(html).toContain('token');
    expect(html).toContain('no default'); // token has no default
  });

  it('renders default ✓ badge when hasDefault=true and coveredDefault=true', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      inputTable: [
        { name: 'greeting', hasDefault: true, coveredProvided: true, coveredDefault: true, providedCount: 2, defaultCount: 1 },
      ],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('default ✓');
  });

  it('renders miss badge (cov-miss) for uncovered step', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepsCovered: 0, stepsTotal: 1,
      stepHits: { 'step1': 0 },
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('cov-miss');
  });

  it('renders badge-t-miss when trueCount=0 (covers trueCount false branch)', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { 'step1': 1 },
      ifBranchTable: [{ step: 'step1', expression: 'failure()', trueCount: 0, falseCount: 1 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('badge-t-miss');
    expect(html).toContain('badge-f-hit');
  });

  it('uses __step_N__ id for step without id in source view (covers id ?? branch)', () => {
    const fixturePath = join(FIXTURES, 'uses-with', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { 'greet-step': 2, '__step_2__': 0 },
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('source-view');
    expect(html).toContain('×2'); // greet-step hit count
  });

  it('renders source when action has undefined steps (covers steps ?? [] branch)', () => {
    // custom-runner fixture uses non-composite 'using', so steps is undefined
    const fixturePath = join(FIXTURES, 'custom-runner', 'action.yml');
    const fc = makeFileCoverage(fixturePath);
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('source-view'); // falls through with empty annotations
  });

  it('applies chip-low class for < 50% coverage in metrics bar', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, { stepsCovered: 1, stepsTotal: 10 });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('chip-low');
  });

  it('applies chip-medium class for 50-79% coverage in metrics bar', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, { stepsCovered: 6, stepsTotal: 10 });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('chip-medium');
  });

  it('does not render if-branch table when ifBranchTable is empty', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath);
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).not.toContain('If-Branch Coverage');
  });

  it('does not render input table when inputTable is empty', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath);
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).not.toContain('Input Coverage');
  });

  it('metric chips show n/a for zero-total stats', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath); // all zero
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('n/a');
  });

  it('shows T/F badges on the if: line when step has _ifRange', () => {
    const fixturePath = join(FIXTURES, 'with-if', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { step1: 3 },
      ifBranchTable: [{ step: 'step1', expression: "inputs.greeting != ''", trueCount: 3, falseCount: 0 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    // Badge appears on the if: line (line 10), not first line (line 9)
    expect(html).toContain("if: ${{ inputs.greeting != '' }}");
    // T/F badges are present
    expect(html).toContain('badge-t-hit');
    expect(html).toContain('badge-f-miss');
  });

  it('if: line is cov-hit when condition was evaluated (trueCount or falseCount > 0)', () => {
    const fixturePath = join(FIXTURES, 'with-if', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { step1: 0 },
      ifBranchTable: [{ step: 'step1', expression: "inputs.greeting != ''", trueCount: 0, falseCount: 1 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    // if: line (line 10) should be cov-hit because falseCount=1
    // body lines (line 11, 12) should be cov-miss because hits=0
    const lines = html.split('\n');
    const ifLineHtml = lines.find((l) => l.includes("inputs.greeting != ''")) ?? '';
    expect(ifLineHtml).toContain('cov-hit');
  });

  it('if: line is cov-miss when condition was never evaluated', () => {
    const fixturePath = join(FIXTURES, 'with-if', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { step1: 0 },
      ifBranchTable: [{ step: 'step1', expression: "inputs.greeting != ''", trueCount: 0, falseCount: 0 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    const lines = html.split('\n');
    const ifLineHtml = lines.find((l) => l.includes("inputs.greeting != ''")) ?? '';
    expect(ifLineHtml).toContain('cov-miss');
  });

  it('annotates input lines with P and D badges when both covered', () => {
    const fixturePath = join(FIXTURES, 'with-if', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      inputTable: [{ name: 'greeting', hasDefault: true, coveredProvided: true, coveredDefault: true, providedCount: 3, defaultCount: 1 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('title="input: provided"');
    expect(html).toContain('title="input: default"');
    // Both covered → hit badges
    expect(html).toContain('badge-t-hit');
    expect(html).toContain('badge-f-hit');
  });

  it('annotates input lines with P miss and D miss when uncovered', () => {
    const fixturePath = join(FIXTURES, 'with-if', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      inputTable: [{ name: 'greeting', hasDefault: true, coveredProvided: false, coveredDefault: false, providedCount: 0, defaultCount: 0 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    // Both uncovered → miss badges, input block cov-miss
    const lines = html.split('\n');
    const greetingLine = lines.find((l) => l.includes('greeting:')) ?? '';
    expect(greetingLine).toContain('cov-miss');
    expect(html).toContain('badge-t-miss');
    expect(html).toContain('badge-f-miss');
  });

  it('shows no D badge when input has no default', () => {
    const fixturePath = join(FIXTURES, 'with-if', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      inputTable: [{ name: 'greeting', hasDefault: false, coveredProvided: true, coveredDefault: true, providedCount: 2, defaultCount: 0 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('title="input: provided"');
    expect(html).not.toContain('title="input: default"');
  });

  it('skips input annotation when input is not in inputTable', () => {
    const fixturePath = join(FIXTURES, 'with-if', 'action.yml');
    const fc = makeFileCoverage(fixturePath, { inputTable: [] });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).not.toContain('title="input: provided"');
  });

  it('skips input annotation when input has no _range (bare input)', () => {
    const fixturePath = join(FIXTURES, 'bare-input', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      inputTable: [{ name: 'bare', hasDefault: false, coveredProvided: true, coveredDefault: true, providedCount: 1, defaultCount: 0 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).not.toContain('title="input: provided"');
  });

  it('renders output coverage table with covered and uncovered outputs', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      outputTable: [
        { name: 'greeting', covered: true, count: 3 },
        { name: 'farewell', covered: false, count: 0 },
      ],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('Output Coverage');
    expect(html).toContain('greeting');
    expect(html).toContain('produced');
    expect(html).toContain('farewell');
    expect(html).toContain('not produced');
  });

  it('renders cov-miss for inputs never explicitly provided (regardless of hasDefault)', () => {
    // Both no-default (token) and has-default (greeting) inputs show cov-miss
    // when coveredProvided=false, even if coveredDefault=true.
    const fixturePath = join(FIXTURES, 'with-inputs', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { 'step1': 0 },
      inputTable: [
        { name: 'greeting', hasDefault: true, coveredProvided: false, coveredDefault: true, providedCount: 0, defaultCount: 1 },
        { name: 'token', hasDefault: false, coveredProvided: false, coveredDefault: true, providedCount: 0, defaultCount: 0 },
      ],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('cov-miss');
    expect(html).not.toContain('class=" cov-hit"');
  });

  it('renders cov-hit for input when coveredProvided=true', () => {
    const fixturePath = join(FIXTURES, 'with-inputs', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { 'step1': 1 },
      inputTable: [
        { name: 'greeting', hasDefault: true, coveredProvided: true, coveredDefault: false, providedCount: 1, defaultCount: 0 },
      ],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('cov-hit');
  });

  it('renders covered output source lines with cov-hit and O badge', () => {
    const fixturePath = join(FIXTURES, 'with-outputs', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { 'step1': 1 },
      outputTable: [{ name: 'greeting', covered: true, count: 1 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('cov-hit');
    expect(html).toContain('badge-t-hit');
    expect(html).toContain('title="output: produced"');
  });

  it('renders uncovered output source lines with cov-miss and O miss badge', () => {
    const fixturePath = join(FIXTURES, 'with-outputs', 'action.yml');
    const fc = makeFileCoverage(fixturePath, {
      stepHits: { 'step1': 0 },
      outputTable: [{ name: 'greeting', covered: false, count: 0 }],
    });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).toContain('badge-t-miss');
    expect(html).toContain('title="output: produced"');
  });

  it('skips output annotation when output is not in outputTable', () => {
    // with-outputs has "greeting" output, but outputTable is empty → no O badge
    const fixturePath = join(FIXTURES, 'with-outputs', 'action.yml');
    const fc = makeFileCoverage(fixturePath, { outputTable: [] });
    const html = buildFileHtml(fc, FIXTURES);
    expect(html).not.toContain('title="output: produced"');
  });
});

// ── generateHtmlReport ────────────────────────────────────────────────────────

describe('generateHtmlReport', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'actharness-html-')); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates index.html in the output directory', () => {
    generateHtmlReport(makeEmptyReport(), tmpDir);
    expect(existsSync(join(tmpDir, 'index.html'))).toBe(true);
  });

  it('index.html contains DOCTYPE', () => {
    generateHtmlReport(makeEmptyReport(), tmpDir);
    const html = readFileSync(join(tmpDir, 'index.html'), 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('creates <rel>.html for each file in the report', () => {
    const fixturePath = join(FIXTURES, 'simple', 'action.yml');
    const fc = makeFileCoverage(fixturePath);
    const report: CoverageReport = {
      files: { [fixturePath]: fc },
      total: { steps: fc.steps, ifBranches: fc.ifBranches, inputs: fc.inputs, outputs: fc.outputs },
    };
    generateHtmlReport(report, tmpDir, FIXTURES);
    expect(existsSync(join(tmpDir, 'simple', 'action.yml.html'))).toBe(true);
  });

  it('sorts files by path when report has multiple files (covers sort comparator)', () => {
    const fc1 = makeFileCoverage(join(FIXTURES, 'simple', 'action.yml'));
    const fc2 = makeFileCoverage(join(FIXTURES, 'with-if', 'action.yml'));
    const report: CoverageReport = {
      files: { [fc1.path]: fc1, [fc2.path]: fc2 },
      total: { steps: fc1.steps, ifBranches: fc1.ifBranches, inputs: fc1.inputs, outputs: fc1.outputs },
    };
    generateHtmlReport(report, tmpDir, FIXTURES);
    expect(existsSync(join(tmpDir, 'index.html'))).toBe(true);
    expect(existsSync(join(tmpDir, 'simple', 'action.yml.html'))).toBe(true);
    expect(existsSync(join(tmpDir, 'with-if', 'action.yml.html'))).toBe(true);
  });

  it('creates output directory if it does not exist', () => {
    const nested = join(tmpDir, 'nested', 'report');
    generateHtmlReport(makeEmptyReport(), nested);
    expect(existsSync(join(nested, 'index.html'))).toBe(true);
  });
});
