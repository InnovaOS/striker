// timestamp code 16500610
// packages/vscode-extension/src/ui/resultsPanel.ts
import * as vscode from 'vscode';
import { ExecRow, ResultsMessage, ResultsPayload /*, ToolbarMessage*/ } from '../types';

export function renderResultsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Striker Results</title>
  <style>
    :root{
      --fg: var(--vscode-foreground);
      --bg: var(--vscode-editor-background);
      --muted: var(--vscode-editor-inactiveSelectionBackground);
      --mutedStrong: var(--vscode-editor-selectionBackground);
      --border: var(--vscode-panel-border);
      --btn: var(--vscode-button-background);
      --btnFg: var(--vscode-button-foreground);
      --btnHover: var(--vscode-button-hoverBackground);
      --chipActiveBg: var(--vscode-inputOption-activeBackground);
      --chipActiveFg: var(--vscode-inputOption-activeForeground);
      --chipActiveBorder: var(--vscode-inputOption-activeBorder);
      --linkFg: var(--vscode-textLink-foreground);
    }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    h2 { margin: 16px 12px 4px; }
    .summary { margin: 0 12px 8px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;}
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px;
             background: #294b29; color: #b7ffb7; font-weight: 600; }
    .toolbar { margin: 0 12px 12px; display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border);
             background: var(--muted); color: var(--fg); cursor: pointer; }
    button.primary { background: var(--btn); color: var(--btnFg); border-color: transparent; }
    button.primary:hover { background: var(--btnHover); }
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
    tr.running .col-status { opacity: 0.95; font-style: italic; }

    /* detail collapsers */
    details > summary { cursor: pointer; opacity: 0.95; }
    details > pre { margin: 8px 0 0; max-height: 320px; overflow: auto; }
    .detail-preview { margin: 8px 0 0; max-height: 220px; overflow: auto; white-space: pre-wrap; }
    .detail-pre { max-height: 320px; overflow: auto; white-space: pre; }

    a { text-decoration: underline; color: var(--linkFg); }

    /* Controls row */
    .controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom: 0; }
    #exec-pad .controls { padding-bottom: 10px; border-bottom: 1px solid var(--border); }
    .filters { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .filters button { padding: 4px 10px; border-radius: 999px; border:1px solid var(--border); background: transparent; }
    .filters button.active {
      background: var(--chipActiveBg, var(--btn));
      color: var(--chipActiveFg, var(--btnFg));
      border-color: var(--chipActiveBorder, transparent);
    }
    .filters .count { opacity: .85; font-size: 12px; padding-left: 4px; }
    .spacer { flex: 1 1 auto; min-width: 8px; }
    .toggle { display:flex; align-items:center; gap:6px; font-size: 12.5px; opacity:.95; }
    .toggle input { vertical-align: middle; }

    /* ensure gap after controls before table */
    #execution-table { margin-top: 10px; }

    .legend { display:flex; gap:10px; align-items:center; font-size: 12px; opacity:.85;}
    .legend .dot { display:inline-flex; align-items:center; gap:4px; }

    /* Observation polish */
    .subhd { margin: 8px 0 4px; font-weight: 600; opacity: .95; }
    .muted { opacity: .75; }
    .kv { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .kv td { padding: 4px 6px; border-bottom: 1px dashed rgba(127,127,127,0.18); }
    .kv td.k { width: 200px; opacity: .9; }
    .note-list { margin: 0; padding-left: 18px; }
  </style>
</head>
<body>
  <h2>Striker Results</h2>

  <div class="summary">
    <span class="badge" id="run-summary">Run Summary: <strong>0 ok</strong></span>
    <div class="legend" aria-hidden="true">
      <span class="dot">⏳ running</span>
      <span class="dot">✅ ok</span>
      <span class="dot">⚠ error</span>
    </div>
  </div>

  <div class="toolbar">
    <button id="btn-export" class="primary" onclick="window._exportJSON()">Export JSON</button>
    <button id="btn-copy"   onclick="window._copyJSON()">Copy JSON</button>
    <button id="btn-logs"   onclick="window._openLogs()">Open Logs</button>
    <button id="btn-replay" onclick="window._replaySample()">Replay Sample</button>
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
  <details class="section" open id="execution-section">
    <summary class="hd">Execution</summary>
    <div class="pad" id="exec-pad">
      <div class="controls" role="toolbar" aria-label="Execution controls">
        <div class="filters" aria-label="Filters">
          <button id="flt-all"     class="active" onclick="window._setFilter('all')">All <span id="cnt-all" class="count">(0)</span></button>
          <button id="flt-running" onclick="window._setFilter('running')">Running <span id="cnt-running" class="count">(0)</span></button>
          <button id="flt-ok"      onclick="window._setFilter('ok')">OK <span id="cnt-ok" class="count">(0)</span></button>
          <button id="flt-error"   onclick="window._setFilter('error')">Error <span id="cnt-error" class="count">(0)</span></button>
        </div>
        <div class="spacer"></div>
        <label class="toggle" title="If enabled, the view will follow new rows while streaming.">
          <input id="follow-toggle" type="checkbox" checked onchange="window._toggleFollow(this.checked)" />
          <span>Follow new rows</span>
        </label>
      </div>

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
      <div id="obs-notes-block"></div>
      <div id="obs-metrics-block"></div>
      <div id="obs-empty" class="muted" style="display:none;">No observations.</div>
    </div>
  </details>

  <!-- Raw JSON -->
  <details class="section" open>
    <summary class="hd">Raw JSON</summary>
    <pre class="pad mono" id="raw-json"></pre>
  </details>

  <script>
    // ---- VS Code webview API + state helpers ----
    var vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;
    function saveState(patch) {
      try {
        var prev = (vscode && vscode.getState && vscode.getState()) || {};
        var next = Object.assign({}, prev || {}, patch || {});
        if (vscode && vscode.setState) vscode.setState(next);
      } catch {}
    }
    function loadState() {
      try { return (vscode && vscode.getState && vscode.getState()) || {}; } catch { return {}; }
    }

    function byId(id) { return document.getElementById(id); }

    // ---- Summary helpers ----
    function setRunSummary(n){ byId('run-summary').innerHTML = 'Run Summary: <strong>' + n + ' ok</strong>'; }
    function computeOkCount(){
      var rows = byId('exec-body').querySelectorAll('tr.ok');
      return rows ? rows.length : 0;
    }

    // ---- Counts on chips ----
    function refreshCounts(){
      var body = byId('exec-body');
      var all = body.querySelectorAll('tr').length;
      var running = body.querySelectorAll('tr.running').length;
      var ok = body.querySelectorAll('tr.ok').length;
      var fail = body.querySelectorAll('tr.fail').length;
      byId('cnt-all').textContent = '(' + all + ')';
      byId('cnt-running').textContent = '(' + running + ')';
      byId('cnt-ok').textContent = '(' + ok + ')';
      byId('cnt-error').textContent = '(' + fail + ')';
    }

    // ---- Reset view ----
    function resetResultsUI(){
      byId('plan-body').innerHTML = '';
      byId('exec-body').innerHTML = '';

      byId('obs-notes-block').innerHTML = '';
      byId('obs-metrics-block').innerHTML = '';
      byId('obs-empty').style.display = 'none';

      setRunSummary(0);
      var raw = byId('raw-json'); if (raw) raw.textContent = '';

      var st = loadState();
      var flt = st.filter || 'all';
      window._setFilter(flt, true);
      var follow = (st.follow !== false);
      var chk = byId('follow-toggle'); if (chk) chk.checked = !!follow;
      __followNewRows = !!follow;
      refreshCounts();
    }

    // ---- Smart auto-scroll w/ toggle ----
    var __followNewRows = true;
    function isNearBottom(px){
      px = (typeof px === 'number') ? px : 120;
      var scrollY = window.scrollY || window.pageYOffset || 0;
      var wh = window.innerHeight || document.documentElement.clientHeight || 0;
      var dh = document.body.scrollHeight || 0;
      return (scrollY + wh) >= (dh - px);
    }
    function scrollRowIntoViewIfNeeded(tr){
      if (!tr || !__followNewRows) return;
      if (isNearBottom(140)) {
        try { tr.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch {}
      }
    }
    window._toggleFollow = function (checked) {
      __followNewRows = !!checked;
      saveState({ follow: __followNewRows });
    };

    // ---- Toolbar actions ----
    function _currentPayload() {
      try {
        if (window.__lastPayload) return window.__lastPayload;
        var el = byId('raw-json');
        var text = el && el.textContent ? el.textContent : '';
        return text.trim() ? JSON.parse(text) : { version: 1, plan: { steps: [] } };
      } catch (e) {
        return { version: 1, plan: { steps: [] } };
      }
    }
    window._exportJSON = function () { if (vscode) vscode.postMessage({ type: 'export-json', payload: _currentPayload() }); };
    window._copyJSON   = function () { if (vscode) vscode.postMessage({ type: 'copy-json',   payload: _currentPayload() }); };
    window._openLogs   = function () { if (vscode) vscode.postMessage({ type: 'open-logs'   }); };

    window._replaySample = function () {
      resetResultsUI();

      // Plan
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>analyze-prompt</td><td>Analyze Prompt</td><td>analyze</td><td>-</td><td>N/A</td>';
      byId('plan-body').appendChild(tr);

      // Execution (simulate streaming)
      appendExecRow({ id:'analyze-prompt', title:'Analyze Prompt', intent:'analyze', ok:true, detail:'scan workspace and summarize' });
      appendExecRow({ id:'simulate-action', title:'Simulate Action', intent:'dry_run', ok:true, detail:'Would write file: demo1.txt\\n--- preview ---\\n+ Hello Striker!\\n' });
      appendExecRow({ id:'write-demo1', title:'Write File', intent:'create_file', ok:true, detail:'demo1.txt:1:1' });

      setRunSummary(computeOkCount());

      // Sample Observation
      renderObservation({
        notes: ['all steps executed successfully', 'no errors'],
        metrics: { duration_ms: 650, files_touched: 1 }
      });

      // Raw JSON sample
      var raw = byId('raw-json');
      var sample = {
        version: 1,
        plan: { steps: [
          { id:'analyze-prompt', title:'Analyze Prompt', intent:'analyze', inputs:{ prompt:'...' }, rollbackHint:'N/A' },
          { id:'simulate-action', title:'Simulate Action', intent:'dry_run', inputs:{ file:'demo1.txt' }, rollbackHint:'Revert changes' },
          { id:'write-demo1', title:'Write File', intent:'create_file', inputs:{ path:'demo1.txt' } }
        ] },
        observation: {
          notes: ['all steps executed successfully', 'no errors'],
          metrics: { duration_ms: 650, files_touched: 1 }
        }
      };
      window.__lastPayload = sample;
      if (raw) raw.textContent = JSON.stringify(sample, null, 2);

    };

    // ---- Filter logic + persistence ----
    var __activeFilter = 'all';
    function applyFilterToRow(tr) {
      if (!tr) return;
      if (__activeFilter === 'all') { tr.style.display = ''; return; }
      var cls = tr.classList;
      var match =
        (__activeFilter === 'running' && cls.contains('running')) ||
        (__activeFilter === 'ok'      && cls.contains('ok')) ||
        (__activeFilter === 'error'   && cls.contains('fail'));
      tr.style.display = match ? '' : 'none';
    }
    function refreshFilter() {
      var rows = byId('exec-body').querySelectorAll('tr');
      for (var i=0;i<rows.length;i++) applyFilterToRow(rows[i]);
    }
    function setActiveFilterButton(which) {
      var ids = ['flt-all','flt-running','flt-ok','flt-error'];
      for (var i=0;i<ids.length;i++) {
        var b = byId(ids[i]); if (!b) continue;
        b.classList.remove('active');
      }
      var map = { all:'flt-all', running:'flt-running', ok:'flt-ok', error:'flt-error' };
      var tgt = byId(map[which]); if (tgt) tgt.classList.add('active');
    }
    window._setFilter = function(which, silent){
      __activeFilter = which || 'all';
      setActiveFilterButton(__activeFilter);
      if (!silent) { saveState({ filter: __activeFilter }); refreshFilter(); }
    };

    // ---- Linkifier: "file.ts:12:3" -> clickable (safe DOM traversal) ----
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

    // ---- Exec row helpers ----
    function sigFor(r) {
      var t = (r.title || r.step || '').toString().trim().toLowerCase().replace(/\\s+/g,' ');
      var i = (r.intent || '').toString().trim().toLowerCase();
      return t + '::' + i;
    }
    function keyForRow(r, index) {
      var sig = sigFor(r);
      if (!window.__execKeys) window.__execKeys = Object.create(null);
      if (window.__execKeys[sig]) return window.__execKeys[sig];
      var domKey =
        (r && r.stepId) ? ('exec-' + String(r.stepId)) :
        (r && r.id)     ? ('exec-' + String(r.id)) :
        'exec-' + encodeURIComponent((r.title||r.step||'') + '::' + (r.intent||'') + '::' + (index||0));
      window.__execKeys[sig] = domKey;
      return domKey;
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
    function statusIcon(status){
      var s = (status||'').toLowerCase();
      if (s==='ok') return '✅';
      if (s==='error') return '⚠';
      return '⏳';
    }

    // ---- Execution row ----
    function appendExecRow(r) {
      var tbody = byId('exec-body'); if (!tbody) return;

      function cleanIntent(v){ if (v==null || v==='' || v==='noop') return '-'; return String(v); }
      function humanTitle(v,fallback){
        var s=(v&&String(v).trim())?String(v).trim():(fallback||'');
        if(!s) return '-'; s=s.replace(/[_-]+/g,' '); return s.charAt(0).toUpperCase()+s.slice(1);
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

      var rowId = keyForRow(r);
      var title = humanTitle(r.title, r.stepId || r.step || '');
      var intent = cleanIntent(r.intent);
      var path = (r.path&&String(r.path).trim())?r.path:'-';
      var status = statusText(r);
      var stepId = r.stepId || '-';

      var tr = document.getElementById(rowId);
      var isNew = false;

      if (!tr) {
        isNew = true;
        tr = document.createElement('tr');
        tr.id = rowId;
        tr.className = clsForRow(r);
        tr.appendChild(td('col-id', r.id || r.stepId || '-'));
        tr.appendChild(td('col-title', title));
        tr.appendChild(td('col-intent', intent));
        tr.appendChild(td('col-path', path));
        var statusCell = document.createElement('td'); statusCell.className='col-status';
        statusCell.textContent = statusIcon(status) + ' ' + status;
        tr.appendChild(statusCell);
        tr.appendChild(td('col-stepId', stepId));
        tr.appendChild(td('col-detail', renderDetail(r.detail)));
        byId('exec-body').appendChild(tr);
        makeFileLinks(tr);
        if (r.ok === true) setRunSummary(computeOkCount() + 1);
        applyFilterToRow(tr);
      } else {
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
        if (cells.status) cells.status.textContent = statusIcon(status) + ' ' + status;
        if (cells.stepId) cells.stepId.textContent = stepId;
        if (cells.id && r.stepId && (cells.id.textContent === '0' || cells.id.textContent === '-' || !cells.id.textContent)) {
          cells.id.textContent = r.stepId;
        }
        if (cells.detail) { cells.detail.innerHTML = ''; cells.detail.appendChild(renderDetail(r.detail)); makeFileLinks(cells.detail); }
        applyFilterToRow(tr);
      }

      refreshCounts();
      if (isNew) scrollRowIntoViewIfNeeded(tr);
    }

    // ---- Observation UI helpers ----
    function formatMetricKey(k) {
      return String(k).replace(/[_-]+/g, ' ');
    }
    function formatMetricVal(k, v) {
      if (k === 'duration_ms' && typeof v === 'number') return v + ' ms';
      return String(v);
    }
    function renderMetricsTable(metrics) {
      if (!metrics || typeof metrics !== 'object') return '';
      var keys = Object.keys(metrics);
      if (!keys.length) return '';
      var rows = '';
      for (var i=0;i<keys.length;i++) {
        var k = keys[i], v = metrics[k];
        rows += '<tr><td class="k">' + formatMetricKey(k) + '</td><td>' + formatMetricVal(k, v) + '</td></tr>';
      }
      return '<div class="subhd">Metrics</div><table class="kv">' + rows + '</table>';
    }
    function renderNotesTable(notes) {
      if (!Array.isArray(notes) || notes.length === 0) return '';
      var rows = '';
      for (var j=0;j<notes.length;j++) {
        rows += '<tr><td>' + (j+1) + '</td><td>' + String(notes[j] || '') + '</td></tr>';
      }
      return '<div class="subhd">Notes</div><table><thead><tr><th>id</th><th>note</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    function renderObservation(observation) {
      var notesHTML = renderNotesTable(observation && observation.notes);
      var metricsHTML = renderMetricsTable(observation && observation.metrics);

      byId('obs-notes-block').innerHTML = notesHTML;
      byId('obs-metrics-block').innerHTML = metricsHTML;

      var empty = !notesHTML && !metricsHTML;
      byId('obs-empty').style.display = empty ? 'block' : 'none';
    }

    // ---- Message handling from extension ----
    window.addEventListener('message', function (ev) {
      var msg = ev.data; if (!msg) return;
      // --- NEW: core-agent unified events bridge ---
      if (msg.type === 'AGENT_RESULT' && msg.payload) {
        var evt = msg.payload;

        // 1) Plan tab
        if (evt.type === 'planGenerated') {
          var planBody = byId('plan-body'); 
          planBody.innerHTML = '';
          var steps = Array.isArray(evt.plan) ? evt.plan : [];
          for (var i = 0; i < steps.length; i++) {
            var s = steps[i], tr = document.createElement('tr');
            var id = String(s.id || i + 1);
            var title = s.title || s.step || '-';
            var intent = s.intent || '-';
            var inputs = s.inputs ? JSON.stringify(s.inputs) : '-';
            var rollback = s.rollbackHint || 'N/A';

            var td1=document.createElement('td'); td1.textContent=id;
            var td2=document.createElement('td'); td2.textContent=title;
            var td3=document.createElement('td'); td3.textContent=intent;
            var td4=document.createElement('td'); td4.textContent=inputs;
            var td5=document.createElement('td'); td5.textContent=rollback;
            tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5);
            planBody.appendChild(tr);
          }
          refreshCounts(); 
          return;
        }

        // 2) Execution rows
        if (evt.type === 'executionEvent') {
          var e = evt.event || {};
          appendExecRow({
            id: e.id || '',
            title: e.title || e.step || '-',
            intent: e.tool || e.intent || '-',
            path: e.path || '-',
            ok: !!e.ok,
            detail: e.detail || e.output || e.error || e.message || ''
          });
          refreshCounts();
          setRunSummary(computeOkCount());
          return;
        }

        // 3) Safety (optional hook)
        if (evt.type === 'safetyFinding') {
          // TODO: render safety diagnostics if you have a UI section
          // console.log('Safety findings:', evt.findings);
          return;
        }

        // 4) Observation summary
        if (evt.type === 'observationComplete') {
          renderObservation(evt.observation || {});
          refreshCounts();
          setRunSummary(computeOkCount());
          return;
        }
      }

      if (msg.type === 'append-exec' && msg.row) { appendExecRow(msg.row); return; }

      if (msg.type === 'final-payload' && msg.payload) {
        try {
          var payload = msg.payload;
          window.__lastPayload = payload;

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

          // Execution (backfill or synthesize)

          var execBody = byId('exec-body'); 
          execBody.innerHTML = '';

          // 2) Normalize execution: support either {steps: [...]} or a plain array
          var execSteps = Array.isArray(payload.execution && payload.execution.steps)
            ? payload.execution.steps
            : Array.isArray(payload.execution)
              ? payload.execution
              : [];

          // 3) If missing, synthesize rows from plan.steps
          if (!execSteps.length && payload.plan && Array.isArray(payload.plan.steps)) {
            // Heuristic: if there are no errors reported, consider the run "ok"
            var allOk = true;
            try {
              allOk = !((payload.execution && payload.execution.errors && payload.execution.errors.length) ||
                        (payload.errors && payload.errors.length));
            } catch {}
            execSteps = payload.plan.steps.map(function(step, idx){
              var obj = (step && typeof step === 'object') ? step : { title: String(step || '-') };
              return {
                id: obj.id || String(idx + 1),
                title: obj.title || obj.step || '-',
                intent: obj.intent || '-',
                path: obj.path || '-',
                ok: allOk,                    // mark ok if no errors detected
                detail: obj.detail || ''      // no detail available in plan; leave blank
              };
            });
          }

          // 4) Render rows
          for (var i = 0; i < execSteps.length; i++) {
            var s = execSteps[i] || {};
            appendExecRow({
              id: s.id || String(i + 1),
              title: s.title || s.step || '-',
              intent: s.intent || '-',
              path: s.path || '-',
              ok: (s.ok === true) || (s.status === 'ok'),
              detail: s.detail || s.diff || s.message || ''
            });
          }


          // Observation
          renderObservation(payload.observation || {});

          // Raw JSON
          var raw = byId('raw-json');
          if (raw) {
            raw.textContent = JSON.stringify(msg.payload || payload || {}, null, 2);
            var rawSection = raw.closest('details');
            if (rawSection && !rawSection.hasAttribute('open')) rawSection.setAttribute('open', '');
          }

          // Finalize counts + summary from actual rows
          refreshCounts();
          setRunSummary(computeOkCount());
        } catch (e) {}
        return;
      }
    });

    // ---- Initial restore (when panel loads) ----
    (function init(){
      var st = loadState();
      var flt = st.filter || 'all';
      window._setFilter(flt, true);
      var chk = byId('follow-toggle');
      if (chk) {
        var follow = (st.follow !== false);
        chk.checked = follow;
        __followNewRows = follow;
      }
      refreshCounts();
    })();
  </script>
</body>
</html>`;
}

const GLOBAL_PANEL_KEY = '__striker_results_panel__';
let __lastFinalPayload: ResultsPayload | undefined;

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

export function showResultsPanel(title: string, payload: ResultsPayload) {
  // Guard: never open for empty/undefined payloads
  const isObject = payload && typeof payload === 'object';
  const hasKeys = isObject && Object.keys(payload).length > 0;
  if (!hasKeys) {
    vscode.window.showInformationMessage('No results to display.');
    return;
  }

  const panel = acquireOrCreateResultsPanel(title);
  panel.webview.html = renderResultsHtml();

  // Relaxed typing to allow new toolbar actions (copy-json)
  panel.webview.onDidReceiveMessage(async (msg: any) => {
    const t = msg?.type as string;

    if (t === 'export-json') {
      const data = (msg?.payload as any) ?? __lastFinalPayload ?? { version: 1, plan: { steps: [] } };
      try {
        const uri = await vscode.window.showSaveDialog({
          title: 'Export Striker Results',
          defaultUri: vscode.Uri.file(`striker-results.json`),
          filters: { JSON: ['json'] }
        });
        if (!uri) return;
        const enc = new TextEncoder();
        const bytes = enc.encode(JSON.stringify(data, null, 2));
        await vscode.workspace.fs.writeFile(uri, bytes);
        vscode.window.showInformationMessage(`Exported results to ${uri.fsPath}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Export failed: ${err?.message || String(err)}`);
      }

    } else if (t === 'copy-json') {
      try {
        const data = (msg?.payload as any) ?? __lastFinalPayload ?? { version: 1, plan: { steps: [] } };
        await vscode.env.clipboard.writeText(JSON.stringify(data, null, 2));
        vscode.window.showInformationMessage('Results JSON copied to clipboard');
      } catch (err: any) {
        vscode.window.showErrorMessage(`Copy failed: ${err?.message || String(err)}`);
      }

    } else if (t === 'open-logs') {
      try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
          const guess = vscode.Uri.joinPath(ws.uri, '.striker', 'logs');
          try {
            await vscode.workspace.fs.createDirectory(guess); // ensure exists
            await vscode.commands.executeCommand('revealInExplorer', guess);
            vscode.window.showInformationMessage(`Logs folder ready: ${guess.fsPath}`);
          } catch (e:any) {
            vscode.window.showErrorMessage(`Open Logs failed: ${e?.message || String(e)}`);
          }
        } else {
          vscode.window.showInformationMessage('No workspace open.');
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Open Logs failed: ${err?.message || String(err)}`);
      }

    } else if (t === 'open-file') {
      const m = msg.target?.match?.(/^(.*?):(\d+):(\d+)$/);
      if (m) {
        const [, file, lineStr, colStr] = m;
        const line = Math.max(parseInt(lineStr, 10) - 1, 0);
        const col  = Math.max(parseInt(colStr, 10) - 1, 0);
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
          const candidate = vscode.Uri.joinPath(ws.uri, file);
          try {
            await vscode.workspace.fs.stat(candidate);
            const editor = await vscode.window.showTextDocument(candidate, { preview: false });
            const pos = new vscode.Position(line, col);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
            return;
          } catch {}
        }
        vscode.workspace.findFiles('**/' + file, '**/node_modules/**', 1).then(async uris => {
          if (uris.length) {
            const editor = await vscode.window.showTextDocument(uris[0], { preview: false });
            const pos = new vscode.Position(line, col);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          } else {
            vscode.window.showWarningMessage('File not found: ' + file);
          }
        });
      }
    }
  });

  __lastFinalPayload = payload;
  const message: ResultsMessage = { type: 'final-payload', payload };
  try { panel.webview.postMessage(message); } catch {}
}
