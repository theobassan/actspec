// Custom actharness text coverage reporter.
// Prints a table using the domain CoverageReport — not Istanbul.

import { relative } from 'node:path';
import type { CoverageReport, CoverageStat } from './types.js';

function fmtPct(stat: CoverageStat, width = 6): string {
  if (stat.total === 0) return 'n/a'.padStart(width);
  return `${stat.pct.toFixed(1)}%`.padStart(width);
}

function fmtFraction(stat: CoverageStat, width = 10): string {
  if (stat.total === 0) return 'n/a'.padStart(width);
  return `${stat.covered}/${stat.total}`.padStart(width);
}

function bar(pct: number, width = 10): string {
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** Generate the full text table string for the coverage report. */
export function buildTextReport(report: CoverageReport, cwd = process.cwd()): string {
  const COL_FILE = 36;
  const COL_STAT = 14;

  const row = (...cells: string[]) => `| ${cells.join(' | ')} |`;

  const header = row(
    'File'.padEnd(COL_FILE),
    'Steps'.padEnd(COL_STAT),
    'If-Branches'.padEnd(COL_STAT),
    'Inputs'.padEnd(COL_STAT),
    'Outputs'.padEnd(COL_STAT),
  );

  const divider = '-'.repeat(header.length);

  const fileRows = Object.values(report.files)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => {
      const rel = relative(cwd, f.path).padEnd(COL_FILE).slice(0, COL_FILE);
      return row(
        rel,
        `${fmtPct(f.steps)} ${fmtFraction(f.steps, 7)}`.padStart(COL_STAT),
        `${fmtPct(f.ifBranches)} ${fmtFraction(f.ifBranches, 7)}`.padStart(COL_STAT),
        `${fmtPct(f.inputs)} ${fmtFraction(f.inputs, 7)}`.padStart(COL_STAT),
        `${fmtPct(f.outputs)} ${fmtFraction(f.outputs, 7)}`.padStart(COL_STAT),
      );
    });

  const t = report.total;
  const totalRow = row(
    'All files'.padEnd(COL_FILE),
    `${fmtPct(t.steps)} ${fmtFraction(t.steps, 7)}`.padStart(COL_STAT),
    `${fmtPct(t.ifBranches)} ${fmtFraction(t.ifBranches, 7)}`.padStart(COL_STAT),
    `${fmtPct(t.inputs)} ${fmtFraction(t.inputs, 7)}`.padStart(COL_STAT),
    `${fmtPct(t.outputs)} ${fmtFraction(t.outputs, 7)}`.padStart(COL_STAT),
  );

  return [divider, header, divider, ...fileRows, divider, totalRow, divider].join('\n');
}

/** Generate a short single-line summary. */
export function buildTextSummary(report: CoverageReport): string {
  const t = report.total;
  const parts: string[] = [];
  if (t.steps.total > 0) parts.push(`Steps: ${t.steps.pct.toFixed(1)}% ${bar(t.steps.pct)}`);
  if (t.ifBranches.total > 0) parts.push(`If-Branches: ${t.ifBranches.pct.toFixed(1)}% ${bar(t.ifBranches.pct)}`);
  if (t.inputs.total > 0) parts.push(`Inputs: ${t.inputs.pct.toFixed(1)}% ${bar(t.inputs.pct)}`);
  if (t.outputs.total > 0) parts.push(`Outputs: ${t.outputs.pct.toFixed(1)}% ${bar(t.outputs.pct)}`);
  return parts.length === 0 ? 'No coverage data.' : parts.join('  |  ');
}
