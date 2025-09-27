// packages/vscode-extension/src/ui/resultsPanel.ts
import * as vscode from 'vscode';

let currentPanel: vscode.WebviewPanel | undefined;
let lastPayload: any | undefined;

export function acquireOrCreateResultsPanel(title: string): vscode.WebviewPanel {
  if (currentPanel) {
    currentPanel.title = title;
    currentPanel.reveal(vscode.ViewColumn.Active);
    return currentPanel;
  }
  currentPanel = vscode.window.createWebviewPanel(
    'striker.results',
    title,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true, enableCommandUris: true }
  );
  currentPanel.onDidDispose(() => (currentPanel = undefined));
  // lightweight shell; full content set by showResultsPanel
  currentPanel.webview.html = baseHtml();
  return currentPanel;
}

export function showResultsPanel(title: string, payload: any) {
  lastPayload = payload;
  const panel = acquireOrCreateResultsPanel(title);
  panel.webview.html = renderHtml(payload);
}

/* ------------------------------------------------------------------------------------------------
 * HTML
 * ------------------------------------------------------------------------------------------------ */

function baseHtml() {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"/></head>
  <body style="background:#1e1e1e;color:#ddd;font-family:var(--vscode-font-family,monospace);font-size:12px;">
    <div style="padding:12px;">Loading…</div>
  </body>
</html>`;
}

function renderHtml(data: any) {
  const css = `
    body{background:#1e1e1e;color:#ddd;font-family:var(--vscode-font-family,monospace);font-size:12px;}
    h1{font-size:16px;margin:8px 0 4px;}
    .summary{background:#21372a;color:#cfead7;padding:6px 8px;border-radius:6px;margin:8px 0;}
    .toolbar{margin:6px 0;}
    .toolbar button{margin-right:6px;}
    details{border:1px solid #2f2f2f;border-radius:6px;margin:10px 0;background:#171717;}
    summary{cursor:pointer;padding:6px 8px;background:#202020;border-radius:6px;}
    .body{padding:8px;}
    table{width:100%;border-collapse:collapse;}
    th,td{border:1px solid #2f2f2f;padding:6px;vertical-align:top;}
    pre{white-space:pre-wrap;margin:0;}
    .errors{border:1px solid #703b3b;background:#2a1212;color:#ffd7d7;border-radius:6px;padding:8px;margin:10px 0;}
    a{color:#4ea1ff;text-decoration:none;}
    .badge{display:inline-block;background:#2a2a2a;border-radius:10px;padding:2px 6px;margin-top:6px;}
  `;

  const planRows = (data?.plan?.steps ?? []).map((s: any) => {
    if (typeof s === 'string') {
      return row([esc(s), '', '', '', '']);
    }
    return row([
      esc(s?.id ?? ''),
      esc(s?.title ?? ''),
      esc(s?.intent ?? ''),
      code(json(s?.inputs ?? {})),
      esc(s?.rollbackHint ?? ''),
    ]);
  }).join('');

  const execRows = (data?.execution?.steps ?? []).map(execRow).join('');

  const errorsCard = Array.isArray(data?.execution?.errors) && data.execution.errors.length
    ? renderErrorsCard(data)
    : '';

  const obsRows = (data?.observation?.notes ?? []).map((n: string, i: number) =>
    row([String(i + 1), linkify(esc(n))])
  ).join('');

  const duration = data?.observation?.metrics?.duration_ms ?? data?.observation?.metrics?.durationMs ?? 0;
  const okCount = (data?.execution?.steps ?? []).filter((r: any) => r?.status === 'ok' || r?.ok === true).length;

  // Sections
  const planSection = `
<details open>
  <summary>Plan</summary>
  <div class="body">
    <table>
      <thead><tr><th>id</th><th>title</th><th>intent</th><th>inputs</th><th>rollbackHint</th></tr></thead>
      <tbody id="plan-body">${planRows}</tbody>
    </table>
  </div>
</details>`;

  const execSection = `
<details open>
  <summary>Execution</summary>
  <div class="body">
    <table>
      <thead><tr><th>id</th><th>title</th><th>intent</th><th>path</th><th>status</th><th>stepId</th><th>detail/diff</th></tr></thead>
      <tbody id="exec-body">${execRows}</tbody>
    </table>
  </div>
</details>`;

  const obsSection = `
<details open>
  <summary>Observation</summary>
  <div class="body">
    <table>
      <thead><tr><th>id</th><th>note</th></tr></thead>
      <tbody>${obsRows}</tbody>
    </table>
    <div class="badge">duration_ms: ${duration}</div>
  </div>
</details>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/>
  <style>${css}</style>
</head>
<body>
  <h1>Striker Results</h1>

  <div class="summary">Run Summary: <strong>${okCount} ok</strong></div>
  <div class="toolbar">
    <button id="btn-export">Export JSON</button>
    <button id="btn-logs">Open Logs</button>
  </div>

  ${planSection}
  ${execSection}
  ${errorsCard}
  ${obsSection}

  <details>
    <summary>Raw JSON</summary>
    <div class="body"><pre>${esc(JSON.stringify(data ?? {}, null, 2))}</pre></div>
  </details>

  <script>
    const vscode = acquireVsCodeApi();

    // Streamed exec rows from extension
    window.addEventListener('message', (ev) => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === 'append-exec' && msg.row) {
        const tbody = document.getElementById('exec-body');
        if (!tbody) return;
        const tr = document.createElement('tr');
        const r = msg.row;
        tr.innerHTML = ( ${execRowClientJs()} )(r);
        tbody.appendChild(tr);

        // update summary if row is ok
        const ok = (r.status === 'ok') || (r.ok === true);
        if (ok) {
          const s = document.querySelector('.summary');
          if (s) {
            const m = s.textContent.match(/(\\d+)/);
            const n = m ? (parseInt(m[1], 10) + 1) : 1;
            s.innerHTML = 'Run Summary: <strong>' + n + ' ok</strong>';
          }
        }
      }
    });

    // Toolbar
    document.getElementById('btn-export')?.addEventListener('click', () => vscode.postMessage({ type: 'export-json' }));
    document.getElementById('btn-logs')?.addEventListener('click', () => vscode.postMessage({ type: 'open-logs' }));

    // Errors: Create Issue
    document.getElementById('btn-create-issue')?.addEventListener('click', () => vscode.postMessage({ type: 'create-issue' }));
  </script>
</body>
</html>`;
}

/* ------------------------------------------------------------------------------------------------
 * Helpers used server-side to produce HTML
 * ------------------------------------------------------------------------------------------------ */

function execRow(row: any) {
  const cells = [
    esc(row?.id ?? ''),
    esc(row?.title ?? ''),
    esc(row?.intent ?? ''),
    linkify(esc(row?.path ?? '')),
    esc(row?.status ?? (row?.ok === false ? 'error' : row?.ok === true ? 'ok' : '')),
    esc(row?.stepId ?? ''),
    // was: row?.diff ? code(json(row.diff)) : linkify(esc(row?.detail ?? '')),
    (row?.detail ? linkify(esc(row.detail)) : '') + (row?.diff ? code(json(row.diff)) : ''),

  ];
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
}

// Same logic but as a client-side function literal, so we can append streamed rows
function execRowClientJs() {
  return `
  (function(r){
    function esc(x){const map={'&':'&amp;','<':'&lt;','>':'&gt;'};return String(x).replace(/[&<>]/g,(m)=>map[m]??m);}
    function linkify(txt){
      const m = String(txt).match(/([^\\s:]+\\.[^\\s:]+):(\\d+)(?::(\\d+))?/);
      if(m){
        const path=m[1], line=Number(m[2]), col=m[3]?Number(m[3]):undefined;
        const args=encodeURIComponent(JSON.stringify({path,line,col}));
        return '<a href="command:striker.openFileAt?'+args+'">'+esc(txt)+'</a>';
      }
      return esc(txt);
    }
    function code(x){return '<pre>'+esc(typeof x==='string'?x:JSON.stringify(x,null,2))+'</pre>';}
    return [
      esc(r?.id ?? ''), esc(r?.title ?? ''), esc(r?.intent ?? ''), linkify(r?.path ?? ''),
      esc(r?.status ?? (r?.ok===false?'error':r?.ok===true?'ok':'')), esc(r?.stepId ?? ''),
      
      (r?.detail ? linkify(r.detail) : '') + (r?.diff ? code(r.diff) : '')

    ].map(c=>'<td>'+c+'</td>').join('');
  })
  `;
}

function esc(x: any) {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
  return String(x).replace(/[&<>]/g, (m: string) => map[m] ?? m);
}
function code(x: any) {
  return `<pre>${esc(typeof x === 'string' ? x : JSON.stringify(x, null, 2))}</pre>`;
}
function json(x: any) {
  try { return JSON.stringify(x, null, 2); } catch { return String(x); }
}
function row(cols: string[]) {
  return `<tr>${cols.map((c) => `<td>${c}</td>`).join('')}</tr>`;
}

// Turn tokens like "src/index.ts:42:3" into command links
function linkify(txt: string) {
  const m = String(txt).match(/([^\s:]+\.[^\s:]+):(\d+)(?::(\d+))?/);
  if (m) {
    const path = m[1]; const line = Number(m[2]); const col = m[3] ? Number(m[3]) : undefined;
    const args = encodeURIComponent(JSON.stringify({ path, line, col }));
    return `<a href="command:striker.openFileAt?${args}">${esc(txt)}</a>`;
  }
  return esc(txt);
}

function renderErrorsCard(data: any) {
  const errs = (data?.execution?.errors ?? []).map((e: string, i: number) =>
    `<div style="margin:6px 0;">
      <pre id="err-${i}">${esc(e)}</pre>
      <button onclick="navigator.clipboard.writeText(document.getElementById('err-${i}').innerText)">Copy</button>
    </div>`
  ).join('');
  return `<div class="errors">
    <h3 style="margin-top:0;">Errors</h3>
    ${errs}
    <button id="btn-create-issue">Create Issue</button>
  </div>`;
}
