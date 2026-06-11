import { describe, it, expect } from 'vitest';
import { writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  allocateProtocolFiles,
  parseEnvFile,
  parseEnvFileContent,
  parsePathFile,
  parseStdoutCommands,
  applyMasks,
} from '../src/protocol.js';

// ── allocateProtocolFiles ─────────────────────────────────────────────────────

describe('allocateProtocolFiles', () => {
  it('creates all five protocol files', () => {
    const proto = allocateProtocolFiles();
    expect(existsSync(proto.output)).toBe(true);
    expect(existsSync(proto.env)).toBe(true);
    expect(existsSync(proto.state)).toBe(true);
    expect(existsSync(proto.path)).toBe(true);
    expect(existsSync(proto.summary)).toBe(true);
  });
});

// ── parseEnvFileContent ───────────────────────────────────────────────────────

describe('parseEnvFileContent', () => {
  it('returns empty object for empty content', () => {
    expect(parseEnvFileContent('')).toEqual({});
    expect(parseEnvFileContent('   \n  ')).toEqual({});
  });

  it('parses NAME=VALUE form', () => {
    const result = parseEnvFileContent('FOO=bar\nBAZ=qux\n');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('preserves empty value after =', () => {
    expect(parseEnvFileContent('EMPTY=')).toEqual({ EMPTY: '' });
  });

  it('parses VALUE with = inside', () => {
    expect(parseEnvFileContent('KEY=a=b=c')).toEqual({ KEY: 'a=b=c' });
  });

  it('parses heredoc form', () => {
    const content = 'MULTI_LINE<<EOF\nline one\nline two\nEOF\n';
    expect(parseEnvFileContent(content)).toEqual({
      MULTI_LINE: 'line one\nline two',
    });
  });

  it('parses heredoc with unique delimiter', () => {
    const content = 'VAR<<ghx_delimiter_abc123\nhello world\nghx_delimiter_abc123\n';
    expect(parseEnvFileContent(content)).toEqual({ VAR: 'hello world' });
  });

  it('ignores line with no = sign (not heredoc, not key=value)', () => {
    expect(parseEnvFileContent('FOOBAR\n')).toEqual({});
  });

  it('skips heredoc when name contains the delimiter (CVE guard)', () => {
    const content = 'NAME<<NAME\nvalue\nNAME\n';
    expect(parseEnvFileContent(content)).toEqual({});
  });

  it('handles multiple entries mixed', () => {
    const content = 'SIMPLE=value\nBIG<<END\nfoo\nbar\nEND\nAFTER=yes\n';
    expect(parseEnvFileContent(content)).toEqual({
      SIMPLE: 'value',
      BIG: 'foo\nbar',
      AFTER: 'yes',
    });
  });
});

// ── parseEnvFile ──────────────────────────────────────────────────────────────

describe('parseEnvFile', () => {
  it('reads and parses a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'actharness-test-'));
    const file = join(dir, 'env');
    writeFileSync(file, 'X=1\nY=2\n');
    expect(parseEnvFile(file)).toEqual({ X: '1', Y: '2' });
  });

  it('returns empty object for nonexistent file', () => {
    expect(parseEnvFile('/does/not/exist')).toEqual({});
  });
});

// ── parseStdoutCommands ───────────────────────────────────────────────────────

describe('parseStdoutCommands', () => {
  it('returns empty arrays for plain stdout', () => {
    const result = parseStdoutCommands('hello world\nno commands here\n');
    expect(result.annotations).toHaveLength(0);
    expect(result.legacyOutputs).toEqual({});
    expect(result.masks).toHaveLength(0);
  });

  it('parses ::error:: annotation', () => {
    const result = parseStdoutCommands('::error::Something went wrong');
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toMatchObject({
      level: 'error',
      message: 'Something went wrong',
    });
  });

  it('parses ::warning file=foo.ts,line=10::message', () => {
    const result = parseStdoutCommands('::warning file=foo.ts,line=10::watch out');
    expect(result.annotations[0]).toMatchObject({
      level: 'warning',
      message: 'watch out',
      file: 'foo.ts',
      line: 10,
    });
  });

  it('parses ::notice:: and ::debug::', () => {
    const out = '::notice::note here\n::debug::debug here';
    const result = parseStdoutCommands(out);
    expect(result.annotations[0]?.level).toBe('notice');
    expect(result.annotations[1]?.level).toBe('debug');
  });

  it('parses ::add-mask::', () => {
    const result = parseStdoutCommands('::add-mask::supersecret');
    expect(result.masks).toContain('supersecret');
  });

  it('parses deprecated ::set-output name=NAME::VALUE', () => {
    const result = parseStdoutCommands('::set-output name=result::42');
    expect(result.legacyOutputs).toEqual({ result: '42' });
  });

  it('parses deprecated ::save-state name=STATE::VALUE', () => {
    const result = parseStdoutCommands('::save-state name=mystate::stored');
    expect(result.legacyState).toEqual({ mystate: 'stored' });
  });

  it('parses deprecated ::add-path::', () => {
    const result = parseStdoutCommands('::add-path::/usr/local/bin');
    expect(result.addedPaths).toContain('/usr/local/bin');
  });

  it('respects ::stop-commands token::', () => {
    const out = [
      '::stop-commands::endblock',
      '::error::this should be ignored',
      '::endblock::',
      '::warning::this should appear',
    ].join('\n');
    const result = parseStdoutCommands(out);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]?.level).toBe('warning');
  });

  it('decodes %25 in data last (after %0A)', () => {
    // encoded: %25 → %, %0A → \n
    const result = parseStdoutCommands('::error::hello%0Aworld');
    expect(result.annotations[0]?.message).toBe('hello\nworld');
  });

  it('decodes %25 in property value', () => {
    const result = parseStdoutCommands('::set-output name=x%3Ay::value');
    expect(result.legacyOutputs['x:y']).toBe('value');
  });

  it('ignores lines not starting with ::', () => {
    const result = parseStdoutCommands('normal output\n::debug::ok\n::error::oops');
    expect(result.annotations).toHaveLength(2);
  });

  it('skips malformed :: lines that do not match command format', () => {
    // '::::' starts with '::' but has no command name → parseWorkflowCommand returns null
    const result = parseStdoutCommands('::::\nnormal\n::debug::ok');
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]?.level).toBe('debug');
  });

  it('parses annotation col property', () => {
    const result = parseStdoutCommands('::error file=src/a.ts,line=5,col=10::msg');
    expect(result.annotations[0]?.col).toBe(10);
  });

  it('parses annotation endColumn property as col', () => {
    const result = parseStdoutCommands('::warning endColumn=3::msg');
    expect(result.annotations[0]?.col).toBe(3);
  });

  it('ignores command property with no = sign', () => {
    const result = parseStdoutCommands('::error badprop::msg');
    expect(result.annotations[0]?.message).toBe('msg');
  });

  it('ignores ::add-mask:: with empty data', () => {
    const result = parseStdoutCommands('::add-mask::');
    expect(result.masks).toHaveLength(0);
  });

  it('ignores ::add-path:: with empty data', () => {
    const result = parseStdoutCommands('::add-path::');
    expect(result.addedPaths).toHaveLength(0);
  });

  it('ignores ::set-output:: with no name property', () => {
    const result = parseStdoutCommands('::set-output::orphan');
    expect(result.legacyOutputs).toEqual({});
  });

  it('ignores ::save-state:: with no name property', () => {
    const result = parseStdoutCommands('::save-state::orphan');
    expect(result.legacyState).toEqual({});
  });

  it('stop-commands with empty data uses null as token and processes subsequent lines', () => {
    // ::stop-commands:: with empty data → stopToken = null immediately, doesn't stop
    const result = parseStdoutCommands('::stop-commands::\n::debug::should appear');
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]?.level).toBe('debug');
  });
});

// ── parsePathFile ─────────────────────────────────────────────────────────────

describe('parsePathFile', () => {
  it('returns an array of paths from file contents, one per line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'actharness-test-'));
    const file = join(dir, 'path');
    writeFileSync(file, '/usr/local/bin\n/custom/bin\n');
    expect(parsePathFile(file)).toEqual(['/usr/local/bin', '/custom/bin']);
  });

  it('returns empty array when file does not exist', () => {
    expect(parsePathFile('/does/not/exist/path')).toEqual([]);
  });

  it('filters out blank and whitespace-only lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'actharness-test-'));
    const file = join(dir, 'path');
    writeFileSync(file, '/bin\n\n   \n/usr/bin\n');
    expect(parsePathFile(file)).toEqual(['/bin', '/usr/bin']);
  });
});

// ── applyMasks ────────────────────────────────────────────────────────────────

describe('applyMasks', () => {
  it('replaces masked values with ***', () => {
    const masks = new Set(['supersecret', 'mytoken']);
    expect(applyMasks('token: supersecret and mytoken too', masks)).toBe(
      'token: *** and *** too',
    );
  });

  it('returns text unchanged if no masks', () => {
    expect(applyMasks('no secrets here', new Set())).toBe('no secrets here');
  });

  it('ignores empty mask values', () => {
    const masks = new Set(['', 'real']);
    expect(applyMasks('real secret', masks)).toBe('*** secret');
  });
});
