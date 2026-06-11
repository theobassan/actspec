// CompositeExecutor — extracts steps from ParsedAction and delegates to StepRunner.
// Registered into core's executor registry via the side-effectful index.ts entry.

import type { ActionExecutor, ExecutionCall, ExecutionResult } from '@actharness/core';
import { runSteps, evalTemplate } from '@actharness/core';
import { ShellSandbox } from './shell-sandbox.js';

class CompositeExecutor implements ActionExecutor {
  handles(using: string): boolean {
    return using === 'composite';
  }

  async execute(call: ExecutionCall): Promise<ExecutionResult> {
    const steps = call.action.runs.steps!;
    const sandbox = new ShellSandbox();

    const result = await runSteps(steps, call.context, {
      workspace: call.context.github.workspace,
      actionDir: call.action._dir!,
      sandbox,
      mocks: call.mocks,
      actharnessOptions: {},
      dispatch: call.dispatch,
      cycleGuard: call.cycleGuard,
      depth: call.depth,
      filePath: call.action._file,
    });

    // Evaluate action-level outputs against the final context
    const outputs = resolveOutputs(call, result.finalEnv);

    return {
      conclusion: result.steps.some((s) => s.conclusion === 'failure') ? 'failure' : 'success',
      outputs,
      env: result.finalEnv,
      steps: result.steps,
      annotations: result.annotations,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}

function resolveOutputs(
  call: ExecutionCall,
  _finalEnv: Record<string, string>,
): Record<string, string> {
  const outputs: Record<string, string> = {};
  const actionOutputs = call.action.outputs ?? {};

  for (const [name, def] of Object.entries(actionOutputs)) {
    if (def.value) {
      try {
        outputs[name] = evalTemplate(def.value, call.context, call.action._file);
      } catch {
        outputs[name] = '';
      }
    }
  }

  return outputs;
}

export const compositeExecutor = new CompositeExecutor();
