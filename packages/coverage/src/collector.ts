// CoverageCollector — subscribes to the run sink and accumulates Istanbul coverage.
// Downstream of the run sink; @actharness/core never imports this.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RunListener, RunResultMeta } from '@actharness/core';
import type { RunResult } from '@actharness/types';
import { parseAction } from '@actharness/core';
import { createCoverageMap } from './istanbul-compat.js';
import type { CoverageMap } from './istanbul-compat.js';
import { buildActionCoverage } from './coverage-map.js';
import type {
  CoverageReport,
  FileCoverage,
  CoverageStat,
  IfBranchRow,
  CoverageMetric,
  InputCoverageRow,
  OutputCoverageRow,
} from './types.js';

interface RawStatementEntry {
  start: { line: number; column: number };
  end: { line: number; column: number };
  _stepId?: string;
}

interface RawBranchEntry {
  _stepId?: string;
  _expression?: string;
}

interface RawMapEntry {
  path: string;
  s: Record<string, number>;
  b: Record<string, [number, number]>;
  branchMap: Record<string, RawBranchEntry>;
  statementMap: Record<string, RawStatementEntry>;
}

interface InputRecord {
  inputCounts: Record<string, { provided: number; default: number }>;
  inputDefs: Record<string, { hasDefault: boolean }>;
}

interface OutputRecord {
  // output name → how many runs produced a non-empty value
  counts: Record<string, number>;
}

export interface InputExerciseEntry {
  path: string;
  inputCounts: Record<string, { provided: number; default: number }>;
  inputDefs: Record<string, { hasDefault: boolean }>;
}

export interface OutputExerciseEntry {
  path: string;
  counts: Record<string, number>;
}

export interface StepReachedEntry {
  path: string;
  counts: Record<string, number>;
}

export interface CoverageFragment {
  istanbulMap: unknown;
  inputExercises: InputExerciseEntry[];
  outputExercises: OutputExerciseEntry[];
  stepReachedExercises: StepReachedEntry[];
}

const STEP_OUTPUT_RE = /^\$\{\{\s*steps\.([\w-]+)\.outputs\.([\w-]+)\s*\}\}$/;

function _isOutputProduced(valueExpr: string | undefined, name: string, result: RunResult): boolean {
  if (!valueExpr) return !!result.outputs[name];
  const m = STEP_OUTPUT_RE.exec(valueExpr);
  if (m) {
    const stepId = m[1]!;
    const outputKey = m[2]!;
    const stepResult = result.steps.find((r) => r.id === stepId);
    return outputKey in (stepResult?.outputs ?? {});
  }
  return !!result.outputs[name];
}

function statOf(counts: number[]): CoverageStat {
  const total = counts.length;
  const covered = counts.filter((c) => c > 0).length;
  return { covered, total, pct: total === 0 ? 100 : (covered / total) * 100 };
}

function branchStatOf(branches: [number, number][]): CoverageStat {
  const total = branches.length * 2;
  const covered = branches.reduce((acc, [t, f]) => acc + (t > 0 ? 1 : 0) + (f > 0 ? 1 : 0), 0);
  return { covered, total, pct: total === 0 ? 100 : (covered / total) * 100 };
}

function buildIfBranchTable(entry: RawMapEntry): IfBranchRow[] {
  const rows: IfBranchRow[] = [];
  for (const [id, mapping] of Object.entries(entry.branchMap)) {
    if (mapping._expression !== undefined && mapping._stepId !== undefined) {
      const counts = entry.b[id];
      rows.push({
        step: mapping._stepId,
        expression: mapping._expression,
        trueCount: counts?.[0] ?? 0,
        falseCount: counts?.[1] ?? 0,
      });
    }
  }
  return rows;
}

export class CoverageCollector {
  private _map: CoverageMap;
  private _inputData: Map<string, InputRecord>;
  private _outputData: Map<string, OutputRecord>;
  private _stepReachedData: Map<string, Record<string, number>>;

  constructor() {
    this._map = createCoverageMap({}) as unknown as CoverageMap;
    this._inputData = new Map();
    this._outputData = new Map();
    this._stepReachedData = new Map();
  }

  get coverageMap(): CoverageMap {
    return this._map;
  }

  /** Create a RunListener that updates this collector on every run. */
  createListener(): RunListener {
    return (result, meta: RunResultMeta) => {
      const actionDir = meta.actionDir ?? meta.sourceFile;
      if (!actionDir) return;

      let action;
      try {
        action = parseAction(actionDir);
      } catch {
        return;
      }

      const fileCoverage = buildActionCoverage(action, result.steps);
      this._map.addFileCoverage(fileCoverage as unknown as Parameters<CoverageMap['addFileCoverage']>[0]);

      /* v8 ignore next -- parseAction always sets _file */
      if (action._file) {
        const path = action._file;
        const reachedRecord = this._stepReachedData.get(path) ?? {};
        const steps = action.runs.steps ?? [];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]!;
          const stepId = step.id ?? `__step_${i + 1}__`;
          const stepResult = result.steps.find((r) => r.id === stepId);
          const hasExplicitIf = step.if !== undefined && step.if !== 'success()';
          const wasReached = hasExplicitIf ? stepResult !== undefined : stepResult?.ran === true;
          reachedRecord[stepId] = (reachedRecord[stepId] ?? 0) + (wasReached ? 1 : 0);
        }
        this._stepReachedData.set(path, reachedRecord);
      }

      if (meta.inputsExercised && action._file) {
        const path = action._file;
        let record = this._inputData.get(path);
        if (!record) {
          record = { inputCounts: {}, inputDefs: {} };
          for (const [name, def] of Object.entries(action.inputs ?? {})) {
            record.inputDefs[name] = { hasDefault: (def as { default?: unknown }).default !== undefined };
            record.inputCounts[name] = { provided: 0, default: 0 };
          }
          this._inputData.set(path, record);
        }
        for (const [name, variant] of Object.entries(meta.inputsExercised)) {
          if (!record.inputCounts[name]) {
            record.inputCounts[name] = { provided: 0, default: 0 };
          }
          record.inputCounts[name]![variant as 'provided' | 'default']++;
        }
      }

      // Accumulate output coverage from action-level outputs
      if (action._file && action.outputs) {
        const path = action._file;
        let outRecord = this._outputData.get(path);
        if (!outRecord) {
          outRecord = { counts: {} };
          this._outputData.set(path, outRecord);
        }
        for (const [name, def] of Object.entries(action.outputs)) {
          const produced = _isOutputProduced(def.value, name, result);
          outRecord.counts[name] = (outRecord.counts[name] ?? 0) + (produced ? 1 : 0);
        }
      }

    };
  }

  /** Convert accumulated coverage to the domain CoverageReport. */
  toCoverageReport(): CoverageReport {
    const rawMap = this._map.toJSON() as unknown as Record<string, RawMapEntry>;
    const files: Record<string, FileCoverage> = {};

    for (const entry of Object.values(rawMap)) {
      const steps = statOf(Object.values(entry.s));
      const ifBranches = branchStatOf(Object.values(entry.b));
      const ifBranchTable = buildIfBranchTable(entry);
      const inputs = this._computeInputStat(entry.path);
      const inputTable = this._buildInputTable(entry.path);
      const uncoveredSteps = Object.entries(entry.s)
        .filter(([id, count]) => count === 0 && entry.statementMap[id]?._stepId !== undefined)
        .map(([id]) => entry.statementMap[id]!._stepId!);

      const stepHits: Record<string, number> = {};
      for (const [id, count] of Object.entries(entry.s)) {
        const stepId = entry.statementMap[id]?._stepId;
        if (stepId !== undefined) stepHits[stepId] = count;
      }

      const { stat: outputs, table: outputTable } = this._computeOutputStat(entry.path);
      const stepReached: Record<string, number> = { ...(this._stepReachedData.get(entry.path) ?? {}) };

      files[entry.path] = {
        path: entry.path,
        steps,
        ifBranches,
        inputs,
        outputs,
        ifBranchTable,
        inputTable,
        outputTable,
        stepHits,
        stepReached,
        uncoveredSteps,
      };
    }

    return { files, total: aggregateTotals(Object.values(files)) };
  }

  private _computeInputStat(path: string): CoverageStat {
    const record = this._inputData.get(path);
    if (!record) return { covered: 0, total: 0, pct: 100 };

    let total = 0;
    let covered = 0;
    for (const [name, def] of Object.entries(record.inputDefs)) {
      const counts = record.inputCounts[name] ?? { provided: 0, default: 0 };
      if (def.hasDefault) {
        total += 2;
        covered += (counts.provided > 0 ? 1 : 0) + (counts.default > 0 ? 1 : 0);
      } else {
        total += 1;
        covered += counts.provided > 0 ? 1 : 0;
      }
    }

    return { covered, total, pct: total === 0 ? 100 : (covered / total) * 100 };
  }

  private _buildInputTable(path: string): InputCoverageRow[] {
    const record = this._inputData.get(path);
    if (!record) return [];
    return Object.entries(record.inputDefs).map(([name, def]) => {
      const counts = record.inputCounts[name] ?? { provided: 0, default: 0 };
      return {
        name,
        hasDefault: def.hasDefault,
        coveredProvided: counts.provided > 0,
        coveredDefault: def.hasDefault ? (counts.provided > 0 && counts.default > 0) : true,
        providedCount: counts.provided,
        defaultCount: counts.default,
      };
    });
  }

  private _computeOutputStat(path: string): { stat: CoverageStat; table: OutputCoverageRow[] } {
    const record = this._outputData.get(path);
    if (!record) return { stat: { covered: 0, total: 0, pct: 100 }, table: [] };

    const table: OutputCoverageRow[] = Object.entries(record.counts).map(([name, count]) => ({
      name,
      covered: count > 0,
      count,
    }));
    const total = table.length;
    const covered = table.filter((r) => r.covered).length;
    return { stat: { covered, total, pct: total === 0 ? 100 : (covered / total) * 100 }, table };
  }

  /** Serialize to a fragment object. */
  toFragment(): CoverageFragment {
    return {
      istanbulMap: this._map.toJSON(),
      inputExercises: Array.from(this._inputData.entries()).map(([path, data]) => ({
        path,
        inputCounts: data.inputCounts,
        inputDefs: data.inputDefs,
      })),
      outputExercises: Array.from(this._outputData.entries()).map(([path, data]) => ({
        path,
        counts: { ...data.counts },
      })),
      stepReachedExercises: Array.from(this._stepReachedData.entries()).map(([path, counts]) => ({
        path,
        counts: { ...counts },
      })),
    };
  }

  /** Merge in coverage from another collector. */
  merge(other: CoverageCollector): void {
    this._map.merge(other._map as unknown as Parameters<CoverageMap['merge']>[0]);

    for (const [path, otherRecord] of other._outputData) {
      const existing = this._outputData.get(path);
      if (!existing) {
        this._outputData.set(path, { counts: { ...otherRecord.counts } });
      } else {
        for (const [name, count] of Object.entries(otherRecord.counts)) {
          existing.counts[name] = (existing.counts[name] ?? 0) + count;
        }
      }
    }

    for (const [path, otherRecord] of other._inputData) {
      const existing = this._inputData.get(path);
      if (!existing) {
        this._inputData.set(path, {
          inputCounts: Object.fromEntries(
            Object.entries(otherRecord.inputCounts).map(([k, v]) => [k, { ...v }]),
          ),
          inputDefs: { ...otherRecord.inputDefs },
        });
      } else {
        for (const [name, counts] of Object.entries(otherRecord.inputCounts)) {
          existing.inputCounts[name] = {
            provided: (existing.inputCounts[name]?.provided ?? 0) + counts.provided,
            default: (existing.inputCounts[name]?.default ?? 0) + counts.default,
          };
        }
        for (const [name, def] of Object.entries(otherRecord.inputDefs)) {
          if (!existing.inputDefs[name]) existing.inputDefs[name] = def;
        }
      }
    }

    for (const [path, otherCounts] of other._stepReachedData) {
      const existing = this._stepReachedData.get(path);
      if (!existing) {
        this._stepReachedData.set(path, { ...otherCounts });
      } else {
        for (const [stepId, count] of Object.entries(otherCounts)) {
          existing[stepId] = (existing[stepId] ?? 0) + count;
        }
      }
    }

  }

  /** Reset to empty. */
  reset(): void {
    this._map = createCoverageMap({}) as unknown as CoverageMap;
    this._inputData = new Map();
    this._outputData = new Map();
    this._stepReachedData = new Map();
  }

  /** Write the raw JSON coverage fragment to a file. */
  flush(outputDir: string, filename = 'coverage-actharness.json'): void {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, filename), JSON.stringify(this.toFragment(), null, 2));
  }

  /** Reconstruct a CoverageCollector from a serialized fragment. */
  static fromParts(
    istanbulMap: unknown,
    inputExercises: InputExerciseEntry[],
    outputExercises: OutputExerciseEntry[] = [],
    stepReachedExercises: StepReachedEntry[] = [],
  ): CoverageCollector {
    const c = new CoverageCollector();
    (c._map as unknown as { merge(d: unknown): void }).merge(
      createCoverageMap(istanbulMap as Parameters<typeof createCoverageMap>[0]),
    );
    for (const entry of inputExercises) {
      c._inputData.set(entry.path, {
        inputCounts: Object.fromEntries(
          Object.entries(entry.inputCounts).map(([k, v]) => [k, { ...v }]),
        ),
        inputDefs: { ...entry.inputDefs },
      });
    }
    for (const entry of outputExercises) {
      c._outputData.set(entry.path, { counts: { ...entry.counts } });
    }
    for (const entry of stepReachedExercises) {
      c._stepReachedData.set(entry.path, { ...entry.counts });
    }
    return c;
  }
}

export function aggregateTotals(files: FileCoverage[]): Record<CoverageMetric, CoverageStat> {
  let stepCovered = 0, stepTotal = 0;
  let branchCovered = 0, branchTotal = 0;
  let inputCovered = 0, inputTotal = 0;
  let outCovered = 0, outTotal = 0;

  for (const f of files) {
    stepCovered += f.steps.covered;
    stepTotal += f.steps.total;
    branchCovered += f.ifBranches.covered;
    branchTotal += f.ifBranches.total;
    inputCovered += f.inputs.covered;
    inputTotal += f.inputs.total;
    outCovered += f.outputs.covered;
    outTotal += f.outputs.total;
  }

  return {
    steps: { covered: stepCovered, total: stepTotal, pct: stepTotal === 0 ? 0 : (stepCovered / stepTotal) * 100 },
    ifBranches: { covered: branchCovered, total: branchTotal, pct: branchTotal === 0 ? 0 : (branchCovered / branchTotal) * 100 },
    inputs: { covered: inputCovered, total: inputTotal, pct: inputTotal === 0 ? 0 : (inputCovered / inputTotal) * 100 },
    outputs: { covered: outCovered, total: outTotal, pct: outTotal === 0 ? 0 : (outCovered / outTotal) * 100 },
  };
}
