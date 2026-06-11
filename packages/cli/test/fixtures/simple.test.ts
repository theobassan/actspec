// Fixture test file — no imports, uses globals injected by actharness test.
// Used by the CLI integration test.

describe('simple', () => {
  it('1 + 1 is 2', () => {
    expect(1 + 1).toBe(2);
  });

  it('string match', () => {
    expect('hello world').toMatch('hello');
  });
});
