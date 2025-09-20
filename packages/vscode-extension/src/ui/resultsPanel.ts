import * as vscode from 'vscode';

export function showResultsPanel(title: string, payload: any) {
  const panel = vscode.window.createWebviewPanel(
    'strikerResults',
    title,
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(payload);

  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      if (msg?.command === 'openLogs') {
        await openLogsFile();
        return;
      }
      if (msg?.command === 'openFile' && msg?.path) {
        await openWorkspacePath(msg.path);
        return;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage(`[Striker] ${e?.message || String(e)}`);
    }
  });
}

async function openLogsFile() {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!ws) throw new Error('No workspace open');
  const logsDir = vscode.Uri.joinPath(ws, '.striker');
  const logUri = vscode.Uri.joinPath(logsDir, 'striker.log');
  try { await vscode.workspace.fs.createDirectory(logsDir); } catch {}
  try { await vscode.workspace.fs.stat(logUri); }
  catch {
    const seedText =
      `[${new Date().toISOString()}] Striker log created.\n` +
      `Tip: write agent run notes here.\n`;
    const seed = new TextEncoder().encode(seedText);
    await vscode.workspace.fs.writeFile(logUri, seed);
  }
  const doc = await vscode.workspace.openTextDocument(logUri);
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
}

async function openWorkspacePath(pathLike: string) {
  const decoded = decodeURIComponent(pathLike);
  const m = decoded.match(/([A-Za-z0-9_./-]+\.(md|ts|js))/);
  if (m) pathLike = m[1];

  if (/^([a-zA-Z]:[\\/]|\/)/.test(pathLike)) {
    const abs = vscode.Uri.file(pathLike);
    const doc = await vscode.workspace.openTextDocument(abs);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    return;
  }
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!ws) throw new Error('No workspace open');
  const uri = vscode.Uri.joinPath(ws, pathLike);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
}

function getWebviewContent(payload: any): string {
  const payloadEncoded = encodeURIComponent(JSON.stringify(payload));

  return /* html */ `
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 10px; }
    h1, h2 { margin: 0.5em 0; }
    .summary { padding: 8px; margin-bottom: 12px; border-radius: 6px; }
    .summary.ok { background: #1e4620; color: #a3e5a0; }
    .summary.warning { background: #4a3c1e; color: #f6e58d; }
    .summary.error { background: #4a1e1e; color: #ff9f9f; }
    .summary.neutral { background: #333; color: #ccc; }
    .toolbar { margin-bottom: 10px; display: flex; gap: 8px; align-items: center; }
    .toolbar input[type="text"] { flex: 1; min-width: 160px; padding: 4px 6px; border-radius: 4px; border: 1px solid #444; background: #1e1e1e; color: #ddd; }
    .toolbar button { white-space: nowrap; }
    .card { border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; margin: 10px 0; }
    .card-header { padding: 6px 10px; cursor: pointer; background: var(--vscode-editorHoverWidget-background); display:flex; justify-content:space-between; align-items:center;}
    .card-content { padding: 8px 10px; display: none; }
    .card-content.active { display: block; }
    .badge { font-size: 11px; background:#444; padding:2px 6px; border-radius: 999px; margin-left: 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 6px; }
    th, td { border: 1px solid #444; padding: 4px 6px; font-size: 12px; vertical-align: top; }
    th { background: var(--vscode-editor-inactiveSelectionBackground); }
    .error-row { background: #4a1e1e; color: #ff9f9f; }
    .warning-row { background: #4a3c1e; color: #f6e58d; }
    .metrics { margin-top: 8px; }
    .metrics span { margin-right: 6px; padding: 2px 6px; border-radius: 4px; background: #444; font-size: 11px; }
    pre { background: #111; padding: 6px; border-radius: 6px; white-space: pre-wrap; }
    em { color: #999; }
  </style>
</head>
<body>
  <h1>Striker Results</h1>

  <div id="summary" class="summary neutral">Run Summary: (calculating…)</div>

  <div class="toolbar">
    <button onclick="exportJson()">Export JSON</button>
    <button onclick="openLogs()">Open Logs</button>
    <button onclick="expandAll()">Expand All</button>
    <button onclick="collapseAll()">Collapse All</button>
    <input id="filterBox" type="text" placeholder="Filter (e.g. status:error, README.md, create_file)"/>
  </div>

  <div class="card">
    <div class="card-header" onclick="toggleCard(this)">Plan <span id="plan-count" class="badge"></span></div>
    <div class="card-content active"><div id="plan-steps">—</div></div>
  </div>

  <div class="card">
    <div class="card-header" onclick="toggleCard(this)">Execution <span id="exec-count" class="badge"></span></div>
    <div class="card-content active"><div id="execution">—</div></div>
  </div>

  <div class="card">
    <div class="card-header" onclick="toggleCard(this)">Observation</div>
    <div class="card-content active">
      <div id="observation">—</div>
      <div class="metrics" id="metrics"></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header" onclick="toggleCard(this)">Errors</div>
    <div class="card-content"><div id="errors">—</div></div>
  </div>

  <div class="card">
    <div class="card-header" onclick="toggleCard(this)">Raw JSON</div>
    <div class="card-content"><pre><code id="raw-json"></code></pre></div>
  </div>

<script>
const payload = JSON.parse(decodeURIComponent("${payloadEncoded}"));
var filterTerm = '';

function toggleCard(header) {
  const content = header.nextElementSibling;
  content.classList.toggle('active');
}

function expandAll(){
  document.querySelectorAll('.card-content').forEach(el => el.classList.add('active'));
}
function collapseAll(){
  document.querySelectorAll('.card-content').forEach(el => el.classList.remove('active'));
}

function renderSummary(payload){
  const execSteps = (payload && payload.execution && payload.execution.steps) || [];
  const errors = execSteps.filter(s => s.status === 'error').length;
  const warnings = execSteps.filter(s => s.status === 'warning').length;
  const oks = execSteps.filter(s => s.status === 'ok').length;

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
  if (box) {
    box.textContent = 'Run Summary: ' + text;
    box.className = 'summary ' + cls;
  }
}

function matchFilter(rowObj){
  if (!filterTerm) return true;
  const t = filterTerm.toLowerCase();

  // support simple "key:value" filters like "status:error"
  const kv = t.match(/^([a-z0-9_]+):(.*)$/);
  if (kv) {
    const key = kv[1]; const val = kv[2];
    const cell = rowObj && String(rowObj[key] ?? '').toLowerCase();
    return cell.includes(val);
  }

  // otherwise scan all cells
  for (const k in rowObj) {
    const v = rowObj[k];
    const s = typeof v === 'string' ? v
          : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (s.toLowerCase().includes(t)) return true;
  }
  return false;
}

function renderSmartTable(sel, rows){
  const container = document.querySelector(sel);
  if (!rows || rows.length === 0) {
    container.innerHTML = '<em>No data</em>';
    return;
  }

  const filtered = rows.filter(matchFilter);
  const cols = Object.keys(filtered[0] || rows[0] || {});
  let html = '<table><tr>' + cols.map(c=>'<th>'+c+'</th>').join('') + '</tr>';

  const fileRe = /([A-Za-z0-9_./-]+\\.(md|ts|js))/g;

  for (const r of filtered){
    const cls = r.status==='error'?'error-row':(r.status==='warning'?'warning-row':'');
    html += '<tr class="'+cls+'">' + cols.map(c=>{
      const val = r[c];

      if (typeof val === 'string') {
        if (/^([A-Za-z0-9_./-]+\\.(md|ts|js))$/.test(val)) {
          return '<td><a href="#" onclick="openFile(\\''+val+'\\')">'+val+'</a></td>';
        }
        const linked = val.replace(fileRe, '<a href="#" onclick="openFile(\\'$1\\')">$1</a>');
        return '<td>'+linked+'</td>';
      }

      if (Array.isArray(val)) {
        return '<td><pre>'+val.map(v => typeof v === 'string' ? v : JSON.stringify(v, null, 2)).join('\\n')+'</pre></td>';
      }

      if (typeof val === 'object' && val !== null) {
        return '<td><pre>'+JSON.stringify(val, null, 2)+'</pre></td>';
      }

      return '<td>'+ (val!==undefined?String(val):'') +'</td>';
    }).join('') + '</tr>';
  }
  html += '</table>';
  container.innerHTML = html;
}

function renderErrors(payload){
  const errors = [];
  if (payload.execution && Array.isArray(payload.execution.errors)) errors.push(...payload.execution.errors);
  if (payload.observation && Array.isArray(payload.observation.errors)) errors.push(...payload.observation.errors);
  const container = document.getElementById('errors');
  if (!errors.length){ container.innerHTML = '<em>No errors</em>'; return; }
  container.innerHTML = '<ul>'+errors.map(e=>'<li>'+ (e.message||e) +'</li>').join('')+'</ul>';
}

function renderMetrics(payload){
  const metrics = payload.observation && payload.observation.metrics;
  const container = document.getElementById('metrics');
  if (!metrics){ container.innerHTML = ''; return; }
  container.innerHTML = Object.keys(metrics).map(k=>'<span>'+k+': '+metrics[k]+'</span>').join('');
}

function exportJson(){
  const text = JSON.stringify(payload,null,2);
  const blob = new Blob([text], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'striker-results.json'; a.click();
  URL.revokeObjectURL(url);
}

function openLogs(){
  const vscodeApi = acquireVsCodeApi();
  vscodeApi.postMessage({ command:'openLogs' });
}

function openFile(path){
  const vscodeApi = acquireVsCodeApi();
  vscodeApi.postMessage({ command:'openFile', path });
}

function updateCounts(){
  const planRows = (payload && payload.plan && payload.plan.steps) || [];
  const execRows = (payload && payload.execution && payload.execution.steps) || [];
  const planCnt = document.getElementById('plan-count');
  const execCnt = document.getElementById('exec-count');
  if (planCnt) planCnt.textContent = planRows.filter(matchFilter).length + '/' + planRows.length;
  if (execCnt) execCnt.textContent = execRows.filter(matchFilter).length + '/' + execRows.length;
}

// Initial render
try{
  const planSteps = (payload && payload.plan && Array.isArray(payload.plan.steps)) ? payload.plan.steps : [];
  const execution = payload && payload.execution ? (payload.execution.steps || payload.execution) : [];
  const observation = payload && payload.observation ? (payload.observation.notes||[]) : [];

  renderSmartTable('#plan-steps', planSteps);
  renderSmartTable('#execution', execution);
  renderSmartTable('#observation', observation.map((n,i)=>({id:i+1,note:n})));
  renderErrors(payload);
  renderMetrics(payload);
  renderSummary(payload);
  updateCounts();

  document.getElementById('raw-json').textContent = JSON.stringify(payload,null,2);

  // Wire filter
  const box = document.getElementById('filterBox');
  if (box) {
    box.addEventListener('input', (e)=>{
      filterTerm = (e.target && e.target.value) ? String(e.target.value) : '';
      renderSmartTable('#plan-steps', planSteps);
      renderSmartTable('#execution', execution);
      renderSmartTable('#observation', observation.map((n,i)=>({id:i+1,note:n})));
      updateCounts();
    });
  }
}catch(e){
  document.body.innerHTML = '<pre style="color:red">ReferenceError: '+e+'</pre>';
}
</script>
</body>
</html>
  `;
}
