// packages/vscode-extension/src/extension.ts
import * as vscode from 'vscode';
import { showResultsPanel, acquireOrCreateResultsPanel } from './ui/resultsPanel';

// -----------------------------
// Local fallbacks (guardrails)
// -----------------------------
type AnyPayload = {
  plan?: any;
  execution?: { steps?: any[]; errors?: string[] } | any;
  observation?: any;
};

function localDemoPayload(userPrompt?: string): AnyPayload {
  const p = (userPrompt ?? '').trim();
  return {
    plan: {
      steps: [
        { id: 'prompt', title: 'Interpret Prompt', intent: 'analyze', inputs: { prompt: p || '<empty>' }, rollbackHint: 'N/A' },
        { id: 'scan', title: 'Scan Workspace', intent: 'scan', inputs: {}, rollbackHint: 'N/A' },
        { id: 'select', title: 'Select Target File', intent: 'select_file', inputs: {}, rollbackHint: 'N/A' },
        { id: 'summary', title: 'Summarize', intent: 'summarize', inputs: {}, rollbackHint: 'N/A' },
      ],
    },
    execution: {
      steps: [
        { id: 'prompt', title: 'interpret prompt', status: 'ok', detail: p || '<empty>' },
        { id: 'scan', title: 'scan workspace', status: 'ok', detail: 'no-op' },
        { id: 'select', title: 'select target file', status: 'ok', detail: 'no-op' },
        { id: 'summary', title: 'summarize', status: 'ok', detail: 'no-op' },
      ],
    },
    observation: {
      notes: ['all steps were no-op', `prompt: ${p || '<empty>'}`],
      metrics: { duration_ms: 0 },
    },
  };
}

async function loadAgentModule(): Promise<any> {
  try {
    return await import('./features/runAgent.js');
  } catch {
    try {
      // @ts-ignore
      return await import('./features/runAgent');
    } catch {
      return {};
    }
  }
}

// -----------------------------
// Activate
// -----------------------------
export function activate(context: vscode.ExtensionContext) {
  // Run Agent — prompt, stream, never blank panel
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.runAgent', async () => {
      const userPrompt = await vscode.window.showInputBox({
        prompt: 'What should Striker do?',
        placeHolder: 'e.g., “scan workspace and summarize”',
        ignoreFocusOut: true,
      });
      if (userPrompt === undefined) {
        vscode.window.setStatusBarMessage('Striker: run cancelled', 2000);
        return;
      }
      const trimmed = userPrompt.trim();
      const finalPrompt = trimmed === '' ? 'scan workspace and summarize' : trimmed;
      if (trimmed === '') {
        vscode.window.showInformationMessage('Empty prompt — using default: “scan workspace and summarize”.');
      }
      await runAgentAndShow(context, finalPrompt);
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.applyLastRun', async () => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) return vscode.window.showInformationMessage('No workspace open.');

      const payload = context.workspaceState.get<any>('striker.lastRun');
      if (!payload) return vscode.window.showWarningMessage('No last run to apply.');

      const steps: any[] = Array.isArray(payload?.execution?.steps) ? payload.execution.steps : [];
      const writes: Array<{ path: string; after: string }> = [];

      for (const r of steps) {
        const diff = r?.diff;
        if (!diff || typeof diff !== 'object') continue;
        const path = diff.path || r?.path;
        const after = diff.after;
        if (!path || typeof after !== 'string') continue;
        writes.push({ path, after });
      }

      if (writes.length === 0) {
        return vscode.window.showInformationMessage('Nothing to apply (no diffs with path/after).');
      }

      const confirm = await vscode.window.showInformationMessage(
        `Apply ${writes.length} file change(s)? This will overwrite files.`,
        { modal: true },
        'Apply'
      );
      if (confirm !== 'Apply') return;

      let ok = 0, err = 0;
      for (const w of writes) {
        try {
          const fileUri = vscode.Uri.joinPath(ws.uri, w.path);
          // ensure parent directories
          const parts = w.path.split('/'); parts.pop();
          if (parts.length) {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(ws.uri, parts.join('/')));
          }
          await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(w.after));
          ok++;
        } catch {
          err++;
        }
      }

      vscode.window.showInformationMessage(`Applied ${ok} file(s)` + (err ? `, ${err} failed` : ''));

      // optional: open README.md if present
      const readme = writes.find(w => /(^|\/)README\.md$/i.test(w.path));
      if (readme) {
        const uri = vscode.Uri.joinPath(ws.uri, readme.path);
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
        } catch { /* ignore */ }
      }
    })
  );

  // Show Demo
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.showDemo', async () => {
      showResultsPanel('Striker Results', localDemoPayload());
    })
  );

  // Open Logs
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.openLogs', async () => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) return vscode.window.showInformationMessage('No workspace open.');
      const logUri = vscode.Uri.joinPath(ws.uri, '.striker/striker.log');
      try {
        const doc = await vscode.workspace.openTextDocument(logUri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        vscode.window.showInformationMessage('No logs found yet.');
      }
    })
  );

  // Export Last Run (real payload if present)
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.exportLastRun', async () => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) return vscode.window.showInformationMessage('No workspace open.');

      const last = context.workspaceState.get<AnyPayload>('striker.lastRun') ?? localDemoPayload();

      const dir = vscode.Uri.joinPath(ws.uri, '.striker', 'runs');
      const dated = vscode.Uri.joinPath(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      const stable = vscode.Uri.joinPath(ws.uri, '.striker', 'last-run.json');

      await vscode.workspace.fs.createDirectory(dir);
      const buf = new TextEncoder().encode(JSON.stringify(last, null, 2));

      // write both: archive + stable pointer
      await vscode.workspace.fs.writeFile(dated, buf);
      await vscode.workspace.fs.writeFile(stable, buf);

      vscode.window.showInformationMessage('Exported last run JSON.');
      vscode.commands.executeCommand('vscode.open', dated);
    })
  );

  // Create Issue Draft (used by the Errors card)
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.createIssueDraft', async (payload?: AnyPayload) => {
      const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: buildIssueTemplate(payload) });
      vscode.window.showTextDocument(doc, { preview: false });
    })
  );

  // Open File At (deep links path:line[:col])
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.openFileAt', async (args?: { path: string; line?: number; col?: number }) => {
      try {
        if (!args?.path) return vscode.window.showWarningMessage('No path provided.');
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) return vscode.window.showInformationMessage('No workspace open.');
        const uri = vscode.Uri.joinPath(ws.uri, args.path);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        if (args.line != null) {
          const pos = new vscode.Position(Math.max(0, args.line - 1), Math.max(0, (args.col ?? 1) - 1));
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
      } catch {
        vscode.window.showWarningMessage(`Could not open ${args?.path}`);
      }
    })
  );
}

// -----------------------------
// Internals
// -----------------------------
function buildIssueTemplate(payload?: AnyPayload): string {
  const prompt =
    (payload as any)?.plan?.steps?.[0]?.inputs?.prompt ??
    (payload as any)?.observation?.notes?.find?.((n: string) => n.startsWith('prompt:'))?.slice(8) ??
    '';
  const summary = (payload as any)?.observation?.notes?.[0] ?? '';
  return `# Striker Run Failure

**Prompt:** ${prompt}
**Summary:** ${summary}

## Errors
\`\`\`
${JSON.stringify((payload as any)?.execution?.errors ?? [], null, 2)}
\`\`\`

## Raw Payload
<details>
<summary>click to expand</summary>

\`\`\`json
${JSON.stringify(payload ?? {}, null, 2)}
\`\`\`
</details>
`;
}

async function runAgentAndShow(context: vscode.ExtensionContext, userPrompt?: string) {
  const runId = `${Date.now()}`;
  const t0 = Date.now();

  // Create panel early (for streaming + UI actions)
  const panel = acquireOrCreateResultsPanel('Striker Results');

  // One message handler per run (routes webview buttons to commands)
  panel.webview.onDidReceiveMessage(async (msg) => {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'export-json':
        await vscode.commands.executeCommand('striker.exportLastRun');
        break;
      case 'open-logs':
        await vscode.commands.executeCommand('striker.openLogs');
        break;
      case 'create-issue': {
        const payload = context.workspaceState.get('striker.lastRun');
        await vscode.commands.executeCommand('striker.createIssueDraft', payload);
        break;
      }
      default:
        break;
    }
  });

  // Load agent
  const mod: any = await loadAgentModule();
  const runAgentFn =
    typeof mod.runAgent === 'function' ? mod.runAgent :
    typeof mod.default === 'function' ? mod.default : undefined;
  const demoPayloadFn = typeof mod.demoPayload === 'function' ? mod.demoPayload : localDemoPayload;
  const appendLogFn  = typeof mod.appendLog  === 'function' ? mod.appendLog  : async (_: string)=>{};

  // Streaming callback -> webview
  const onEvent = (e: any) => {
    try { panel.webview.postMessage({ type: 'append-exec', row: e?.row ?? e?.step ?? e }); } catch {}
  };

  let result: AnyPayload | undefined;
  try {
    if (runAgentFn) {
      try { result = await runAgentFn(onEvent, userPrompt); }
      catch { result = await runAgentFn(userPrompt); }
    }
  } catch {
    vscode.window.showWarningMessage('Agent threw an error; showing demo payload.');
  }

  // Fallback to demo
  const payload: AnyPayload = result && Object.keys(result).length ? result : demoPayloadFn(userPrompt);

  // ---- SINGLE steps declaration (reuse below) ----
  const execSteps: any[] = Array.isArray(payload?.execution?.steps) ? payload.execution.steps : [];

  // Normalize status for Run Summary, and backfill path if missing
  for (const r of execSteps) {
    if (!r) continue;
    if (typeof r.status === 'undefined' && typeof r.ok === 'boolean') {
      r.status = r.ok ? 'ok' : 'error';
    }
    if (!r.path) {
      if (r?.diff?.path) r.path = r.diff.path;
      else if (typeof r.detail === 'string') {
        // extract "file.ext" from "file.ext:line[:col]"
        const m = r.detail.match(/^([^\s:]+\.[^\s:]+):\d+(?::\d+)?/);
        if (m) r.path = m[1];
      }
    }
  }

  // Render + persist + log
  showResultsPanel('Striker Results', payload);
  await context.workspaceState.update('striker.lastRun', payload);

  const duration = Date.now() - t0;
  const okCount = execSteps.filter((s: any) => s?.status === 'ok' || s?.ok === true).length;
  const errCount = (payload as any)?.execution?.errors?.length ?? 0;
  await appendLogFn(`runId=${runId} duration_ms=${duration} ok=${okCount} warn=0 err=${errCount} files=0`);
}

export function deactivate() {}
