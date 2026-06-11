// Build Istanbul FileCoverage from a ParsedAction + StepResult[].
// Steps → statements; if: conditions → branches.

import { readFileSync } from 'node:fs';
import type { ParsedAction, StepResult } from '@actharness/types';
import { createFileCoverage } from './istanbul-compat.js';
import type { FileCoverage } from './istanbul-compat.js';
import { nodeRangeToIstanbul } from './source-map.js';
import type { IstanbulRange } from './source-map.js';

export interface IstanbulBranchMapping {
  loc: IstanbulRange;
  type: string;
  locations: IstanbulRange[];
  line: number;
  _stepId?: string;
  _expression?: string;
}

interface IstanbulFunctionMapping {
  name: string;
  decl: IstanbulRange;
  loc: IstanbulRange;
  line: number;
}

interface RawFileCoverageData {
  path: string;
  statementMap: Record<string, IstanbulRange & { _stepId?: string }>;
  s: Record<string, number>;
  branchMap: Record<string, IstanbulBranchMapping>;
  b: Record<string, [number, number]>;
  fnMap: Record<string, IstanbulFunctionMapping>;
  f: Record<string, number>;
}

function emptyData(path: string): RawFileCoverageData {
  return {
    path,
    statementMap: {},
    s: {},
    branchMap: {},
    b: {},
    fnMap: {},
    f: {},
  };
}


/** Build Istanbul FileCoverage for one action.yml invocation (current run only; accumulation is handled by the map). */
export function buildActionCoverage(
  action: ParsedAction,
  stepResults: StepResult[],
): FileCoverage {
  const filePath = action._file;
  if (!filePath) {
    return createFileCoverage(emptyData('???')) as unknown as FileCoverage;
  }

  let source: string | undefined;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    source = undefined;
  }

  const steps = action.runs.steps ?? [];

  const statementMap: Record<string, IstanbulRange & { _stepId?: string }> = {};
  const s: Record<string, number> = {};
  const branchMap: Record<string, IstanbulBranchMapping> = {};
  const b: Record<string, [number, number]> = {};
  const fnMap: Record<string, IstanbulFunctionMapping> = {};
  const f: Record<string, number> = {};

  let branchCounter = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const stepId = step.id ?? `__step_${i + 1}__`;
    const result = stepResults.find((r) => r.id === stepId);

    const sId = String(i);
    const range: IstanbulRange =
      step._range && source
        ? nodeRangeToIstanbul(source, step._range.start, step._range.end)
        : { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 0 } };

    statementMap[sId] = { ...range, _stepId: stepId };
    s[sId] = result?.ran === true ? 1 : 0;

    // Branch: only for explicit if: (not the implied success())
    // bId uses a sequential counter (not step index) to match Istanbul's internal renormalisation.
    if (step.if !== undefined && step.if !== 'success()') {
      const bId = String(branchCounter++);
      branchMap[bId] = {
        loc: range,
        type: 'if',
        locations: [range, range],
        line: range.start.line,
        _stepId: stepId,
        _expression: step.if,
      };

      const ifResult = result?.if?.result;
      b[bId] = [ifResult === true ? 1 : 0, ifResult === false ? 1 : 0];
    }
  }

  // The entire action is one "function"
  const actionRange: IstanbulRange = { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } };
  fnMap['0'] = {
    name: action.name || 'action',
    decl: actionRange,
    loc: actionRange,
    line: 1,
  };
  const anyRan = stepResults.some((r) => r.ran);
  f['0'] = anyRan ? 1 : 0;

  return createFileCoverage({
    path: filePath,
    statementMap,
    s,
    branchMap: branchMap as unknown as Record<string, import('istanbul-lib-coverage').BranchMapping>,
    b,
    fnMap: fnMap as unknown as Record<string, import('istanbul-lib-coverage').FunctionMapping>,
    f,
  }) as unknown as FileCoverage;
}
