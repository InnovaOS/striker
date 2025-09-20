import * as vscode from 'vscode';
import { runTask } from "../../../core-agent/dist/index.js";
import { showResultsPanel } from '../ui/resultsPanel.js';

export function registerRunAgent(context: vscode.ExtensionContext) {
  const cmdId = 'striker.runAgent';

  const disposable = vscode.commands.registerCommand(cmdId, async () => {
    const userPrompt = await vscode.window.showInputBox({
      prompt: 'What should Striker do?',
      placeHolder: 'e.g., “scan workspace and propose edits”'
    });
    if (!userPrompt) return;

    const payload = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Striker', cancellable: false },
      async progress => {
        progress.report({ message: 'Planning…' });
        const result = runTask({ prompt: userPrompt, mode: "preview" });
        progress.report({ message: 'Done' });
        return result;
      }
    );

    showResultsPanel('Striker Results', payload);
  });

  context.subscriptions.push(disposable);
}
