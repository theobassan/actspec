// ActharnessError hierarchy — one base class, typed subclasses.
// Every cross-boundary throw uses these; no bare Error across package lines.

export class ActharnessError extends Error {
  readonly code: string;
  readonly source: { file: string; line: number; col: number } | undefined;

  constructor(
    code: string,
    message: string,
    source?: { file: string; line: number; col: number },
  ) {
    super(message);
    this.name = 'ActharnessError';
    this.code = code;
    this.source = source;
  }
}

export class ParseError extends ActharnessError {
  constructor(
    message: string,
    source?: { file: string; line: number; col: number },
  ) {
    super('PARSE_ERROR', message, source);
    this.name = 'ParseError';
  }
}

export class MissingMockError extends ActharnessError {
  readonly ref: string;

  constructor(ref: string, source?: { file: string; line: number; col: number }) {
    super(
      'MISSING_MOCK',
      `No mock registered for "${ref}"\n  Fix: actharness.mock('${ref}', { outputs: { ... } })`,
      source,
    );
    this.name = 'MissingMockError';
    this.ref = ref;
  }
}

export class ExpressionError extends ActharnessError {
  constructor(message: string, source?: { file: string; line: number; col: number }) {
    super('EXPRESSION_ERROR', message, source);
    this.name = 'ExpressionError';
  }
}

export class ConfigError extends ActharnessError {
  constructor(message: string, source?: { file: string; line: number; col: number }) {
    super('CONFIG_ERROR', message, source);
    this.name = 'ConfigError';
  }
}

export class CycleError extends ActharnessError {
  constructor(path: string[]) {
    super('CYCLE_ERROR', `Cycle detected in uses: graph: ${path.join(' → ')}`);
    this.name = 'CycleError';
  }
}

export class MaxDepthError extends ActharnessError {
  constructor(depth: number) {
    super('MAX_DEPTH_ERROR', `Exceeded maximum uses: recursion depth (${depth})`);
    this.name = 'MaxDepthError';
  }
}
