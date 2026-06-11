// Runner protocol — env-file allocation/parsing and stdout workflow command parsing.
// Ref: PROTOCOL.md

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Annotation } from '@actharness/types';

// ── Protocol file allocation ──────────────────────────────────────────────────

export interface ProtocolFiles {
  output: string;
  env: string;
  state: string;
  path: string;
  summary: string;
  dir: string;
}

export function allocateProtocolFiles(): ProtocolFiles {
  const dir = mkdtempSync(join(tmpdir(), 'actharness-proto-'));
  const output = join(dir, 'output');
  const env = join(dir, 'env');
  const state = join(dir, 'state');
  const path = join(dir, 'path');
  const summary = join(dir, 'summary');
  for (const f of [output, env, state, path, summary]) {
    writeFileSync(f, '');
  }
  return { output, env, state, path, summary, dir };
}

// ── Env-file parsing ──────────────────────────────────────────────────────────
// Both forms: NAME=VALUE and NAME<<DELIM\nVALUE\nDELIM

export function parseEnvFile(filePath: string): Record<string, string> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return {};
  }
  return parseEnvFileContent(content);
}

export function parseEnvFileContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content.trim()) return result;

  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined || line === '') { i++; continue; }

    // Heredoc form: NAME<<DELIM
    const heredocMatch = /^([^<\n]+)<<(.+)$/.exec(line);
    if (heredocMatch) {
      const name = heredocMatch[1]!.trim();
      const delim = heredocMatch[2]!;

      // CVE guard: delimiter must not appear in the name
      if (!name.includes(delim)) {
        const valueLines: string[] = [];
        i++;
        while (i < lines.length && lines[i] !== delim) {
          valueLines.push(lines[i]!);
          i++;
        }
        result[name] = valueLines.join('\n');
      }
      i++;
      continue;
    }

    // Simple NAME=VALUE form
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const name = line.slice(0, eqIdx);
      const value = line.slice(eqIdx + 1);
      result[name] = value;
    }
    i++;
  }

  return result;
}

// ── Workflow command decoding ─────────────────────────────────────────────────
// Per spec: decode %0A/%0D/%3A/%2C first, then %25 last.

function decodeData(s: string): string {
  return s.replace(/%0D/gi, '\r').replace(/%0A/gi, '\n').replace(/%25/gi, '%');
}

function decodeProperty(s: string): string {
  return s
    .replace(/%3A/gi, ':')
    .replace(/%2C/gi, ',')
    .replace(/%0D/gi, '\r')
    .replace(/%0A/gi, '\n')
    .replace(/%25/gi, '%');
}

// ── Workflow command parsing ──────────────────────────────────────────────────

interface ParsedCommand {
  name: string;
  properties: Record<string, string>;
  data: string;
}

function parseWorkflowCommand(line: string): ParsedCommand | null {
  // Format: ::name [key=value[,key=value]]*::data
  const match = /^::([a-zA-Z0-9_-]+)(?:\s([^:]*))?::(.*)$/.exec(line);
  if (!match) return null;

  const name = match[1]!;
  const propsStr = (match[2] ?? '').trim();
  const data = decodeData(match[3]!);

  const properties: Record<string, string> = {};
  if (propsStr) {
    for (const prop of propsStr.split(',')) {
      const eqIdx = prop.indexOf('=');
      if (eqIdx > 0) {
        const key = prop.slice(0, eqIdx).trim();
        const val = decodeProperty(prop.slice(eqIdx + 1));
        properties[key] = val;
      }
    }
  }

  return { name, properties, data };
}

// ── Stdout command stream result ──────────────────────────────────────────────

export interface CommandParseResult {
  annotations: Annotation[];
  /** Collected via deprecated ::set-output name=NAME::VALUE form. */
  legacyOutputs: Record<string, string>;
  /** Collected via deprecated ::save-state name=NAME::VALUE form. */
  legacyState: Record<string, string>;
  /** Paths to prepend (legacy ::add-path::). */
  addedPaths: string[];
  /** Values to mask (::add-mask::). */
  masks: string[];
}

export function parseStdoutCommands(stdout: string): CommandParseResult {
  const annotations: Annotation[] = [];
  const legacyOutputs: Record<string, string> = {};
  const legacyState: Record<string, string> = {};
  const addedPaths: string[] = [];
  const masks: string[] = [];

  let stopToken: string | null = null;

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trimEnd();

    // stop-commands: buffer until token line
    if (stopToken !== null) {
      if (line === `::${stopToken}::`) {
        stopToken = null;
      }
      continue;
    }

    if (!line.startsWith('::')) continue;

    const cmd = parseWorkflowCommand(line);
    if (!cmd) continue;

    switch (cmd.name) {
      case 'error':
      case 'warning':
      case 'notice':
      case 'debug': {
        const ann: Annotation = {
          level: cmd.name,
          message: cmd.data,
        };
        if (cmd.properties['file']) ann.file = cmd.properties['file'];
        const l = cmd.properties['line'];
        if (l) ann.line = parseInt(l, 10);
        const c = cmd.properties['col'] ?? cmd.properties['endColumn'];
        if (c) ann.col = parseInt(c, 10);
        annotations.push(ann);
        break;
      }

      case 'add-mask':
        if (cmd.data) masks.push(cmd.data);
        break;

      case 'set-output': {
        const name = cmd.properties['name'];
        if (name) legacyOutputs[name] = cmd.data;
        break;
      }

      case 'save-state': {
        const name = cmd.properties['name'];
        if (name) legacyState[name] = cmd.data;
        break;
      }

      case 'add-path':
        if (cmd.data) addedPaths.push(cmd.data);
        break;

      case 'stop-commands':
        stopToken = cmd.data || null;
        break;

      // echo, group, endgroup, set-env: cosmetic / deprecated — accept, discard
    }
  }

  return { annotations, legacyOutputs, legacyState, addedPaths, masks };
}

// ── Path file parsing ────────────────────────────────────────────────────────
// $GITHUB_PATH: one path per line, prepended to PATH for subsequent steps.

export function parsePathFile(filePath: string): string[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  return content.split('\n').map((l) => l.trim()).filter(Boolean);
}

// ── Mask application ──────────────────────────────────────────────────────────

export function applyMasks(text: string, masks: ReadonlySet<string>): string {
  let result = text;
  for (const mask of masks) {
    if (mask) result = result.split(mask).join('***');
  }
  return result;
}
