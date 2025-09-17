import * as vscode from 'vscode';

// robust import that works with CJS/ESM/default/named exports
function getHelloAdapter(): (() => string) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('cline-adapter');
    const fn = mod?.helloAdapter ?? mod?.default?.helloAdapter;
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Striker is active');

  const helloCmd = vscode.commands.registerCommand('striker.hello', () => {
    vscode.window.showInformationMessage('Hello Striker!');
  });

  const aboutCmd = vscode.commands.registerCommand('striker.about', () => {
    vscode.window.showInformationMessage(
      '⚡ Striker — OSS-powered AI coding assistant.\nBuilt on Cline (MIT) + our Pro differentiators.'
    );
  });

  const runAgentStub = vscode.commands.registerCommand('striker.runAgentStub', async () => {
    const hello = getHelloAdapter();
    if (!hello) {
      // also show what exports exist to diagnose quickly
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod: any = (() => { try { return require('cline-adapter'); } catch { return {}; } })();
      const keys = Object.keys(mod).concat(mod?.default ? ['default.' + Object.keys(mod.default).join(', default.')] : []);
      vscode.window.showErrorMessage(`Stub error: helloAdapter not found. Exports: ${keys.join(' ')}`);
      return;
    }
    vscode.window.showInformationMessage(`Stub: ${hello()}`);
  });

  context.subscriptions.push(helloCmd, aboutCmd, runAgentStub);
}

export function deactivate() {}
