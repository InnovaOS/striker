import * as vscode from 'vscode';
import { registerRunAgent } from './features/runAgent';
import { registerShowDemo } from './features/showDemo';

export function activate(ctx: vscode.ExtensionContext) {
  console.log('[Striker EXT] activate @', ctx.extensionUri.toString());
  registerRunAgent(ctx);   // real agent
  registerShowDemo(ctx);   // demo payloads (separate command)
  // Listen for messages from the webview
  vscode.window.registerWebviewPanelSerializer('strikerResults', {
    async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
      webviewPanel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.command === 'openLogs') {
          vscode.window.showInformationMessage('Open Logs: not implemented yet');
          // later: open your agent log file in editor
        }
        if (msg.command === 'openFile') {
          if (msg.path) {
            try {
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(msg.path));
              await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            } catch (e) {
              vscode.window.showErrorMessage(`[Striker] Could not open file: ${msg.path}`);
            }
          }
        }
      });
    }
  });

}

export function deactivate() {
  console.log('[Striker EXT] deactivated');
}
