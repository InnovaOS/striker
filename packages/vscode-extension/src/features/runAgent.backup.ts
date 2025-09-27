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
export async function runAgent(
  onEvent?: (e: { type: 'exec-step'; row: any }) => void,
  userPrompt?: string
): Promise<AgentResult> {
  const start = Date.now();
  const prompt = (userPrompt ?? '').trim();

  const plan = {
    steps: [
      {
        id: 'analyze-prompt',
        title: 'Analyze Prompt',
        intent: 'analyze',
        inputs: { prompt },
        rollbackHint: 'N/A',
      },
      {
        id: 'simulate-action',
        title: 'Simulate Action',
        intent: 'noop',
        inputs: {},
        rollbackHint: 'N/A',
      },
    ],
  };

  const execution: { steps: any[]; errors?: string[] } = { steps: [] };

  const push = async (row: any) => {
    try { onEvent?.({ type: 'exec-step', row }); } catch {}
    execution.steps.push(row);
    await sleep(120);
  };

  // 1) Echo the prompt
  await push({
    id: 'analyze-prompt',
    title: 'analyze',
    intent: 'analyze',
    status: 'ok',
    stepId: 'analyze-prompt',
    detail: prompt || '<empty>',
  });

  // 2) Simulate some work
  await push({
    id: 'simulate-action',
    title: 'noop',
    intent: 'noop',
    status: 'ok',
    stepId: 'simulate-action',
    detail: 'simulated',
  });
 
  await push({
    id: 'simulate-action',
    title: 'noop',
    intent: 'noop',
    status: 'ok',
    stepId: 'simulate-action',
    detail: 'demo.txt:2:1',   // deep link
  });

  // TEMP: propose creating demo1.txt
await push({
  id: 'write-demo1',
  title: 'create_file',
  intent: 'file_write',
  status: 'ok',
  stepId: 'write-demo1',
  path: 'demo1.txt',
  detail: 'demo1.txt:1:1',
  diff: {
    path: 'demo1.txt',
    action: 'create',
    after: `# Demo1
This file was created by Striker Apply Last Run.`,
    diff: '--- /dev/null\n+++ b/demo1.txt\n@@\n+# Demo1\n+This file was created by Striker Apply Last Run.\n'
  }
});

// TEMP: propose creating demo2.txt
await push({
  id: 'write-demo2',
  title: 'create_file',
  intent: 'file_write',
  status: 'ok',
  stepId: 'write-demo2',
  path: 'demo2.txt',
  detail: 'demo2.txt:1:1',
  diff: {
    path: 'demo2.txt',
    action: 'create',
    after: `# Demo2
Another file written by Striker.`,
    diff: '--- /dev/null\n+++ b/demo2.txt\n@@\n+# Demo2\n+Another file written by Striker.\n'
  }
});

  const duration_ms = Date.now() - start;
  return {
    plan,
    execution,
    observation: {
      notes: [
        'demo: no real actions, only echo + simulation',
        prompt ? `prompt: ${prompt}` : 'prompt: <empty>',
      ],
      metrics: { duration_ms },
    },
  };
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
