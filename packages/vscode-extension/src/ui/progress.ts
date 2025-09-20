import * as vscode from 'vscode';

/**
 * Wrap a long-running task with:
 *  - bottom-right status bar spinner
 *  - cancellable progress notification
 *
 * Usage:
 *   await withProgressAndSpinner("Striker: Running agent", async (token, report) => {
 *     report("Planning…");
 *     await doPlan();
 *     if (token.isCancellationRequested) return;
 *     report("Executing…");
 *     await doExecute();
 *   });
 */
export async function withProgressAndSpinner<T>(
  title: string,
  task: (token: vscode.CancellationToken, report: (message?: string, increment?: number) => void) => Promise<T>
): Promise<T> {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  status.text = `$(loading~spin) ${title}`;
  status.tooltip = title;
  status.show();

  try {
    return await vscode.window.withProgress<T>(
      { location: vscode.ProgressLocation.Notification, title, cancellable: true },
      async (progress, token) => {
        const report = (message?: string, increment?: number) => progress.report({ message, increment });
        try {
          const result = await task(token, report);
          return result;
        } finally {
          // no-op here; status bar cleaned in finally below
        }
      }
    );
  } finally {
    status.hide();
    status.dispose();
  }
}
