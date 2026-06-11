// Custom actharness HTML coverage reporter.
// Generates self-contained HTML using the domain CoverageReport — not Istanbul.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { parseAction } from '@actharness/core';
import { offsetToLoc } from './source-map.js';
import type { CoverageReport, FileCoverage, IfBranchRow, InputCoverageRow, OutputCoverageRow } from './types.js';

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f6f8fa;color:#24292f;line-height:1.5}
a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:18px;font-weight:600;padding:16px 24px;border-bottom:1px solid #d0d7de;background:#fff}
h2{font-size:14px;font-weight:600;margin-bottom:8px}
h3{font-size:12px;font-weight:600;color:#57606a;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 6px}
nav{padding:12px 24px;background:#fff;border-bottom:1px solid #d0d7de;font-size:12px}
.container{max-width:1200px;margin:0 auto;padding:24px}
.metrics-bar{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.metric-chip{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap}
.chip-high{background:#dafbe1;color:#1a7f37;border:1px solid #aef0b8}
.chip-medium{background:#fff8c5;color:#7d4e00;border:1px solid #f5d56e}
.chip-low{background:#ffebe9;color:#cf222e;border:1px solid #ffcecb}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
th{background:#f6f8fa;padding:8px 12px;text-align:left;font-weight:600;font-size:12px;color:#57606a;border-bottom:1px solid #d0d7de}
td{padding:8px 12px;border-bottom:1px solid #eaecef;vertical-align:top}
tr:last-child td{border-bottom:none}
tr.tfoot td{background:#f6f8fa;font-weight:600;border-top:2px solid #d0d7de}
.pct-high{color:#1a7f37;font-weight:600}
.pct-medium{color:#7d4e00;font-weight:600}
.pct-low{color:#cf222e;font-weight:600}
.source-view{background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:auto;margin-bottom:20px}
.source-table{width:100%;border-collapse:collapse}
.source-table td{padding:0;vertical-align:top}
.line-num{display:block;min-width:48px;padding:1px 10px 1px 8px;text-align:right;color:#8c959f;user-select:none;border-right:1px solid #eaecef;background:#f6f8fa}
.line-content{display:block;padding:1px 12px;white-space:pre;flex:1}
.line-row{display:flex;align-items:stretch}
.cov-hit{background:#e6ffec}
.cov-miss{background:#ffebe9}
.hit-count{display:inline-block;min-width:24px;padding:0 4px;margin-right:6px;background:#1a7f37;color:#fff;border-radius:3px;font-size:11px;text-align:center;vertical-align:middle}
.hit-count-miss{display:inline-block;min-width:24px;padding:0 4px;margin-right:6px;background:#cf222e;color:#fff;border-radius:3px;font-size:11px;text-align:center;vertical-align:middle}
.badge{display:inline-block;min-width:18px;height:16px;line-height:16px;padding:0 3px;text-align:center;border-radius:3px;font-size:10px;font-weight:700;margin-right:2px;vertical-align:middle}
.badge-t-hit{background:#1a7f37;color:#fff}
.badge-t-miss{background:#cf222e;color:#fff}
.badge-f-hit{background:#1a7f37;color:#fff}
.badge-f-miss{background:#cf222e;color:#fff}
.pill{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;margin:2px}
.pill-green{background:#dafbe1;color:#1a7f37;border:1px solid #aef0b8}
.pill-red{background:#ffebe9;color:#cf222e;border:1px solid #ffcecb}
.pill-gray{background:#eaecef;color:#57606a;border:1px solid #d0d7de}
.section{margin-bottom:20px}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctClass(pct: number): string {
  if (pct >= 80) return 'pct-high';
  if (pct >= 50) return 'pct-medium';
  return 'pct-low';
}

function chipClass(pct: number): string {
  if (pct >= 80) return 'chip-high';
  if (pct >= 50) return 'chip-medium';
  return 'chip-low';
}

function fmtStat(stat: { covered: number; total: number; pct: number }): string {
  if (stat.total === 0) return '<span class="pct-high">n/a</span>';
  return `<span class="${pctClass(stat.pct)}">${stat.covered}/${stat.total} (${stat.pct.toFixed(1)}%)</span>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function page(title: string, nav: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
<h1>${esc(title)}</h1>
${nav}
<div class="container">${body}</div>
</body></html>`;
}

// ── Index page ────────────────────────────────────────────────────────────────

export function buildIndexHtml(report: CoverageReport, cwd: string): string {
  const rows = Object.values(report.files)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f, _i) => {
      const rel = relative(cwd, f.path);
      return `<tr>
  <td><a href="${rel}.html">${esc(rel)}</a></td>
  <td>${fmtStat(f.steps)}</td>
  <td>${fmtStat(f.ifBranches)}</td>
  <td>${fmtStat(f.inputs)}</td>
  <td>${fmtStat(f.outputs)}</td>
</tr>`;
    })
    .join('\n');

  const t = report.total;
  const body = `
<div class="section">
<table>
<thead><tr><th>File</th><th>Steps</th><th>If-Branches</th><th>Inputs</th><th>Outputs</th></tr></thead>
<tbody>${rows}</tbody>
<tr class="tfoot">
  <td>Total</td>
  <td>${fmtStat(t.steps)}</td>
  <td>${fmtStat(t.ifBranches)}</td>
  <td>${fmtStat(t.inputs)}</td>
  <td>${fmtStat(t.outputs)}</td>
</tr>
</table>
</div>`;
  return page('actharness coverage', '', body);
}

// ── Per-file page ─────────────────────────────────────────────────────────────

interface StepAnnotation {
  startLine: number;
  endLine: number;
  ifLine?: number | undefined;
  stepId: string;
  hits: number;
  reached: number;
  ifBranch?: IfBranchRow | undefined;
}

interface LineInputAnnotation {
  row: InputCoverageRow;
  isFirst: boolean;
}

interface LineOutputAnnotation {
  row: OutputCoverageRow;
  isFirst: boolean;
}

export function buildFileHtml(
  fc: FileCoverage,
  cwd: string,
): string {
  const rel = relative(cwd, fc.path);

  // ── Metrics bar ──
  const metricsBar = [
    { label: 'Steps', stat: fc.steps },
    { label: 'If-Branches', stat: fc.ifBranches },
    { label: 'Inputs', stat: fc.inputs },
    { label: 'Outputs', stat: fc.outputs },
  ]
    .map(({ label, stat }) => {
      const text = stat.total === 0
        ? `${label}: n/a`
        : `${label}: ${stat.covered}/${stat.total} (${stat.pct.toFixed(1)}%)`;
      return `<span class="metric-chip ${chipClass(stat.total === 0 ? 100 : stat.pct)}">${text}</span>`;
    })
    .join('');

  // ── Source view ──
  let sourceSection = '';
  try {
    const source = readFileSync(fc.path, 'utf8');
    const lines = source.split('\n');

    // Parse action to get step ranges
    const action = parseAction(fc.path);
    const steps = action.runs.steps ?? [];

    // Build step annotations indexed by step
    const annotations: StepAnnotation[] = [];
    const ifBranchByStep = new Map(fc.ifBranchTable.map((r) => [r.step, r]));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const stepId = step.id ?? `__step_${i + 1}__`;
      const hits = fc.stepHits[stepId] ?? 0;
      const reached = fc.stepReached[stepId] ?? 0;

      let startLine = i + 1;
      let endLine = i + 1;
      /* v8 ignore next -- parseAction always sets _range; unreachable from real fixture files */
      if (step._range) {
        startLine = offsetToLoc(source, step._range.start).line;
        endLine = offsetToLoc(source, step._range.end).line;
      }

      let ifLine: number | undefined;
      if (step._ifRange) {
        ifLine = offsetToLoc(source, step._ifRange.start).line;
      }

      annotations.push({
        startLine,
        endLine,
        ifLine,
        stepId,
        hits,
        reached,
        ifBranch: ifBranchByStep.get(stepId),
      });
    }

    // Build a map: line number → step annotation
    const lineAnnotation = new Map<number, StepAnnotation>();
    for (const ann of annotations) {
      for (let l = ann.startLine; l <= ann.endLine; l++) {
        lineAnnotation.set(l, ann);
      }
    }

    // Build a map: line number → input annotation
    const lineInputAnnotation = new Map<number, LineInputAnnotation>();
    const inputByName = new Map(fc.inputTable.map((r) => [r.name, r]));
    for (const [name, def] of Object.entries(action.inputs ?? {})) {
      if (!def._range) continue;
      const row = inputByName.get(name);
      if (!row) continue;
      const startLine = offsetToLoc(source, def._range.start).line;
      const endLine = offsetToLoc(source, def._range.end).line;
      for (let l = startLine; l <= endLine; l++) {
        lineInputAnnotation.set(l, { row, isFirst: l === startLine });
      }
    }

    // Build a map: line number → output annotation
    const lineOutputAnnotation = new Map<number, LineOutputAnnotation>();
    const outputByName = new Map(fc.outputTable.map((r) => [r.name, r]));
    for (const [name, def] of Object.entries(action.outputs ?? {})) {
      const row = outputByName.get(name);
      if (!row) continue;
      const valStartLine = offsetToLoc(source, def._range!.start).line;
      const endLine = offsetToLoc(source, def._range!.end).line;
      // The output key line (e.g. `  greeting:`) is one line above the value map.
      const firstLine = Math.max(valStartLine - 1, 1);
      for (let l = firstLine; l <= endLine; l++) {
        lineOutputAnnotation.set(l, { row, isFirst: l === firstLine });
      }
    }

    const lineHtml = lines.map((content, idx) => {
      const lineNum = idx + 1;
      const ann = lineAnnotation.get(lineNum);
      const inputAnn = lineInputAnnotation.get(lineNum);
      const outputAnn = lineOutputAnnotation.get(lineNum);
      const isFirstLine = ann?.startLine === lineNum;
      const isIfLine = ann?.ifLine !== undefined && ann.ifLine === lineNum;

      let covClass = '';
      if (content.trim() !== '') {
        if (ann) {
          if (isIfLine && ann.ifBranch) {
            covClass = (ann.ifBranch.trueCount > 0 || ann.ifBranch.falseCount > 0) ? ' cov-hit' : ' cov-miss';
          } else {
            covClass = ann.hits > 0 ? ' cov-hit' : ' cov-miss';
          }
        } else if (inputAnn) {
          covClass = inputAnn.row.coveredProvided ? ' cov-hit' : ' cov-miss';
        } else if (outputAnn) {
          covClass = outputAnn.row.covered ? ' cov-hit' : ' cov-miss';
        }
      }

      let badges = '';
      if (isFirstLine && ann) {
        const hc = ann.reached > 0 ? 'hit-count' : 'hit-count-miss';
        badges += `<span class="${hc}">×${ann.reached}</span>`;
      } else if (!isFirstLine && ann && !isIfLine && content.trim() !== '') {
        const hc = ann.hits > 0 ? 'hit-count' : 'hit-count-miss';
        badges += `<span class="${hc}">×${ann.hits}</span>`;
      }
      if (isFirstLine && ann && !ann.ifLine && ann.ifBranch) {
        const tb = ann.ifBranch.trueCount > 0 ? 'badge-t-hit' : 'badge-t-miss';
        const fb = ann.ifBranch.falseCount > 0 ? 'badge-f-hit' : 'badge-f-miss';
        badges += `<span class="badge ${tb}" title="if: true branch">T ×${ann.ifBranch.trueCount}</span>`;
        badges += `<span class="badge ${fb}" title="if: false branch">F ×${ann.ifBranch.falseCount}</span>`;
      }
      if (isIfLine && ann?.ifBranch) {
        const tb = ann.ifBranch.trueCount > 0 ? 'badge-t-hit' : 'badge-t-miss';
        const fb = ann.ifBranch.falseCount > 0 ? 'badge-f-hit' : 'badge-f-miss';
        badges += `<span class="badge ${tb}" title="if: true branch">T ×${ann.ifBranch.trueCount}</span>`;
        badges += `<span class="badge ${fb}" title="if: false branch">F ×${ann.ifBranch.falseCount}</span>`;
      }
      if (inputAnn?.isFirst) {
        const pb = inputAnn.row.coveredProvided ? 'badge-t-hit' : 'badge-t-miss';
        badges += `<span class="badge ${pb}" title="input: provided">P ×${inputAnn.row.providedCount}</span>`;
        if (inputAnn.row.hasDefault) {
          const db = inputAnn.row.coveredDefault ? 'badge-f-hit' : 'badge-f-miss';
          badges += `<span class="badge ${db}" title="input: default">D ×${inputAnn.row.defaultCount}</span>`;
        }
      }
      if (outputAnn?.isFirst) {
        const ob = outputAnn.row.covered ? 'badge-t-hit' : 'badge-t-miss';
        badges += `<span class="badge ${ob}" title="output: produced">O ×${outputAnn.row.count}</span>`;
      }

      return `<tr>
  <td><span class="line-num">${lineNum}</span></td>
  <td class="${covClass}"><span class="line-content">${badges}${esc(content)}</span></td>
</tr>`;
    }).join('\n');

    sourceSection = `
<div class="section">
<h2>Source</h2>
<div class="source-view">
<table class="source-table"><tbody>${lineHtml}</tbody></table>
</div>
</div>`;
  } catch {
    sourceSection = `<p style="color:#cf222e">Could not read source: ${esc(fc.path)}</p>`;
  }

  // ── If-branch table ──
  let ifSection = '';
  if (fc.ifBranchTable.length > 0) {
    const rows = fc.ifBranchTable.map((r) => {
      const tBadge = r.trueCount > 0
        ? '<span class="pill pill-green">T ✓</span>'
        : '<span class="pill pill-red">T ✗</span>';
      const fBadge = r.falseCount > 0
        ? '<span class="pill pill-green">F ✓</span>'
        : '<span class="pill pill-red">F ✗</span>';
      return `<tr>
  <td>${esc(r.step)}</td>
  <td>${esc(r.expression)}</td>
  <td>${tBadge} ${fBadge}</td>
</tr>`;
    }).join('\n');
    ifSection = `
<div class="section">
<h2>If-Branch Coverage</h2>
<table>
<thead><tr><th>Step</th><th>Expression</th><th>Branches</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>`;
  }

  // ── Input table ──
  let inputSection = '';
  if (fc.inputTable.length > 0) {
    const rows = fc.inputTable.map((r: InputCoverageRow) => {
      const provBadge = r.coveredProvided
        ? '<span class="pill pill-green">provided ✓</span>'
        : '<span class="pill pill-red">provided ✗</span>';
      const defBadge = r.hasDefault
        ? (r.coveredDefault
          ? '<span class="pill pill-green">default ✓</span>'
          : '<span class="pill pill-red">default ✗</span>')
        : '<span class="pill pill-gray">no default</span>';
      return `<tr><td>${esc(r.name)}</td><td>${provBadge} ${defBadge}</td></tr>`;
    }).join('\n');
    inputSection = `
<div class="section">
<h2>Input Coverage</h2>
<table>
<thead><tr><th>Input</th><th>Coverage</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>`;
  }

  // ── Output table ──
  let outputSection = '';
  if (fc.outputTable.length > 0) {
    const rows = fc.outputTable.map((r: OutputCoverageRow) => {
      const badge = r.covered
        ? '<span class="pill pill-green">✓ produced</span>'
        : '<span class="pill pill-red">✗ not produced</span>';
      return `<tr><td>${esc(r.name)}</td><td>${badge}</td></tr>`;
    }).join('\n');
    outputSection = `
<div class="section">
<h2>Output Coverage</h2>
<table>
<thead><tr><th>Output</th><th>Coverage</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>`;
  }

  const depth = dirname(rel);
  const backLink = depth === '.' ? 'index.html' : relative(depth, 'index.html');
  const nav = `<nav><a href="${backLink}">← Summary</a> / ${esc(rel)}</nav>`;
  const body = `
<div class="metrics-bar">${metricsBar}</div>
${sourceSection}
${ifSection}
${inputSection}
${outputSection}`;

  return page(`actharness coverage — ${basename(fc.path)}`, nav, body);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function generateHtmlReport(report: CoverageReport, dir: string, cwd = process.cwd()): void {
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, 'index.html'), buildIndexHtml(report, cwd));

  const sortedFiles = Object.values(report.files).sort((a, b) => a.path.localeCompare(b.path));
  for (const fc of sortedFiles) {
    const rel = relative(cwd, fc.path);
    const htmlPath = join(dir, rel + '.html');
    mkdirSync(dirname(htmlPath), { recursive: true });
    writeFileSync(htmlPath, buildFileHtml(fc, cwd));
  }
}
