
// packages/vscode-extension/src/features/runAgent.ts
import * as vscode from 'vscode';

export type AgentResult = {
  plan: { steps: any[] };
  execution: { steps: any[]; errors?: string[] };
  observation: { notes: string[]; metrics: { duration_ms: number } };
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Minimal demo agent – just echoes the prompt
// ---------------------------------------------------------------------------
// REPLACE your existing runAgent with this version
export async function runAgent(
  onEvent: (e: any) => void,
  prompt: string
) {
  // --- helpers ---
  const emit = (row: any) => onEvent?.({ type: 'exec-step', row });
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const start = Date.now();

  // --- Step 1: Analyze Prompt ---
  emit({ id: 'analyze-prompt', title: 'Analyze', intent: 'analyze', status: 'running', detail: prompt });
  await sleep(350);
  emit({ id: 'analyze-prompt', title: 'Analyze', intent: 'analyze', ok: true, detail: 'scan workspace and summarize' });

  // --- Step 2: Simulate Action (dry run) ---
  const targetFile = 'demo2.txt';
  const preview = `${targetFile}:2:1`; // deep link

  emit({ id: 'simulate-action', title: 'Noop', intent: 'noop', status: 'running' });
  await sleep(350);
  emit({ id: 'simulate-action', title: 'Noop', intent: 'noop', ok: true, detail: `-  ${preview}` });

  // --- Step 3: Write demo file (preview diff) ---
  const writeId = 'write-demo1';
  const diffPreview = [
    '--- preview ---',
    '+ Hello Striker!',
  ].join('\n');
  emit({
    id: writeId,
    title: 'Create file',
    intent: 'file_write',
    path: 'demo2.txt',
    status: 'running'
  });
  await sleep(350);
  emit({
    id: writeId,
    title: 'Create file',
    intent: 'file_write',
    path: 'demo2.txt',
    ok: true,
    detail: diffPreview
  });

  // --- Optional: simulate an error if user types "error" anywhere ---
  const notes: string[] = [];
  const errors: string[] = [];
  if (/\berror\b/i.test(prompt)) {
    errors.push('Simulated error requested by prompt.');
  } else {
    notes.push('demo: no real actions, only echo + simulation');
    notes.push(`prompt: ${prompt}`);
  }

  // --- Final payload ---
  const payload = {
    version: 1,
    plan: {
      steps: [
        { id: 'analyze-prompt', title: 'Analyze Prompt', intent: 'analyze', inputs: { prompt }, rollbackHint: 'N/A' },
        { id: 'simulate-action', title: 'Simulate Action', intent: 'noop', inputs: {}, rollbackHint: 'N/A' },
        { id: writeId, title: 'Create file', intent: 'file_write', inputs: { path: 'demo2.txt' }, rollbackHint: 'N/A' }
      ]
    },
    execution: {
      steps: [
        { id: 'analyze-prompt', title: 'Analyze', intent: 'analyze', ok: true, detail: 'scan workspace and summarize' },
        { id: 'simulate-action', title: 'Noop', intent: 'noop', ok: true, detail: `-  ${preview}` },
        { id: writeId, title: 'Create file', intent: 'file_write', path: 'demo2.txt', ok: true, detail: diffPreview },
      ],
      errors
    },
    observation: {
      notes,
      metrics: { duration_ms: Date.now() - start }
    }
  };

  // Stream early/final aggregates for the panel
  onEvent?.({ type: 'planGenerated', plan: payload.plan.steps });
  onEvent?.({ type: 'observationComplete', observation: payload.observation });


  return payload;
}


// ---------------------------------------------------------------------------
// Fallback demo payload – used if runAgent throws/returns nothing
// ---------------------------------------------------------------------------
export function demoPayload(): AgentResult {
  return {
    plan: { steps: [{ id: 'demo', title: 'Demo Step', intent: 'noop', inputs: {}, rollbackHint: '' }] },
    execution: { steps: [{ id: 'demo', title: 'noop', intent: 'noop', status: 'ok', stepId: 'demo', detail: 'simulated' }] },
    observation: { notes: ['demo payload used'], metrics: { duration_ms: 0 } },
  };
}

// ---------------------------------------------------------------------------
// Append log line to .striker/striker.log
// ---------------------------------------------------------------------------
export async function appendLog(line: string) {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) return;
  const dir = vscode.Uri.joinPath(ws.uri, '.striker');
  const file = vscode.Uri.joinPath(dir, 'striker.log');

  try {
    await vscode.workspace.fs.createDirectory(dir);

    let prevText = '';
    try {
      const buf = await vscode.workspace.fs.readFile(file);
      prevText = new TextDecoder().decode(buf);
    } catch { /* no existing log */ }

    const nextText = (prevText ? prevText : '') + line + '\n';
    const out = new TextEncoder().encode(nextText);
    await vscode.workspace.fs.writeFile(file, out);
  } catch {
    // ignore log errors
  }
}
