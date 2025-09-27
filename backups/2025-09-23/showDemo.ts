import * as vscode from 'vscode';
import { showResultsPanel } from '../ui/resultsPanel';
import type { AgentPayload } from '../types';
import { demoHappy, demoWithError, demoWithWarnings } from '../demoPayload';

export function registerShowDemo(context: vscode.ExtensionContext) {
  const cmdId = 'striker.showDemo';

  const disposable = vscode.commands.registerCommand(cmdId, async () => {
    const choice = await vscode.window.showQuickPick(
      ['Happy', 'Error', 'Warnings'],
      { title: 'Striker Demo Payload' }
    );

    const map: Record<string, AgentPayload> = {
      'Happy': demoHappy,
      'Error': demoWithError,
      'Warnings': demoWithWarnings
    };

    const payload = map[choice ?? 'Happy'] ?? demoHappy;
    await showResultsPanel('Striker Results', payload);
  });

  context.subscriptions.push(disposable);
}
