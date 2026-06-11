// Domain types for @actharness/coverage public API.

export type ReporterName =
  | 'text'
  | 'text-summary'
  | 'lcov'
  | 'lcovonly'
  | 'html'
  | 'html-spa'
  | 'json'
  | 'json-summary'
  | 'cobertura'
  | 'clover'
  | 'teamcity'
  | 'none';

export type CoverageMetric = 'steps' | 'ifBranches' | 'inputs' | 'outputs';

export interface CoverageStat {
  covered: number;
  total: number;
  pct: number;
}

export interface IfBranchRow {
  step: string;
  expression: string;
  trueCount: number;
  falseCount: number;
}

export interface InputCoverageRow {
  name: string;
  hasDefault: boolean;
  coveredProvided: boolean;
  coveredDefault: boolean;
  providedCount: number;
  defaultCount: number;
}

export interface OutputCoverageRow {
  name: string;
  covered: boolean;
  count: number;
}

export interface FileCoverage {
  path: string;
  steps: CoverageStat;
  ifBranches: CoverageStat;
  inputs: CoverageStat;
  outputs: CoverageStat;
  ifBranchTable: IfBranchRow[];
  inputTable: InputCoverageRow[];
  outputTable: OutputCoverageRow[];
  /** Per-step body execution counts (stepId → times body ran). */
  stepHits: Record<string, number>;
  /** Per-step reached counts (stepId → times condition evaluated or step processed). */
  stepReached: Record<string, number>;
  uncoveredSteps: string[];
}

export interface CoverageReport {
  files: Record<string, FileCoverage>;
  total: Record<CoverageMetric, CoverageStat>;
}

export interface CoverageOptions {
  include?: string[];
  exclude?: string[];
  reporters?: ReporterName[];
  coverageDir?: string;
  thresholds?: Partial<Record<CoverageMetric, number>>;
}
