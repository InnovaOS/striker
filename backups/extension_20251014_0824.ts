// file code 1456
import * as vscode from "vscode";
import {
  AgentTask,
  PlannerTool,
  CmdExecTool,
  FileReadTool,
  FileWriteTool,
  NoopTool,
  ToolCoordinator,
  type LLMProvider,
  type TaskState,
} from '@striker/core-agent';
import { PanelReporter } from "./agent/PanelReporter";
import { renderResultsHtml } from './ui/resultsPanel';

// Removed import for showResultsPanel and acquireOrCreateResultsPanel
import { runAgent } from './features/runAgent';
import showDemo from './features/showDemo';
import type { ResultsPayload, ExecRow } from './types';

let __currentRunAbort: AbortController | null = null;

function safeRegisterCommand(id: string, callback: (...a: any[]) => any, context: vscode.ExtensionContext) {
  try {
    const disposable = vscode.commands.registerCommand(id, callback);
    context.subscriptions.push(disposable);
  } catch {
    console.warn(`[Striker] Command '${id}' already registered, skipped duplicate.`);
  }
}

let __lastResultsPayload: ResultsPayload | undefined;

// 👇 Global flag to stop auto-opening Results Panel during goal prompt
let __suppressResultsPanelAutoOpen: boolean = false;

// In-memory store of the last final payload shown in the panel.
// Used by export/apply commands.


export function activate(context: vscode.ExtensionContext) {
  // ---- Run Agent (core) ----
  const runAgentCore = async () => {
    const raw = await vscode.window.showInputBox({
      title: 'Run Agent',
      prompt: 'Describe what you want the agent to do…',
      placeHolder: 'e.g., scan workspace and summarize',
      ignoreFocusOut: true,
      validateInput: (v) => {
        if (v === undefined) return null; // typing state
        return v.trim().length ? null : 'Please enter a prompt';
      }
    });

    // Canceled (blur/Esc)
    if (raw === undefined) return;

    const prompt = raw.trim();
    if (!prompt) {
      vscode.window.showInformationMessage('Agent run canceled (empty prompt).');
      return;
    }

    // 1) Create the panel with a tiny placeholder
    // Ensure panel exists and define unified poster
    const post = postToResultsPanel;

    // 3) Run the real agent with live control
    try { __currentRunAbort?.abort(); } catch {}
    __currentRunAbort = new AbortController();
    const signal = __currentRunAbort.signal;

    // Tell the panel a run started
    post({ type: 'AGENT_RESULT', payload: { type: 'run-started', ts: Date.now() } });

    const result = await runAgent(
      (e) => {
        if (signal.aborted) return;

        if (e?.type === 'exec-step' && e?.row) {
          post({ type: 'append-exec', row: e.row });
        }
        if (e?.type === 'planGenerated') {
          post({ type: 'AGENT_RESULT', payload: { type: 'planGenerated', plan: e.plan || [] } });
        }
        if (e?.type === 'observationComplete') {
          post({ type: 'AGENT_RESULT', payload: { type: 'observationComplete', observation: e.observation || {} } });
        }
      },
      prompt
    );



    // 4) Build the final payload (Results Panel + Apply Last Run expect execution as an array)
    const execRows: ExecRow[] = Array.isArray((result as any).execution?.steps)
      ? (result as any).execution.steps
      : Array.isArray((result as any).execution)
        ? (result as any).execution
        : [];

    // 4) When your agent result is ready, send it.
    // Rely only on the real pipeline; no stub payload.
    const hasReal =
      result && typeof result === 'object' &&
      (
        Array.isArray((result as any).execution) ||
        Array.isArray((result as any).plan?.steps) ||
        (result as any).observation
      );

    if (hasReal) {
      const finalPayload = result as any; // no strict cast needed
      __lastResultsPayload = finalPayload;
      post({ type: 'final-payload', payload: finalPayload });

      // --- ADD BELOW THIS LINE ---
      try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (root) {
          const dir  = vscode.Uri.joinPath(root, '.striker');
          const file = vscode.Uri.joinPath(dir,  'last-results.json');
          try { await vscode.workspace.fs.stat(dir); } catch { await vscode.workspace.fs.createDirectory(dir); }
          await vscode.workspace.fs.writeFile(file, Buffer.from(JSON.stringify(finalPayload, null, 2), 'utf8'));
        }
      } catch {}
    }


      };

  // Striker: Run Agent
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.runAgent', runAgentCore)
  );

  // Striker: Run Agent (Prompt) — alias for some menus/palette entries
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.runAgentPrompt', runAgentCore)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('striker.exportLastRun', async () => {
      try {
        // reuse the same function used for JSON export
        await vscode.commands.executeCommand('striker.exportResults');
      } catch (err) {
        vscode.window.showErrorMessage(`Export Last Run failed: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('striker.agent.runGoal', async (payload?: any) => {
      const goal = (payload?.goal ?? '').trim();
      if (!goal) { vscode.window.showWarningMessage('No goal provided to runner.'); return; }

      try { await vscode.commands.executeCommand('striker.openResultsPanel'); } catch {}

      // Final payload comes from the command argument if provided,
      // otherwise fall back to the last payload, otherwise a minimal shell.
      const finalPayload = (payload as any) ?? __lastResultsPayload ?? {
        version: 1,
        plan: { steps: [] },
        execution: [],
        observation: {}
      };


      // this command might have a stricter type — just cast
      try {
        await vscode.commands.executeCommand('striker.results.appendRun', {
          kind: 'goal',
          title: goal,
          finishedAt: Date.now(),
          meta: { stub: true }
        } as any);
      } catch {}

      // Save & post via singleton helper
      __lastResultsPayload = finalPayload;
      postToResultsPanel({ type: 'final-payload', payload: finalPayload });

    })
  );

  const demo = {
    plan: { steps: [{ id: "1", title: "Say hello", intent: "noop", inputs: { text: "hello world" } }] },
    execution: [{ id: "1", title: "Say hello", intent: "noop", path: "-", ok: true, detail: "hello world" }],
    observation: { summary: "Demo run OK", details: "Rendered via final-payload" }
  };

  // Post a demo payload so you immediately see something.
  //panel.webview.postMessage({ type: "final-payload", payload: demo });

  // Striker: Open Results Panel (minimal payload)
  safeRegisterCommand('striker.openResultsPanel', async () => {
    const payload = __lastResultsPayload ?? ({
      version: 1,
      plan: { steps: [] as any[] },
      execution: [] as any[],
      observation: { summary: 'Ready', details: 'Waiting for runs…' }
    } as any);

    // 👇 This uses the singleton panel
    postToResultsPanel({ type: 'final-payload', payload });
  }, context);

  // Striker: Show Demo (uses features/showDemo)
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.showDemo', async () => {
      await showDemo('scan workspace and summarize');
    })
  );

  // Striker: Open Logs (auto-create if missing)
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.openLogs', async () => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        vscode.window.showInformationMessage('No workspace open.');
        return;
      }
      const logsUri = vscode.Uri.joinPath(ws.uri, '.striker', 'logs');
      try {
        await vscode.workspace.fs.createDirectory(logsUri);
        await vscode.commands.executeCommand('revealInExplorer', logsUri);
        vscode.window.showInformationMessage(`Logs folder ready: ${logsUri.fsPath}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open/create logs folder: ${err?.message || String(err)}`);
      }
    })
  );

  // Striker: Export Last Results (JSON)
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.exportResults', async () => {
      const data = __lastResultsPayload ?? { version: 1, plan: { steps: [] } };
      try {
        const uri = await vscode.window.showSaveDialog({
          title: 'Export Striker Results',
          defaultUri: vscode.Uri.file('striker-results.json'),
          filters: { JSON: ['json'] }
        });
        if (!uri) return;
        const enc = new TextEncoder();
        const bytes = enc.encode(JSON.stringify(data, null, 2));
        await vscode.workspace.fs.writeFile(uri, bytes);
        vscode.window.showInformationMessage(`Exported results to ${uri.fsPath}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Export failed: ${err?.message || String(err)}`);
      }
    })
  );

    // Striker: Apply Last Run (Write Files)
    context.subscriptions.push(
      vscode.commands.registerCommand('striker.applyLastRun', async () => {
        if (!__lastResultsPayload) {
          vscode.window.showInformationMessage('No last run available to apply.');
          return;
        }
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
          vscode.window.showInformationMessage('Open a workspace to write files.');
          return;
        }

        // Collect candidates
        const candidates = collectWriteCandidates(__lastResultsPayload);
        if (!candidates.length) {
          vscode.window.showInformationMessage('No write candidates found in last run.');
          return;
        }

        // Confirm
        const picked = await confirmWriteCandidates(candidates);
        if (!picked.length) {
          vscode.window.showInformationMessage('Apply Last Run canceled.');
          return;
        }

        // Write files
        const enc = new TextEncoder();
        const written: string[] = [];
        for (const c of picked) {
          try {
            const targetUri = vscode.Uri.joinPath(ws.uri, c.path);
            // Ensure directory exists
            const parts = c.path.split('/').slice(0, -1);
            if (parts.length) {
              const dir = vscode.Uri.joinPath(ws.uri, parts.join('/'));
              await vscode.workspace.fs.createDirectory(dir);
            }
            await vscode.workspace.fs.writeFile(targetUri, enc.encode(c.content ?? ''));
            written.push(c.path);
          } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to write ${c.path}: ${e?.message || String(e)}`);
          }
        }

        // Log summary
        try {
          const logsUri = vscode.Uri.joinPath(ws.uri, '.striker', 'logs');
          await vscode.workspace.fs.createDirectory(logsUri);
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const logFile = vscode.Uri.joinPath(logsUri, `apply-${stamp}.log`);
          const body = `Applied ${written.length} file(s):\n` + written.map(w => `- ${w}`).join('\n') + '\n';
          await vscode.workspace.fs.writeFile(logFile, enc.encode(body));
        } catch {
          // best effort
        }

        // 🔹 SCM glue: open Source Control view
        if (written.length) {
          await vscode.commands.executeCommand('workbench.view.scm');
          vscode.window.showInformationMessage(`Applied ${written.length} file(s). Review in Source Control view.`);
        } else {
          vscode.window.showInformationMessage('No files were written.');
        }

        // 🔹 Optional: offer quick branch + commit (setting gate)
        const cfg = vscode.workspace.getConfiguration('striker.apply');
        if (cfg.get<boolean>('offerBranchAndCommit')) {
          const choice = await vscode.window.showQuickPick(['Skip', 'Create branch + commit'], {
            title: 'Apply Last Run: Git Integration',
            placeHolder: 'Would you like to commit these changes?'
          });
          if (choice === 'Create branch + commit') {
            try {
              await vscode.commands.executeCommand('git.branch', `striker/run-${Date.now()}`);
              await vscode.commands.executeCommand('git.commit', 'chore(striker): apply last run');
            } catch (e: any) {
              vscode.window.showErrorMessage(`Git integration failed: ${e?.message || String(e)}`);
            }
          }
        }
      })
    );

  // Striker: Create Issue Draft
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.createIssueDraft', async () => {
      // Try to use current selection as context; otherwise prompt.
      const editor = vscode.window.activeTextEditor;
      const selectionText =
        editor?.document.getText(editor.selection) || '';

      const title = await vscode.window.showInputBox({
        title: 'Issue Title',
        placeHolder: 'Short, action-oriented title',
        ignoreFocusOut: true,
        validateInput: v => (v?.trim() ? null : 'Title is required')
      });
      if (!title) return;

      // If user has no selection, ask for context/description briefly.
      let contextText = selectionText;
      if (!contextText) {
        contextText =
          (await vscode.window.showInputBox({
            title: 'Issue Context / Description (optional)',
            placeHolder: 'What’s the problem or request?',
            ignoreFocusOut: true
          })) || '';
      }

      // Build a simple MD draft
      const lines: string[] = [];
      lines.push(`# ${title.trim()}`);
      lines.push('');
      lines.push('## Summary');
      lines.push(contextText.trim() || '_(add summary)_');
      lines.push('');
      lines.push('## Acceptance Criteria');
      lines.push('- [ ] Clearly defined expected behavior');
      lines.push('- [ ] Repro steps and environment (if bug)');
      lines.push('');
      lines.push('## Additional Context');
      if (__lastResultsPayload) {
        lines.push('<details><summary>Latest Striker Plan</summary>');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(__lastResultsPayload.plan ?? { steps: [] }, null, 2));
        lines.push('```');
        lines.push('');
        lines.push('</details>');
      } else {
        lines.push('_(No recent Striker run captured.)_');
      }
      lines.push('');

      const doc = await vscode.workspace.openTextDocument({
        content: lines.join('\n'),
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: false });
      vscode.window.showInformationMessage('Issue draft created (untitled). Save or copy into your tracker.');
    })
  );

  // Optional helper: Open File At (filename:line:col)
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.openFileAt', async (target?: string) => {
      const input = target ?? (await vscode.window.showInputBox({
        title: 'Open File At',
        placeHolder: 'path/to/file:line:col'
      }));
      if (!input) return;
      const m = input.match(/^(.*?):(\d+):(\d+)$/);
      if (!m) {
        vscode.window.showWarningMessage('Format should be path:line:col');
        return;
      }
      const [, file, lineStr, colStr] = m;
      const line = Math.max(parseInt(lineStr, 10) - 1, 0);
      const col = Math.max(parseInt(colStr, 10) - 1, 0);
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (ws) {
        const candidate = vscode.Uri.joinPath(ws.uri, file);
        try {
          await vscode.workspace.fs.stat(candidate);
          const editor2 = await vscode.window.showTextDocument(candidate, { preview: false });
          const pos = new vscode.Position(line, col);
          editor2.selection = new vscode.Selection(pos, pos);
          editor2.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          return;
        } catch {}
      }
      const found = await vscode.workspace.findFiles('**/' + file, '**/node_modules/**', 1);
      if (found.length) {
        const editor2 = await vscode.window.showTextDocument(found[0], { preview: false });
        const pos = new vscode.Position(line, col);
        editor2.selection = new vscode.Selection(pos, pos);
        editor2.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      } else {
        vscode.window.showWarningMessage('File not found: ' + file);
      }
    })
  );
  registerRunCoreAgentGoal(context);

}

export function deactivate() {}

function postToResultsPanel(msg: any) {
  try {
    const panel = createResultsPanel();
    panel.webview.postMessage(msg);
  } catch (err) {
    console.warn('[Striker] postMessage failed:', err);
  }
}

export function registerRunCoreAgentGoal(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('striker.runCoreAgentGoal', async () => {
    // 🔒 prevent any activation-time auto-open from stealing focus
    __suppressResultsPanelAutoOpen = true;
    try {
      // 1) Prompt FIRST
      const goal = await vscode.window.showInputBox({
        title: 'Core Agent Goal',
        prompt: 'Describe what you want the Core Agent to achieve.',
        placeHolder: 'e.g., Scan workspace and summarize pending TODOs',
        ignoreFocusOut: true,
        validateInput: v => (!v || !v.trim() ? 'Please enter a goal.' : null),
      });
      if (!goal || !goal.trim()) return;

      // 2) Open the Results Panel
      try { await vscode.commands.executeCommand('striker.openResultsPanel'); } catch {}

      // 3) (Optional) seed a "run started" row
      try {
        await vscode.commands.executeCommand('striker.results.appendRun', {
          kind: 'goal',
          title: goal.trim(),
          startedAt: Date.now(),
          meta: { sourceCommand: 'striker.runCoreAgentGoal' },
        });
      } catch {}

      // 4) Dispatch to whichever runner exists
      const runPayload = { goal: goal.trim(), mode: 'goal' as const, source: 'command' };
      const tryCommandsInOrder = [
        'striker.agent.runGoal',
        'striker.agent.run',
        'striker.internal.runAgentGoal',
        'striker.startRun',
      ];

      for (const cmd of tryCommandsInOrder) {
        try { await vscode.commands.executeCommand(cmd, runPayload); return; } catch {}
      }
      vscode.window.showWarningMessage(
        'Goal captured, but no agent runner command was found. Wire one of: ' +
        tryCommandsInOrder.join(', ')
      );
      
    } finally {
      // ✅ re-enable normal behavior
      __suppressResultsPanelAutoOpen = false;
    }
  });

  context.subscriptions.push(disposable);
}

/* ---------------------------------- Apply Last Run helpers ---------------------------------- */

type WriteCandidate = { path: string; content: string };

// Singleton Results Panel
let strikerPanel: vscode.WebviewPanel | undefined;

function createResultsPanel(): vscode.WebviewPanel {
  // Reuse existing panel if open
  if (strikerPanel) {
    try { strikerPanel.reveal(vscode.ViewColumn.Beside); } catch {}
    return strikerPanel;
  }

  // Create once
  strikerPanel = vscode.window.createWebviewPanel(
    'strikerResultsV2',
    'Striker Results',
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  // Render the full UI
  strikerPanel.webview.html = renderResultsHtml();

  strikerPanel.webview.onDidReceiveMessage(async (msg: any) => {
    const t = msg?.type as string;

    // 🔴 Stop (abort) current run
    if (t === 'abort-run') {
      try {
        __currentRunAbort?.abort?.();
      } catch (err) {
        console.warn('[Striker] Abort failed:', err);
      }

      try {
        strikerPanel?.webview.postMessage({
          type: 'AGENT_RESULT',
          payload: { type: 'run-stopped', ts: Date.now() }
        });
      } catch (err) {
        console.warn('[Striker] Failed to notify panel about stop:', err);
      }
      return;
    }

    // ... existing export/copy/open-logs/open-file code continues here ...
  });

  // Bridge: handle messages from the webview UI
  strikerPanel.webview.onDidReceiveMessage(async (msg: any) => {
    const t = msg?.type as string;

    // Export JSON to a file
    if (t === 'export-json') {
      try {
        const data = msg?.payload ?? __lastResultsPayload ?? {};
        const root = vscode.workspace.workspaceFolders?.[0]?.uri
          ?? vscode.Uri.file(process.cwd());
        const suggest = vscode.Uri.joinPath(root, 'striker-results.json');

        const uri = await vscode.window.showSaveDialog({
          defaultUri: suggest,
          filters: { JSON: ['json'] },
          saveLabel: 'Save Results JSON',
        });
        if (uri) {
          const bytes = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
          await vscode.workspace.fs.writeFile(uri, bytes);
          vscode.window.showInformationMessage(`Saved results to: ${uri.fsPath}`);
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Export JSON failed: ${String(err)}`);
      }
      return;
    }

    // Copy JSON to clipboard
    if (t === 'copy-json') {
      try {
        const data = msg?.payload ?? __lastResultsPayload ?? {};
        await vscode.env.clipboard.writeText(JSON.stringify(data, null, 2));
        vscode.window.setStatusBarMessage('Results JSON copied', 1500);
      } catch (err) {
        vscode.window.showErrorMessage(`Copy JSON failed: ${String(err)}`);
      }
      return;
    }

    // Open logs folder (adjust path if yours differs)
    if (t === 'open-logs') {
      try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!root) return;
        const logsUri = vscode.Uri.joinPath(root, '.striker', 'logs');
        await vscode.commands.executeCommand('revealInExplorer', logsUri);
      } catch (err) {
        vscode.window.showErrorMessage(`Open Logs failed: ${String(err)}`);
      }
      return;
    }

    // Open file deep link like "demo.txt:2:1"
    if (t === 'open-file') {
      try {
        const target = String(msg?.target ?? '');
        if (!target) return;

        // Parse "path[:line][:col]"
        let file = target;
        let line = 1;
        let col = 1;
        const parts = target.split(':');
        if (parts.length >= 2) {
          col = Number(parts.pop() || '1') || 1;
          line = Number(parts.pop() || '1') || 1;
          file = parts.join(':');
        }

        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!root) return;
        const uri = vscode.Uri.joinPath(root, file);

        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        const pos = new vscode.Position(Math.max(0, line - 1), Math.max(0, col - 1));
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      } catch (err) {
        vscode.window.showErrorMessage(`Open File failed: ${String(err)}`);
      }
      return;
    }
  });


  // Cleanup on close
  strikerPanel.onDidDispose(() => { strikerPanel = undefined; });

  return strikerPanel;
}
export { createResultsPanel };


/** Find file write candidates in payload (execution preferred, plan fallback). */
function collectWriteCandidates(payload: ResultsPayload): WriteCandidate[] {
  const out: WriteCandidate[] = [];

  // 1) Prefer execution rows
  const rows: ExecRow[] = Array.isArray(payload.execution) ? payload.execution : [];
  for (const r of rows) {
    const intent = (r.intent || '').toLowerCase();
    const maybeWrite =
      intent === 'create_file' ||
      intent === 'write_file' ||
      intent === 'file_write' ||
      intent === 'write';

    if (!maybeWrite && !r.detail) continue;

    // Pattern: "Would write file: name\n--- preview ---\n+ content"
    if (typeof r.detail === 'string') {
      const m = r.detail.match(/Would write file:\s*([^\r\n]+)[\r\n]+---\s*preview\s*---[\r\n]+([\s\S]*)/i);
      if (m) {
        const file = m[1].trim();
        const preview = m[2] || '';
        const content = preview
          .split(/\r?\n/)
          .map((ln) => ln.startsWith('+ ') ? ln.slice(2) : ln)
          .join('\n')
          .replace(/\n+$/, ''); // trim trailing newlines
        if (file) out.push({ path: file, content });
        continue;
      }

      // Pattern: "file.txt:1:1" (no content preview) -> we'll just ensure file exists
      const p2 = r.detail.match(/^([^\r\n:]+):\d+:\d+$/);
      if (p2) {
        out.push({ path: p2[1].trim(), content: '' });
        continue;
      }
    }

    // If flagged as a write by intent but no detail, try to infer from path/id
    if (maybeWrite) {
      const file = (r.path || '').trim();
      if (file) out.push({ path: file, content: '' });
    }
  }

  // 2) Fallback to plan create_file steps (empty content)
  if (out.length === 0 && payload.plan && Array.isArray(payload.plan.steps)) {
    for (const s of payload.plan.steps as any[]) {
      const intent = (s?.intent || '').toLowerCase();
      if (intent === 'create_file' && s?.inputs?.path) {
        out.push({ path: String(s.inputs.path), content: '' });
      }
    }
  }

  // De-dup by path, prefer the one with non-empty content
  const seen = new Map<string, WriteCandidate>();
  for (const c of out) {
    const prev = seen.get(c.path);
    if (!prev || (!prev.content && c.content)) seen.set(c.path, c);
  }
  return Array.from(seen.values());
}

/** Ask user to pick which files to write. */
async function confirmWriteCandidates(cands: WriteCandidate[]): Promise<WriteCandidate[]> {
  const items = cands.map((c) => ({
    label: c.path,
    description: c.content ? `${c.content.length} bytes` : '(empty)',
    picked: true
  }));
  const picks = await vscode.window.showQuickPick(items, {
    title: 'Apply Last Run: choose files to write',
    canPickMany: true,
    matchOnDescription: true
  });
  if (!picks || !picks.length) return [];
  const set = new Set(picks.map((p) => p.label));
  return cands.filter((c) => set.has(c.path));
}
