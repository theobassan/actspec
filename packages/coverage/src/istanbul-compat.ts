// CJS bridge for istanbul-lib-* packages.
// These packages are CommonJS — in ESM we must import them as default imports.

import libCovPkg from 'istanbul-lib-coverage';
import libReportPkg from 'istanbul-lib-report';
import reportsPkg from 'istanbul-reports';

export const { createCoverageMap, createFileCoverage } = libCovPkg;
export type { CoverageMap, FileCoverage } from 'istanbul-lib-coverage';

export const { createContext } = libReportPkg;
export type { Context, ContextOptions } from 'istanbul-lib-report';

export const createReport = reportsPkg.create;
