// packages/vscode-extension/src/extension.ts
import * as vscode from 'vscode';
import { acquireOrCreateResultsPanel, renderResultsHtml, showResultsPanel } from './ui/resultsPanel';
import { runAgent } from './features/runAgent';

const logsChannel = vscode.window.createOutputChannel('Striker Logs');
let lastResult: any = null; // store latest run result for Export/Logs

export function activate(context: vscode.ExtensionContext) {
  // Command: Striker: Run (basic example)
  const disposable = vscode.commands.registerCommand('striker.runAgent', async () => {
    const userPrompt = await vscode.window.showInputBox({
      title: 'Striker Prompt',
      prompt: 'What should Striker do?',
      placeHolder: 'e.g., scan workspace and summarize',
    }) || '';

    // 1) Create/reveal panel
    const panel = acquireOrCreateResultsPanel('Striker Results');
    panel.webview.html = renderResultsHtml();
    panel.webview.postMessage({
      type: 'append-exec',
      row: {
        id: '0',
        title: 'Analyze Prompt',
        intent: 'analyze',
        path: '-',
        status: 'ok',
        ok: true,
        stepId: 'analyze-prompt',
        detail: userPrompt || '(empty)',
      }
    });


    // 2) Run the agent and stream to the panel
    const result = await runAgent((e: { type: 'exec-step' | 'append-exec'; row: any }) => {
      // normalize event type so the panel always understands it
      const msg = e && e.type === 'exec-step' ? { type: 'append-exec', row: e.row } : e;
      panel.webview.postMessage(msg);
    });

    lastResult = result;

    // 3) Send final payload (fills Plan/Observation/Raw JSON)
    const payload = {
      ...result,
      plan: {
        ...(result?.plan || {}),
        // keep your existing plan fields and add inputs.prompt
        inputs: { prompt: userPrompt }
      }
    };

    panel.webview.postMessage({ type: 'final-payload', payload });


    // 4) Handle messages from the webview (Export JSON / Open Logs / Open File)
    panel.webview.onDidReceiveMessage(async (msg: any) => {
      if (msg?.type === 'export-json') {
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('striker-result.json'),
          filters: { JSON: ['json'] },
        });
        if (saveUri) {
          const bytes = new TextEncoder().encode(JSON.stringify(lastResult ?? {}, null, 2));
          await vscode.workspace.fs.writeFile(saveUri, bytes);
          vscode.window.showInformationMessage('Exported to ' + saveUri.fsPath);
        }
      }

      if (msg?.type === 'open-logs') {
        logsChannel.clear();
        logsChannel.show(true);
        logsChannel.appendLine('--- Striker Logs ---');
        try {
          logsChannel.appendLine(JSON.stringify(lastResult ?? {}, null, 2));
        } catch {
          logsChannel.appendLine('(no result yet)');
        }
        vscode.window.showInformationMessage('Opened "Striker Logs".');
      }

      if (msg?.type === 'open-file' && typeof msg.target === 'string') {
        const parts = msg.target.split(':'); // "file:line:col"
        const file = parts[0];
        const line = parts[1] ? parseInt(parts[1], 10) : 1;
        const col  = parts[2] ? parseInt(parts[2], 10) : 1;

        try {
          // support relative paths from the first workspace folder
          let uri = vscode.Uri.file(file);
          if (file && !file.startsWith('/') && vscode.workspace.workspaceFolders?.length) {
            uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, file);
          }

          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc);
          const pos = new vscode.Position(line - 1, col - 1);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos));
        } catch {
          vscode.window.showWarningMessage('Could not open ' + file);
        }
      }
    });
  });

  context.subscriptions.push(disposable);

  // (Optional) Example command showing how your older code might call showResultsPanel
  const disposableShow = vscode.commands.registerCommand('striker.showPanel', async () => {
    // keep the 2-arg signature your code expects
    showResultsPanel('Striker Results', {});
  });
  context.subscriptions.push(disposableShow);
}

export function deactivate() {}
