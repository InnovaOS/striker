
import * as vscode from 'vscode';
import { showResultsPanel, acquireOrCreateResultsPanel } from './ui/resultsPanel';
import { runAgent } from './features/runAgent';
import showDemo from './features/showDemo';
import { ResultsPayload, ExecRow } from './types';

// In-memory store of the last final payload shown in the panel.
// Used by export/apply commands.
let __lastResultsPayload: ResultsPayload | undefined;

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

    // 1) Open the panel with a tiny placeholder (so the webview is ready to receive stream)
    showResultsPanel('Striker Results', { version: 1, plan: { steps: [] } });

    // 2) Get the live panel instance so we can post messages while the agent runs
    const panel = acquireOrCreateResultsPanel('Striker Results');

    // Small helper to post to the panel safely
    const post = (msg: any) => { try { panel.webview.postMessage(msg); } catch {} };

    // 3) Run the real agent and stream execution rows
    const result = await runAgent(
      (e) => {
        if (e?.type === 'exec-step') {
          // Results Panel expects 'append-exec'
          post({ type: 'append-exec', row: e.row });
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

    const finalPayload: ResultsPayload = {
      version: 1,
      plan: result.plan,
      execution: execRows,               // <- array of ExecRow
      observation: result.observation
    };

    // keep for Export / Apply Last Run
    __lastResultsPayload = finalPayload;

    // 5) Send final payload to the panel (it will render Plan/Observation/JSON and keep streamed Execution)
    post({ type: 'final-payload', payload: finalPayload });

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


  // Striker: Open Results Panel (minimal payload)
  context.subscriptions.push(
    vscode.commands.registerCommand('striker.openResultsPanel', async () => {
      const payload: ResultsPayload = { version: 1, plan: { steps: [] } };
      __lastResultsPayload = payload;
      showResultsPanel('Striker Results', payload);
    })
  );

  function postToPanel(msg: any) {
    try {
      const panel = acquireOrCreateResultsPanel('Striker Results');
      panel.webview.postMessage(msg);
    } catch {
      // panel might not be open yet, ignore
    }
  }

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
}

export function deactivate() {}

/** Demo payload factory — replace with your real agent’s output when ready. */
function makeDemoPayload(prompt: string): ResultsPayload {
  return {
    version: 1,
    plan: {
      steps: [
        { id: 'analyze-prompt', title: 'Analyze Prompt', intent: 'analyze', inputs: { prompt }, rollbackHint: 'N/A' },
        { id: 'simulate-action', title: 'Simulate Action', intent: 'dry_run', inputs: { file: 'demo1.txt' }, rollbackHint: 'Revert changes' },
        { id: 'write-demo1', title: 'Write File', intent: 'create_file', inputs: { path: 'demo1.txt' } }
      ]
    },
    observation: {
      notes: ['all steps executed successfully', 'no errors'],
      metrics: { duration_ms: 650 }
    }
  };
}

/* ---------------------------------- Apply Last Run helpers ---------------------------------- */

type WriteCandidate = { path: string; content: string };

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
