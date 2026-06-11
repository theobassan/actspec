// Istanbul reporter helpers — wrap createReport + createContext for convenience.
// Custom actharness reporters (html, text) are handled separately via generateActharnessReports.

import { join } from 'node:path';
import { createContext, createReport } from './istanbul-compat.js';
import type { CoverageMap, ContextOptions } from './istanbul-compat.js';
import type { CoverageReport, ReporterName } from './types.js';
import { generateHtmlReport } from './html-reporter.js';
import { buildTextReport, buildTextSummary } from './text-reporter.js';

export type { ReporterName } from './types.js';

export interface ReportOptions {
  reporters?: ReporterName[];
  dir?: string;
  projectRoot?: string;
}

/** Reporter names handled by the custom actharness renderer (not Istanbul). */
export const ACTHARNESS_REPORTER_NAMES: ReadonlySet<ReporterName> = new Set([
  'html',
  'html-spa',
  'text',
  'text-summary',
]);

/**
 * Generate Istanbul machine-readable reports (lcov, json, cobertura, etc.).
 * html/text reporters are intentionally excluded — use generateActharnessReports for those.
 */
export function generateReports(map: CoverageMap, opts: ReportOptions = {}): void {
  const reporters = (opts.reporters ?? ['lcov', 'html', 'text']).filter(
    (r) => !ACTHARNESS_REPORTER_NAMES.has(r),
  );
  if (reporters.length === 0) return;

  const dir = opts.dir ?? join(process.cwd(), 'coverage');
  const ctxOpts: Partial<ContextOptions> = { dir, coverageMap: map };
  const ctx = createContext(ctxOpts);

  for (const name of reporters) {
    const report = createReport(name, { projectRoot: opts.projectRoot ?? process.cwd() });
    (report as { execute: (ctx: unknown) => void }).execute(ctx);
  }
}

export interface ActharnessReportOptions {
  reporters?: ReporterName[];
  dir?: string;
  cwd?: string;
}

/**
 * Generate actharness-native reports (html, html-spa, text, text-summary).
 * Shows Steps / If-Branches / Inputs / With-Inputs — not Istanbul vocabulary.
 */
export function generateActharnessReports(
  domainReport: CoverageReport,
  opts: ActharnessReportOptions = {},
): void {
  const reporters = opts.reporters ?? ['html', 'text'];
  const dir = opts.dir ?? join(process.cwd(), 'coverage');
  const cwd = opts.cwd ?? process.cwd();

  for (const name of reporters) {
    if (name === 'html' || name === 'html-spa') {
      generateHtmlReport(domainReport, dir, cwd);
    } else if (name === 'text') {
      console.log('\n' + buildTextReport(domainReport, cwd));
    } else if (name === 'text-summary') {
      console.log('\n' + buildTextSummary(domainReport));
    }
  }
}
