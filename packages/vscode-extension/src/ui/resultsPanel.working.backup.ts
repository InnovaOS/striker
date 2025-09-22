import * as vscode from 'vscode';

export function showResultsPanel(title: string, payload: any) {
  const panel = vscode.window.createWebviewPanel(
    'strikerResults',
    title,
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(payload);

  // IMPORTANT: message bridge (needed for buttons & clickable paths)
  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      if (msg?.command === 'openFile' && typeof msg?.path === 'string') {
        await openWorkspacePath(msg.path);
        return;
      }
      if (msg?.command === 'openLogs') {
        await openLogsFile();
        return;
      }
      if (msg?.command === 'copy' && typeof msg?.text === 'string') {
        await vscode.env.clipboard.writeText(msg.text);
        vscode.window.showInformationMessage('Copied to clipboard');
        return;
      }
    } catch (e) {
      vscode.window.showErrorMessage(`[Striker] Webview action failed: ${String(e)}`);
    }
  });
}

// --- Extension-side helpers ---

async function openWorkspacePath(pathLike: string) {
  // supports "file.ts:42[:col]"
  const m = pathLike.match(
    /([A-Za-z0-9_./-]+\.(md|ts|js|tsx|jsx|json|yml|yaml|py|go|rs|java|kt|cs|c|cpp))(?:[:](\d+))?(?:[:](\d+))?/
  );
  const fileOnly = m ? m[1] : pathLike;
  const line = m?.[2] ? Math.max(1, parseInt(m[2], 10)) : undefined;
  const col  = m?.[3] ? Math.max(1, parseInt(m[3], 10)) : 1;

  let uri: vscode.Uri;
  if (/^([a-zA-Z]:[\\/]|\/)/.test(fileOnly)) {
    uri = vscode.Uri.file(fileOnly);
  } else {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!ws) { vscode.window.showErrorMessage('No workspace open'); return; }
    uri = vscode.Uri.joinPath(ws, fileOnly);
  }

  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
  if (line) {
    const pos = new vscode.Position(Math.min(line, doc.lineCount) - 1, Math.max(0, (col ?? 1) - 1));
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }
}

async function openLogsFile() {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!ws) { vscode.window.showErrorMessage('No workspace open'); return; }
  const logsDir = vscode.Uri.joinPath(ws, '.striker');
  const logUri = vscode.Uri.joinPath(logsDir, 'striker.log');
  try { await vscode.workspace.fs.createDirectory(logsDir); } catch {}
  try { await vscode.workspace.fs.stat(logUri); }
  catch {
    const seed = new TextEncoder().encode(
      `[${new Date().toISOString()}] Striker log created.\n` +
      `Tip: write agent run notes here.\n`
    );
    await vscode.workspace.fs.writeFile(logUri, seed);
  }
  const doc = await vscode.workspace.openTextDocument(logUri);
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
}

// --- Webview HTML ---

function getWebviewContent(payload: any): string {
  const payloadEncoded = encodeURIComponent(JSON.stringify(payload || {}));

  return /* html */ `
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    :root{
      --fg: var(--vscode-editor-foreground);
      --bg: var(--vscode-editor-background);
      --border: var(--vscode-editorWidget-border);
      --hover: var(--vscode-editorHoverWidget-background);
      --ok-bg: #1e4620; --ok-fg: #a3e5a0;
      --warn-bg: #4a3c1e; --warn-fg: #f6e58d;
      --err-bg: #4a1e1e; --err-fg: #ff9f9f;
    }
    body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); padding: 10px; }
    h1 { margin: 0 0 10px; }
    .summary { padding: 8px; margin: 10px 0 12px; border-radius: 6px; }
    .summary.ok { background: var(--ok-bg); color: var(--ok-fg); }
    .summary.warning { background: var(--warn-bg); color: var(--warn-fg); }
    .summary.error { background: var(--err-bg); color: var(--err-fg); }
    .summary.neutral { background: #333; color: #ccc; }
    .toolbar button { margin-right: 6px; }

    .card { border: 1px solid var(--border); border-radius: 6px; margin: 10px 0; }
    .card-header {
      padding: 8px 10px;
      cursor: pointer;
      background: var(--hover);
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-header:hover { background: #555; }
    .card-header::after { content: '▶'; transition: transform 0.2s; }
    .card-header.open::after { transform: rotate(90deg); content: '▼'; }
    .card-content { padding: 8px 10px; display: none; }
    .card-content.active { display: block; }

    table { border-collapse: collapse; width: 100%; margin-top: 6px; }
    th, td { border: 1px solid #444; padding: 4px 6px; font-size: 12px; vertical-align: top; }
    th { background: var(--vscode-editor-inactiveSelectionBackground); }
    .error-row { background: var(--err-bg); color: var(--err-fg); }
    .warning-row { background: var(--warn-bg); color: var(--warn-fg); }
    em { color: #999; }
  </style>
</head>
<body>
  <h1>Striker Results</h1>

  <!-- Summary banner -->
  <div id="summary" class="summary neutral">Run Summary: (calculating…)</div>

  <!-- Toolbar -->
  <div class="toolbar" style="margin:8px 0 10px;">
    <button id="btnExport">Export JSON</button>
    <button id="btnLogs">Open Logs</button>
  </div>

  <!-- Collapsible cards -->
  <div class="card">
    <div class="card-header open" onclick="toggleCard(this)">Plan</div>
    <div class="card-content active"><div id="plan-steps">—</div></div>
  </div>

  <div class="card">
    <div class="card-header open" onclick="toggleCard(this)">Execution</div>
    <div class="card-content active"><div id="execution">—</div></div>
  </div>

  <div class="card">
    <div class="card-header open" onclick="toggleCard(this)">Observation</div>
    <div class="card-content active">
      <div id="observation">—</div>
      <div id="metrics" style="margin-top:6px;"></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header open" onclick="toggleCard(this)">Raw JSON</div>
    <div class="card-content active"><pre><code id="raw-json"></code></pre></div>
  </div>

<script>
  // Safe payload parse
  var __PAYLOAD_JSON = "${payloadEncoded}";
  var payload = {};
  try { payload = __PAYLOAD_JSON ? JSON.parse(decodeURIComponent(__PAYLOAD_JSON)) : {}; }
  catch (e) { payload = {}; }

  // Helpers
  function toggleCard(header) {
    var content = header.nextElementSibling;
    if (!content) return;
    var open = content.classList.toggle('active');
    header.classList.toggle('open', open);
  }
  function vsApi(){ return acquireVsCodeApi(); }
  function openFile(path){ vsApi().postMessage({ command:'openFile', path }); }
  function openLogs(){ vsApi().postMessage({ command:'openLogs' }); }
  function exportJson(){
    const text = JSON.stringify(payload || {}, null, 2);
    const blob = new Blob([text], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date(); const pad = n=>n<10?'0'+n:n;
    const name = 'striker-results-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+'.json';
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  // Summary
  function renderSummary(p){
    var execSteps = (p && p.execution && p.execution.steps) || [];
    var errors = execSteps.filter(s => s && s.status === 'error').length;
    var warnings = execSteps.filter(s => s && s.status === 'warning').length;
    var oks = execSteps.filter(s => s && s.status === 'ok').length;

    var text = 'No steps executed';
    var cls = 'neutral';
    if (execSteps.length > 0) {
      var parts = [];
      if (oks > 0) parts.push(oks + ' ok');
      if (warnings > 0) parts.push(warnings + ' warning' + (warnings > 1 ? 's' : ''));
      if (errors > 0) parts.push(errors + ' error' + (errors > 1 ? 's' : ''));
      text = parts.join(' · ');
      if (errors > 0) cls = 'error';
      else if (warnings > 0) cls = 'warning';
      else cls = 'ok';
    }
    var box = document.getElementById('summary');
    if (box) { box.textContent = 'Run Summary: ' + text; box.className = 'summary ' + cls; }
  }

  // Metrics badges
  function renderMetrics(p){
    const container = document.getElementById('metrics');
    if (!container) return;
    const metrics = p && p.observation && p.observation.metrics;
    if (!metrics) { container.innerHTML = ''; return; }
    const fmt = (n)=>{ const x=Number(n); return Number.isFinite(x)?x.toLocaleString():String(n); }
    container.innerHTML = Object.keys(metrics).map(k =>
      '<span style="background:#444;padding:2px 6px;border-radius:4px;margin-right:6px;font-size:11px;">'+k+': '+fmt(metrics[k])+'</span>'
    ).join('');
  }

  // Table renderer with clickable paths
  function renderSmartTable(sel, rows){
    const container = document.querySelector(sel);
    if (!container) return;
    if (!rows || !rows.length){ container.innerHTML = '<em>No data</em>'; return; }

    const cols = Object.keys(rows[0] || {});
    let html = '<table><tr>' + cols.map(c=>'<th>'+c+'</th>').join('') + '</tr>';
    const fileRe = /([A-Za-z0-9_./-]+\\.(md|ts|js|tsx|jsx|json|yml|yaml|py|go|rs|java|kt|cs|c|cpp))(?:[:](\\d+))?(?:[:](\\d+))?/g;

    for (const r of rows){
      const cls = r && r.status==='error' ? 'error-row' : (r && r.status==='warning' ? 'warning-row' : '');
      html += '<tr class="'+cls+'">' + cols.map(c=>{
        const val = r[c];
        if (val===null || val===undefined) return '<td></td>';

        if (typeof val === 'string'){
          if (/^([A-Za-z0-9_./-]+\\.(md|ts|js|tsx|jsx|json|yml|yaml|py|go|rs|java|kt|cs|c|cpp))(?:[:](\\d+))?(?:[:](\\d+))?$/.test(val)) {
            return '<td><a href="#" onclick="openFile(\\''+val.replace(/'/g,"\\\\'")+'\\')">'+val+'</a></td>';
          }
          const linked = val.replace(fileRe, (m)=>'<a href="#" onclick="openFile(\\''+m.replace(/'/g,"\\\\'")+'\\')">'+m+'</a>');
          return '<td>'+linked+'</td>';
        }

        if (typeof val === 'object'){
          let link = '';
          if (val && typeof val.path === 'string'){
            const disp = val.path.replace(/'/g,"\\\\'");
            link = '<div><a href="#" onclick="openFile(\\''+disp+'\\')">'+val.path+'</a></div>';
          }
          return '<td>'+link+'<pre>'+JSON.stringify(val, null, 2)+'</pre></td>';
        }

        return '<td>'+String(val)+'</td>';
      }).join('') + '</tr>';
    }
    html += '</table>';
    container.innerHTML = html;
  }

  // Initial render
  try{
    const planSteps = (payload && payload.plan && Array.isArray(payload.plan.steps)) ? payload.plan.steps : [];
    const execution = payload && payload.execution ? (payload.execution.steps || payload.execution) : [];
    const observation = payload && payload.observation
      ? (payload.observation.notes ? payload.observation.notes.map((n,i)=>({ id:i+1, note:n })) : [])
      : [];

    renderSmartTable('#plan-steps', planSteps);
    renderSmartTable('#execution', execution);
    renderSmartTable('#observation', observation);
    renderSummary(payload);
    renderMetrics(payload);

    const rawEl = document.getElementById('raw-json');
    if (rawEl) rawEl.textContent = JSON.stringify(payload, null, 2);

    // Wire toolbar buttons
    document.getElementById('btnExport')?.addEventListener('click', exportJson);
    document.getElementById('btnLogs')?.addEventListener('click', openLogs);
  } catch (e){
    document.body.innerHTML = '<pre style="color:red">'+String(e)+'</pre>';
  }
</script>
</body>
</html>
`;
}
