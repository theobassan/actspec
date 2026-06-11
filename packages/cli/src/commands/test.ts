// actharness test — purpose-built test runner on top of node:test.

import { run } from 'node:test';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { glob } from 'glob';
import { CoverageCollector, generateReports, generateActharnessReports, ACTHARNESS_REPORTER_NAMES } from '@actharness/coverage';
import type { ReporterName, CoverageMetric } from '@actharness/coverage';
import type { InputExerciseEntry, OutputExerciseEntry, StepReachedEntry } from '@actharness/coverage';
import { loadConfig } from '../config.js';
import type { ActharnessConfig } from '../config.js';

export interface TestOptions {
  patterns: string[];
  coverage: boolean;
  reporters: ReporterName[];
  coverageDir: string;
  thresholds: Record<string, number>;
}

export interface TestResult {
  passed: number;
  failed: number;
  thresholdFailed: boolean;
}

export function parseTestArgs(args: string[], config: ActharnessConfig = {}): TestOptions {
  const patterns: string[] = [];
  const reporters: ReporterName[] = [];
  const thresholds: Record<string, number> = { ...config.thresholds };
  let coverage = config.coverage ?? false;
  let coverageDir = config.coverageDir
    ? resolve(process.cwd(), config.coverageDir)
    : join(process.cwd(), 'coverage');

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--coverage') {
      coverage = true;
    } else if (arg === '--reporter' && i + 1 < args.length) {
      reporters.push(args[++i]! as ReporterName);
    } else if (arg === '--coverage-dir' && i + 1 < args.length) {
      coverageDir = resolve(process.cwd(), args[++i]!);
    } else if (arg === '--threshold' && i + 1 < args.length) {
      const pair = args[++i]!;
      const eq = pair.indexOf('=');
      if (eq !== -1) {
        thresholds[pair.slice(0, eq)] = Number(pair.slice(eq + 1));
      }
    } else if (!arg.startsWith('--')) {
      patterns.push(arg);
    }
  }

  if (patterns.length === 0) {
    if (config.patterns && config.patterns.length > 0) {
      patterns.push(...config.patterns);
    } else {
      patterns.push('**/*.{actharness,test}.ts');
    }
  }

  if (coverage && reporters.length === 0) {
    if (config.reporters && config.reporters.length > 0) {
      reporters.push(...(config.reporters as ReporterName[]));
    } else {
      reporters.push('lcov', 'html', 'text');
    }
  }

  return { patterns, coverage, reporters, coverageDir, thresholds };
}

export function defaultRegisterUrl(): string {
  return pathToFileURL(
    fileURLToPath(new URL('./register.js', import.meta.url)),
  ).href;
}

export function checkThresholds(
  collector: CoverageCollector,
  thresholds: Record<string, number>,
  outDir: string,
): boolean {
  if (Object.keys(thresholds).length === 0) return false;
  const report = collector.toCoverageReport();
  let failed = false;
  for (const [key, min] of Object.entries(thresholds)) {
    const stat = report.total[key as CoverageMetric];
    const pct = stat?.pct ?? 0;
    if (pct < min) {
      console.error(`Coverage threshold not met: ${key} ${pct.toFixed(2)}% < ${min}%`);
      failed = true;
    }
  }
  if (failed) {
    console.error(`See ${outDir}/ for the full coverage report`);
  }
  return failed;
}

export function mergeCoverageData(tmpDir: string): CoverageCollector {
  const collector = new CoverageCollector();
  for (const file of readdirSync(tmpDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(readFileSync(join(tmpDir, file), 'utf8')) as {
        istanbulMap?: unknown;
        inputExercises?: InputExerciseEntry[];
        outputExercises?: OutputExerciseEntry[];
        stepReachedExercises?: StepReachedEntry[];
      };
      const fragment = CoverageCollector.fromParts(
        raw.istanbulMap ?? raw,
        raw.inputExercises ?? [],
        raw.outputExercises ?? [],
        raw.stepReachedExercises ?? [],
      );
      collector.merge(fragment);
    } catch {
      // skip malformed fragments
    }
  }
  return collector;
}

type RawTestEvent = { type: string; data: unknown };
type PassData = { name: string; nesting: number; details: { duration_ms: number } };
type FailData = { name: string; nesting: number; details: { duration_ms: number; error: Error } };

export async function runTests(
  opts: TestOptions,
  registerUrl = defaultRegisterUrl(),
  tsxEsmUrl = import.meta.resolve('tsx/esm'),
): Promise<TestResult> {
  const { patterns, coverage, reporters, coverageDir, thresholds } = opts;

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      ignore: ['node_modules/**'],
      absolute: true,
      cwd: process.cwd(),
    });
    files.push(...matches);
  }

  if (files.length === 0) {
    console.error(`actharness: no test files found for: ${patterns.join(', ')}`);
    return { passed: 0, failed: 1, thresholdFailed: false };
  }

  const coverageTmpDir = coverage
    ? join(tmpdir(), `actharness-cov-${process.hrtime.bigint()}`)
    : undefined;

  if (coverageTmpDir) {
    mkdirSync(coverageTmpDir, { recursive: true });
    process.env['ACTHARNESS_COVERAGE_TMP'] = coverageTmpDir;
  }

  const execArgv: string[] = ['--import', tsxEsmUrl, '--import', registerUrl];
  // node:test run() types vary by @types/node version; cast to accept execArgv.
  const stream = run({ files, concurrency: true, execArgv } as Parameters<typeof run>[0]);

  let passed = 0;
  let failed = 0;

  for await (const raw of stream) {
    const event = raw as RawTestEvent;
    if (event.type === 'test:pass') {
      const d = event.data as PassData;
      if (d.nesting === 0) {
        passed++;
        console.log(`  ✓ ${d.name}`);
      }
    } else if (event.type === 'test:fail') {
      const d = event.data as FailData;
      if (d.nesting === 0) {
        failed++;
        const err = d.details.error;
        console.log(`  ✗ ${d.name}`);
        console.log(`    ${err?.message ?? String(err)}`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (coverageTmpDir) {
    delete process.env['ACTHARNESS_COVERAGE_TMP'];
    const collector = mergeCoverageData(coverageTmpDir);
    mkdirSync(coverageDir, { recursive: true });
    const istanbulReporters = reporters.filter((r) => !ACTHARNESS_REPORTER_NAMES.has(r));
    const actharnessReporters = reporters.filter((r) => ACTHARNESS_REPORTER_NAMES.has(r));
    generateReports(collector.coverageMap, { reporters: istanbulReporters, dir: coverageDir, projectRoot: process.cwd() });
    if (actharnessReporters.length > 0) {
      generateActharnessReports(collector.toCoverageReport(), { reporters: actharnessReporters, dir: coverageDir, cwd: process.cwd() });
    }
    writeFileSync(
      join(coverageDir, 'coverage-final.json'),
      JSON.stringify(collector.coverageMap.toJSON(), null, 2),
    );
    console.log(`\nCoverage report written to ${coverageDir}/`);
    const thresholdFailed = checkThresholds(collector, thresholds, coverageDir);
    return { passed, failed, thresholdFailed };
  }

  return { passed, failed, thresholdFailed: false };
}

export async function testCommand(
  args: string[],
  registerUrl?: string,
  tsxEsmUrl?: string,
): Promise<number> {
  const config = await loadConfig(process.cwd());
  const opts = parseTestArgs(args, config);
  const { failed, thresholdFailed } = await runTests(opts, registerUrl, tsxEsmUrl);
  return failed > 0 || thresholdFailed ? 1 : 0;
}
