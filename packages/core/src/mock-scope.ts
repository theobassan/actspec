// Scope-based global mock registry.
// Mocks are registered in the current scope (file root / describe / test).
// Inner scopes override outer scopes; the scope stack is managed via AsyncLocalStorage
// so it propagates correctly through async calls.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ActionMockDef, ActionMockImpl, ActionMock, ActionMockCall } from '@actharness/types';

// ── ActionMock handle ─────────────────────────────────────────────────────────

export class ActionMockHandle implements ActionMock {
  private _calls: ActionMockCall[] = [];
  private _outputs: Record<string, string> = {};
  private _conclusion: 'success' | 'failure' = 'success';
  private _impl: ActionMockImpl | null = null;
  private _onceImpls: ActionMockImpl[] = [];

  get calls(): ActionMockCall[] { return this._calls; }
  get called(): boolean { return this._calls.length > 0; }
  get callCount(): number { return this._calls.length; }

  mockOutputs(outputs: Record<string, string>): this {
    this._outputs = { ...outputs };
    this._impl = null;
    this._onceImpls = [];
    return this;
  }

  mockConclusion(c: 'success' | 'failure'): this {
    this._conclusion = c;
    return this;
  }

  mockImplementation(impl: ActionMockImpl): this {
    this._impl = impl;
    return this;
  }

  mockImplementationOnce(impl: ActionMockImpl): this {
    this._onceImpls.push(impl);
    return this;
  }

  clear(): void {
    this._calls = [];
    this._outputs = {};
    this._conclusion = 'success';
    this._impl = null;
    this._onceImpls = [];
  }

  async resolve(callInput: { with: Record<string, string>; env: Record<string, string> }): Promise<{
    outputs: Record<string, string>;
    conclusion: 'success' | 'failure';
  }> {
    const onceImpl = this._onceImpls.shift();
    const impl = onceImpl ?? this._impl;

    let outputs = { ...this._outputs };
    let conclusion = this._conclusion;

    if (impl) {
      const result = await impl(callInput);
      if (result) {
        if (result.outputs) outputs = { ...outputs, ...result.outputs };
        if (result.conclusion) conclusion = result.conclusion;
      }
    }

    this._calls.push({ with: callInput.with, env: callInput.env, outputs });
    return { outputs, conclusion };
  }
}

// ── ScopeRegistry ─────────────────────────────────────────────────────────────

export class ScopeRegistry {
  private readonly _mocks = new Map<string, ActionMockHandle>();

  mock(ref: string, def?: ActionMockDef | ActionMockImpl): ActionMock {
    let handle = this._mocks.get(ref);
    if (!handle) {
      handle = new ActionMockHandle();
      this._mocks.set(ref, handle);
    }
    if (typeof def === 'function') {
      handle.mockImplementation(def);
    } else if (def) {
      if (def.outputs) handle.mockOutputs(def.outputs);
      if (def.conclusion) handle.mockConclusion(def.conclusion);
    }
    return handle;
  }

  resetMocks(): void {
    for (const handle of this._mocks.values()) {
      handle.clear();
    }
    this._mocks.clear();
  }

  get(ref: string): ActionMockHandle | undefined {
    return this._mocks.get(ref);
  }
}

// ── Scope stack (AsyncLocalStorage) ──────────────────────────────────────────

// File-root registry: one per worker process (safe — workers are per test file).
export const fileRootRegistry = new ScopeRegistry();

// The ALS value is the current scope stack: [fileRoot, describe1, describe2, …, test].
// fileRoot is always at index 0.
export const scopeALS = new AsyncLocalStorage<ScopeRegistry[]>();

/** Current innermost scope — where actharness.mock() registers. */
export function currentScope(): ScopeRegistry {
  const stack = scopeALS.getStore();
  return stack ? stack[stack.length - 1]! : fileRootRegistry;
}

/** Full scope stack from outermost to innermost. */
export function currentStack(): ScopeRegistry[] {
  return scopeALS.getStore() ?? [fileRootRegistry];
}

/** Walk innermost-first; return first handle that matches the ref. */
export function lookupMock(ref: string): ActionMockHandle | undefined {
  const stack = scopeALS.getStore() ?? [fileRootRegistry];
  for (let i = stack.length - 1; i >= 0; i--) {
    const found = stack[i]!.get(ref);
    if (found) return found;
  }
  return undefined;
}

// ── Public scope helpers (used by register.ts) ────────────────────────────────

/** Run a describe body synchronously inside a new child scope. */
export function runInDescribeScope(parentStack: ScopeRegistry[], fn: () => void): void {
  const scope = new ScopeRegistry();
  scopeALS.run([...parentStack, scope], fn);
}

/** Run a test / hook body asynchronously inside a new child scope. */
export async function runInTestScope(parentStack: ScopeRegistry[], fn: () => void | Promise<void>): Promise<void> {
  const scope = new ScopeRegistry();
  await scopeALS.run([...parentStack, scope], () => Promise.resolve(fn()));
}

// ── Global actharness.mock / actharness.resetMocks ──────────────────────────────────

export function globalMock(ref: string, def?: ActionMockDef | ActionMockImpl): ActionMock {
  return currentScope().mock(ref, def);
}

export function globalResetMocks(): void {
  currentScope().resetMocks();
}
