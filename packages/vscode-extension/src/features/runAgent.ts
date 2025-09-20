import * as vscode from 'vscode';
import { runTask } from '../../../core-agent/dist/index.js';
import { showResultsPanel } from '../ui/resultsPanel.js';

// Types for normalization
type StepStatus = 'ok' | 'warning' | 'error' | 'running' | 'skipped';

interface Step {
  id?: string;
  title?: string;
  intent?: string;
  path?: string;
  status?: StepStatus;
  note?: string;
  notes?: string[];
  error?: string;
  stepId?: string;
  patch?: any;
  inputs?: any;
  rollbackHint?: any;
}

interface AgentPayload {
  plan?: { steps: Step[]; summary?: string };
  execution?: { steps: Step[]; notes?: string[]; errors?: { message: string; code?: string; stepId?: string }[] };
  observation?: { notes?: string[]; errors?: { message: string; trace?: string }[]; metrics?: Record<string, number> };
  meta?: Record<string, any>;
}

/**
 * Normalize raw agent output into a consistent AgentPayload shape
 */
function normalizePayload(raw: any): AgentPayload {
  if (!raw || typeof raw !== 'object') {
    return {
      plan: { steps: [] },
      execution: { steps: [], notes: ['No data returned from agent'] },
      observation: { notes: [] },
    };
  }

  const planSteps = raw.plan?.steps ?? raw.plan ?? raw.steps ?? [];
  const exec = raw.execution ?? raw.exec ?? raw.run ?? {};
  const execSteps = exec.steps ?? raw.executionSteps ?? raw.results ?? [];
  const obs = raw.observation ?? raw.observe ?? {};
  const obsNotes = obs.notes ?? raw.observationNotes ?? raw.notes ?? [];
  const obsErrors = obs.errors ?? raw.observationErrors ?? [];

  const normalizeStep = (s: any): Step => {
    const status: StepStatus | undefined = s?.status ?? (s?.error ? 'error' : undefined);
    let notes: string[] | undefined;
    if (Array.isArray(s?.notes)) notes = s.notes;
    else if (typeof s?.note === 'string') notes = [s.note];

    return {
      id: s?.id ?? s?.stepId,
      title: s?.title ?? s?.intent ?? s?.path,
      intent: s?.intent,
      path: s?.path,
      status,
      error: s?.error,
      notes,
      stepId: s?.stepId,
      patch: s?.patch,
      inputs: s?.inputs,
      rollbackHint: s?.rollbackHint,
    };
  };

  const normPlanSteps = Array.isArray(planSteps) ? planSteps.map(normalizeStep) : [];
  const normExecSteps = Array.isArray(execSteps) ? execSteps.map(normalizeStep) : [];

  const execNotes: string[] = [];
  if (Array.isArray(exec?.notes)) execNotes.push(...exec.notes);
  if (typeof exec?.note === 'string') execNotes.push(exec.note);

  const execErrors =
    Array.isArray(exec?.errors)
      ? exec.errors.map((e: any) => ({
          message: String(e?.message ?? e ?? 'Unknown error'),
          code: e?.code,
          stepId: e?.stepId,
        }))
      : [];

  const normObsErrors = Array.isArray(obsErrors)
    ? obsErrors.map((e: any) => ({
        message: String(e?.message ?? e ?? 'Unknown error'),
        trace: e?.trace ?? e?.stack,
      }))
    : [];

  const metrics: Record<string, number> | undefined = typeof obs?.metrics === 'object' ? obs.metrics : undefined;

  return {
    plan: { steps: normPlanSteps, summary: raw.plan?.summary ?? raw.summary },
    execution: { steps: normExecSteps, notes: execNotes.length ? execNotes : undefined, errors: execErrors.length ? execErrors : undefined },
    observation: {
      notes: Array.isArray(obsNotes) ? obsNotes : [String(obsNotes)],
      errors: normObsErrors.length ? normObsErrors : undefined,
      metrics,
    },
    meta: typeof raw.meta === 'object' ? raw.meta : undefined,
  };
}

// Register the command
export function registerRunAgent(context: vscode.ExtensionContext) {
  const cmdId = 'striker.runAgent';

  const disposable = vscode.commands.registerCommand(cmdId, async () => {
    const userPrompt = await vscode.window.showInputBox({
      prompt: 'What should Striker do?',
      placeHolder: 'e.g., “scan workspace and propose edits”',
    });
    if (!userPrompt) return;

    const payloadRaw = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Striker', cancellable: false },
      async progress => {
        progress.report({ message: 'Planning…' });
        const result = await runTask({ prompt: userPrompt, mode: 'preview' });
        progress.report({ message: 'Done' });
        return result;
      }
    );

    const payload = normalizePayload(payloadRaw);
    console.log('[Striker] normalized payload:', payload);

    showResultsPanel('Striker Results', payload);
  });

  context.subscriptions.push(disposable);
}
