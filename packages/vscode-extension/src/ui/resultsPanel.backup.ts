// packages/vscode-extension/src/ui/resultsPanel.ts
import * as vscode from 'vscode';

export function renderResultsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src data:; style-src 'unsafe-inline';
                 script-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Striker Results</title>
  <style>
    :root{
      --fg: var(--vscode-foreground);
      --bg: var(--vscode-editor-background);
      --muted: var(--vscode-editor-inactiveSelectionBackground);
      --border: var(--vscode-panel-border);
    }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    h2 { margin: 16px 12px 4px; }
    .summary { margin: 0 12px 8px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px;
             background: #294b29; color: #b7ffb7; font-weight: 600; }
    .toolbar { margin: 0 12px 8px; display: flex; gap: 8px; }
    button { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border);
             background: var(--muted); color: var(--fg); cursor: pointer; }
    .section { margin: 10px 12px; border: 1px solid var(--border); border-radius: 8px; }
    .section > summary.hd { background: var(--muted); padding: 8px 10px; font-weight: 600; list-style: none; cursor: pointer; }
    .section[open] > summary.hd { border-bottom: 1px solid var(--border); }
    .section > summary.hd::-webkit-details-marker { display: none; }
    .section > summary.hd::before { content: '▸ '; display: inline-block; transform: rotate(90deg); transition: transform .15s ease; }
    .section:not([open]) > summary.hd::before { transform: rotate(0deg); }
    .pad { padding: 10px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { text-align: left; font-weight: 600; border-bottom: 1px solid var(--border); padding: 6px 8px; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid rgba(127,127,127,0.12); vertical-align: top; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    /* status coloring */
    tr.ok .col-status { color: #58a85a; font-weight: 600; }
    tr.fail .col-status { color: #d46a6a; font-weight: 600; }
    tr.running .col-status { opacity: 0.85; font-style: italic; }

    /* detail collapsers */
    details > summary { cursor: pointer; opacity: 0.95; }
    details > pre { margin: 8px 0 0; max-height: 320px; overflow: auto; }
    .detail-preview { margin: 8px 0 0; max-height: 220px; overflow: auto; }
    .detail-pre { max-height: 320px; overflow: auto; }

    a { text-decoration: underline; }
  </style>
</head>
<body>
  <h2>Striker Results</h2>

  <div class="summary"><span class="badge" id="run-summary">Run Summary: <strong>0 ok</strong></span></div>

  <div class="toolbar">
    <button id="btn-export">Export JSON</button>
    <button id="btn-logs">Open Logs</button>
  </div>

  <!-- Plan -->
  <details class="section" open>
    <summary class="hd">Plan</summary>
    <div class="pad">
      <table>
        <thead>
          <tr>
            <th>id</th><th>title</th><th>intent</th><th>inputs</th><th>rollbackHint</th>
          </tr>
        </thead>
        <tbody id="plan-body"></tbody>
      </table>
    </div>
  </details>

  <!-- Execution -->
  <details class="section" open>
    <summary class="hd">Execution</summary>
    <div class="pad">
      <table id="execution-table">
        <thead>
          <tr>
            <th>id</th><th>title</th><th>intent</th><th>path</th><th>status</th><th>stepId</th><th>detail/diff</th>
          </tr>
        </thead>
        <tbody id="exec-body"></tbody>
      </table>
    </div>
  </details>

  <!-- Observation -->
  <details class="section" open>
    <summary class="hd">Observation</summary>
    <div class="pad">
      <table>
        <thead><tr><th>id</th><th>note</th></tr></thead>
        <tbody id="obs-body"></tbody>
      </table>
      <div class="mono" id="metrics"></div>
    </div>
  </details>

  <!-- Raw JSON -->
  <details class="section" open>
    <summary class="hd">Raw JSON</summary>
    <pre class="pad mono" id="raw-json"></pre>
  </details>

  <script>
    var vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;
    function byId(id) { return document.getElementById(id); }

    byId('plan-body').innerHTML = '';
    byId('exec-body').innerHTML = '';
    byId('obs-body').innerHTML = '';
    byId('metrics').textContent = '';

    function updateSummaryOkCount(delta) {
      var el = byId('run-summary');
      if (!el) return;
      var m = el.textContent.match(/(\\d+)/);
      var n = m ? parseInt(m[1], 10) : 0;
      el.innerHTML = 'Run Summary: <strong>' + (n + delta) + ' ok</strong>';
    }

    // Turn "file.ts:12:3" text segments into clickable links that ask the extension to open the file.
    function makeFileLinks(root) {
      var re = /([^\\s:]+?\\.[A-Za-z0-9_]+):(\\d+):(\\d+)/g;
      function linkifyTextNode(node) {
        var text = node.nodeValue || '';
        var parent = node.parentNode;
        var lastIndex = 0;
        var m;
        while ((m = re.exec(text)) !== null) {
          if (m.index > lastIndex) parent.insertBefore(document.createTextNode(text.slice(lastIndex, m.index)), node);
          var a = document.createElement('a');
          a.href = '#';
          a.textContent = m[0];
          (function(target) {
            a.addEventListener('click', function () {
              if (vscode) vscode.postMessage({ type: 'open-file', target: target });
            });
          })(m[0]);
          parent.insertBefore(a, node);
          lastIndex = m.index + m[0].length;
        }
        if (lastIndex < text.length) parent.insertBefore(document.createTextNode(text.slice(lastIndex)), node);
        parent.removeChild(node);
      }
      function walk(n) {
        if (!n) return;
        if (n.nodeType === Node.TEXT_NODE) {
          re.lastIndex = 0;
          if (re.test(n.nodeValue || '')) { re.lastIndex = 0; linkifyTextNode(n); }
          return;
        }
        var c = n.firstChild;
        while (c) { var next = c.nextSibling; walk(c); c = next; }
      }
      walk(root);
    }

    // Stream-friendly Execution row with compact columns and collapsible detail
    function appendExecRow(r) {
      var tbody = byId('exec-body'); if (!tbody) return;

      // ---- helpers (scoped) ----
      function cleanIntent(v){ if (v==null || v==='' || v==='noop') return '-'; return String(v); }
      function humanTitle(v,fallback){
        var s=(v&&String(v).trim())?String(v).trim():(fallback||'');
        if(!s) return '-'; s=s.replace(/[_-]+/g,' '); return s.charAt(0).toUpperCase()+s.slice(1);
      }
      function statusText(r){
        if (r.status) return String(r.status);
        if (r.ok===true) return 'ok';
        if (r.ok===false) return 'error';
        return 'running';
      }
      function clsForRow(r){
        if (r.ok===true) return 'ok';
        if (r.ok===false) return 'fail';
        return 'running';
      }
      function keyForRow(r){
        if (r && r.id) return 'exec-'+String(r.id);
        if (r && r.stepId) return 'exec-'+String(r.stepId);
        var base = (r && (r.title||r.step||'')) + '::' + (r && (r.intent||'')); 
        return 'exec-'+encodeURIComponent(base||Math.random().toString(36).slice(2));
      }
      function needsCollapse(s){
        if (s==null) return false;
        var text=String(s);
        var lines=text.split(/\\r?\\n/);
        return (lines.length>8 || text.length>240);
      }
      function renderDetail(detail){
        if (detail==null || detail==='') return document.createTextNode('-');
        var text=String(detail);
        if (!needsCollapse(text)) {
          var pre=document.createElement('pre'); pre.className='mono detail-preview'; pre.textContent=text; return pre;
        }
        var lines=text.split(/\\r?\\n/);
        var previewLines=lines.slice(0,8).join('\\n');
        if (previewLines.length>240) previewLines = previewLines.slice(0,240)+'…';
        var wrap=document.createElement('div');
        var details=document.createElement('details');
        var summary=document.createElement('summary'); summary.textContent='show more…';
        var preFull=document.createElement('pre'); preFull.className='mono detail-pre'; preFull.textContent=text;
        details.appendChild(summary); details.appendChild(preFull);
        var prePreview=document.createElement('pre'); prePreview.className='mono detail-preview'; prePreview.textContent=previewLines + '\\n…';
        wrap.appendChild(details); wrap.appendChild(prePreview);
        return wrap;
      }
      function td(clsName, content){
        var d=document.createElement('td'); if(clsName) d.className=clsName;
        if (content instanceof Node) d.appendChild(content);
        else d.textContent=(content==null || content==='')?'-':String(content);
        return d;
      }

      // ---- compute short fields ----
      var rowId = keyForRow(r);
      var title = humanTitle(r.title, r.stepId || r.step || '');
      var intent = cleanIntent(r.intent);
      var path = (r.path&&String(r.path).trim())?r.path:'-'; // keep column, short content
      var status = statusText(r);
      var stepId = r.stepId || '-';

      // ---- find or create row (stream-update friendly) ----
      var tr = document.getElementById(rowId);
      if (!tr) {
        tr = document.createElement('tr');
        tr.id = rowId;
        tr.className = clsForRow(r);
        tr.appendChild(td('col-id', r.id || '-'));
        tr.appendChild(td('col-title', title));
        tr.appendChild(td('col-intent', intent));
        tr.appendChild(td('col-path', path));
        tr.appendChild(td('col-status', status));
        tr.appendChild(td('col-stepId', stepId));
        tr.appendChild(td('col-detail', renderDetail(r.detail)));
        tbody.appendChild(tr);
        makeFileLinks(tr);
        if (r.ok === true) updateSummaryOkCount(1);
        return;
      }

      // ---- update existing row in place ----
      tr.className = clsForRow(r);
      var cells = {
        id: tr.querySelector('td.col-id'),
        title: tr.querySelector('td.col-title'),
        intent: tr.querySelector('td.col-intent'),
        path: tr.querySelector('td.col-path'),
        status: tr.querySelector('td.col-status'),
        stepId: tr.querySelector('td.col-stepId'),
        detail: tr.querySelector('td.col-detail')
      };
      if (cells.title) cells.title.textContent = title;
      if (cells.intent) cells.intent.textContent = intent;
      if (cells.path) cells.path.textContent = path;
      if (cells.status) cells.status.textContent = status;
      if (cells.stepId) cells.stepId.textContent = stepId;
      if (cells.detail) { cells.detail.innerHTML = ''; cells.detail.appendChild(renderDetail(r.detail)); makeFileLinks(cells.detail); }
    }

    // Message handling from extension
    window.addEventListener('message', function (ev) {
      var msg = ev.data; if (!msg) return;

      if (msg.type === 'append-exec' && msg.row) { appendExecRow(msg.row); return; }

      if (msg.type === 'final-payload' && msg.payload) {
        try {
          var payload = msg.payload;

          // Plan
          var planBody = byId('plan-body'); planBody.innerHTML = '';
          if (payload.plan && Array.isArray(payload.plan.steps)) {
            for (var i = 0; i < payload.plan.steps.length; i++) {
              var s = payload.plan.steps[i], tr = document.createElement('tr');
              var id = '', title = '', intent = '', inputs = '', rollback = '';
              if (typeof s === 'string') { id=String(i+1); title=s; intent='-'; inputs='-'; rollback='N/A'; }
              else if (s && typeof s === 'object') {
                id=String(s.id || i+1); title=s.title || s.step || '-'; intent=s.intent || '-';
                inputs = s.inputs ? JSON.stringify(s.inputs) : (payload.plan.inputs ? JSON.stringify(payload.plan.inputs) : '-');
                rollback = s.rollbackHint || 'N/A';
              } else { id=String(i+1); title='-'; intent='-'; inputs='-'; rollback='N/A'; }
              var td1=document.createElement('td'); td1.textContent=id;
              var td2=document.createElement('td'); td2.textContent=title;
              var td3=document.createElement('td'); td3.textContent=intent || '-';
              var td4=document.createElement('td'); td4.textContent=inputs || '-';
              var td5=document.createElement('td'); td5.textContent=rollback || 'N/A';
              tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5);
              planBody.appendChild(tr);
            }
          }

          // Observation (notes + duration)
          var obsBody = byId('obs-body'); obsBody.innerHTML = '';
          if (payload.observation && payload.observation.notes) {
            for (var j = 0; j < payload.observation.notes.length; j++) {
              var tro = document.createElement('tr');
              var o1 = document.createElement('td'); o1.textContent = String(j + 1);
              var o2 = document.createElement('td'); o2.textContent = String(payload.observation.notes[j] || '');
              tro.appendChild(o1); tro.appendChild(o2); obsBody.appendChild(tro);
            }
            var metrics = byId('metrics');
            if (payload.observation.metrics && typeof payload.observation.metrics.duration_ms === 'number') {
              metrics.textContent = 'duration_ms: ' + String(payload.observation.metrics.duration_ms);
            } else { metrics.textContent = ''; }
          }

          // Raw JSON (always fill and open once)
          var raw = byId('raw-json');
          if (raw) {
            raw.textContent = JSON.stringify(msg.payload || payload || {}, null, 2);
            var rawSection = raw.closest('details');
            if (rawSection && !rawSection.hasAttribute('open')) rawSection.setAttribute('open', '');
          }
        } catch (e) {}
        return;
      }
    });

    // Buttons → extension
    var btnExport = byId('btn-export');
    if (btnExport) btnExport.addEventListener('click', function () {
      if (vscode) vscode.postMessage({ type: 'export-json' });
    });
    var btnLogs = byId('btn-logs');
    if (btnLogs) btnLogs.addEventListener('click', function () {
      if (vscode) vscode.postMessage({ type: 'open-logs' });
    });
  </script>
</body>
</html>`;
}

const GLOBAL_PANEL_KEY = '__striker_results_panel__';

export function acquireOrCreateResultsPanel(title: string = 'Striker Results'): vscode.WebviewPanel {
  const existing = (globalThis as any)[GLOBAL_PANEL_KEY] as vscode.WebviewPanel | undefined;
  if (existing) { try { existing.reveal(vscode.ViewColumn.Beside); return existing; } catch {} }
  const panel = vscode.window.createWebviewPanel(
    'strikerResults',
    title,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );
  (globalThis as any)[GLOBAL_PANEL_KEY] = panel;
  return panel;
}

export function showResultsPanel(title: string, payload: any) {
  const panel = acquireOrCreateResultsPanel(title);
  panel.webview.html = renderResultsHtml();
  if (payload) { try { panel.webview.postMessage({ type: 'final-payload', payload }); } catch {} }
}
