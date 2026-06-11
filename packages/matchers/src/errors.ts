// MatchError — thrown by matchers when assertions fail.
// Message format mirrors vitest/jest for easy reading in test output.

export class MatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchError';
  }
}

export function fail(message: string): never {
  throw new MatchError(message);
}
