import * as vscode from 'vscode';
import { showResultsPanel } from './ui/resultsPanel';

export function activate(ctx: vscode.ExtensionContext) {
  console.log('[Striker EXT] activate @', ctx.extensionUri.toString());

  const disposable = vscode.commands.registerCommand('striker.runAgent', async () => {
    const goal = await vscode.window.showInputBox({
      prompt: 'What should Striker do?',
      placeHolder: 'e.g., "create README with usage section"',
      value: 'create README with usage section',
    });
    if (!goal) return;

    // Minimal demo payload so the panel always opens
    const payload = {
      plan: {
        id: 'plan-create-readme-with',
        goal,
        steps: [
          {
            id: 'create_file-README-md',
            title: 'Create README.md file',
            intent: 'create_file',
            inputs: { path: 'README.md', contentTemplate: 'basic' },
            acceptance: [
              "README.md exists at repo root",
              "contains 'Usage' or 'Installation' section",
            ],
            rollbackHint: 'Delete README.md if content is incorrect',
          },
          {
            id: 'edit_file-README-md',
            title: 'Update README.md content',
            intent: 'edit_file',
            inputs: { path: 'README.md', section: 'Usage|Installation|Overview', mode: 'append_or_create' },
            acceptance: [
              "README.md exists at repo root",
              "contains 'Usage' or 'Installation' section",
            ],
            rollbackHint: 'Revert README.md changes if content is incorrect',
          },
        ],
      },
      execution: { steps: [], notes: [] },
      observation: { summary: { created: [], edited: [], skipped: [], errors: [], stats: { filesCreated: 0, filesEdited: 0, linesAdded: 0, linesRemoved: 0 } }, notes: [] },
    };

    showResultsPanel('Striker Results', payload);
  });

  ctx.subscriptions.push(disposable);
}

export function deactivate() {
  console.log('[Striker EXT] deactivated');
}
