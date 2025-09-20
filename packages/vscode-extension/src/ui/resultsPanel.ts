import * as vscode from 'vscode';

/** Open/refresh the Striker Results webview */
export function showResultsPanel(title: string, data: unknown) {
  const panel = vscode.window.createWebviewPanel(
    'strikerResults',
    title || 'Striker Results',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = getHtml(panel.webview, data);
}

function getHtml(webview: vscode.Webview, raw: unknown) {
  const payloadJson = JSON.stringify(raw ?? {}, null, 2).replace(/</g, '\\u003c');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} https: data:;
                 style-src 'unsafe-inline' ${webview.cspSource};
                 script-src 'unsafe-inline' ${webview.cspSource};"/>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Striker Results</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --panel: var(--vscode-editorWidget-background);
      --border: var(--vscode-panel-border);
    }
    html,body { background:var(--bg); color:var(--fg); margin:0; padding:0; font-size:13px;
                font-family: var(--vscode-editor-font-family), ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
    .wrap { padding: 12px 16px 40px; }
    h1{font-size:18px;margin:8px 0 12px;} h2{font-size:14px;margin:18px 0 8px;color:var(--muted);}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:12px 0 18px;overflow:hidden;}
    table{width:100%;border-collapse:collapse;table-layout:fixed;}
    thead th{text-align:left;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border);padding:6px 8px;white-space:nowrap;position:sticky;top:0;background:var(--panel);}
    tbody td{border-bottom:1px solid var(--border);padding:6px 8px;vertical-align:top;word-break:break-word;}
    td.mono, code, pre{font-family: var(--vscode-editor-font-family), ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;}
    details summary{cursor:pointer;outline:none;}
    pre{margin:6px 0 0;padding:8px;border-radius:6px;background:var(--panel);font-size:12px;white-space:pre-wrap;overflow-x:auto;border:1px solid var(--border);}
    .text-muted{color:var(--muted);}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Striker Results</h1>

    <h2>Plan Steps</h2>
    <div class="card"><div id="plan-steps"></div></div>

    <h2>Execution</h2>
    <div class="card"><div id="execution"></div></div>

    <h2>Observation</h2>
    <div class="card"><div id="observation"></div></div>

    <h2>Raw JSON</h2>
    <div class="card"><pre id="raw-json"></pre></div>
  </div>

  <script>
    const payload = ${payloadJson};

    function escapeHtml(s){
      try{ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
      catch{ return ''; }
    }

    // generic value helper (pretty JSON if objects leak into default path)
    function valueAt(r,c){
      try{
        const v = r && r[c];
        if (v && typeof v === 'object') return JSON.stringify(v, null, 2);
        return v == null ? '' : String(v);
      }catch{ return ''; }
    }

    function toArray(x){ if(Array.isArray(x)) return x; if(x && typeof x==='object' && Array.isArray(x.steps)) return x.steps; return []; }
    function preferColumns(rows, pref){
      const seen=new Set(); rows.forEach(r=>Object.keys(r||{}).forEach(k=>seen.add(k)));
      const cols=[]; pref.forEach(k=>{ if(seen.has(k)) cols.push(k); }); seen.forEach(k=>{ if(!cols.includes(k)) cols.push(k); }); return cols;
    }

    function renderSmartTable(selector, src){
      const host=document.querySelector(selector); if(!host) return;
      const rows=toArray(src);
      if(!rows.length){ host.innerHTML='<div class="text-muted">— no data —</div>'; return; }

      // attach inputsRaw if present
      rows.forEach(r=>{ if(r && typeof r==='object' && 'inputs' in r && !('inputsRaw' in r)) r.inputsRaw = r.inputs ?? null; });

      const cols = preferColumns(rows, ['id','title','intent','inputs','acceptance','rollbackHint','path','status','note','stepId','patch','inputsRaw']);

      const thead = '<thead><tr>' + cols.map(c=>{
        const label = (String(c).trim().toLowerCase()==='inputs') ? 'inputs (view)' : c;
        return '<th><span>'+escapeHtml(label)+'</span></th>';
      }).join('') + '</tr></thead>';

      const tbody = '<tbody>' + rows.map(r=>{
        return '<tr>' + cols.map(c=>{
          // Inputs JSON expander
          if ((c||'').trim().toLowerCase()==='inputs' || (c||'').trim().toLowerCase()==='inputsraw'){
            const obj = r.inputs ?? r.inputsRaw ?? null;
            if (!obj || (typeof obj==='object' && Object.keys(obj).length===0)){
              return '<td class="inputs"><span class="text-muted">—</span></td>';
            }
            let pretty=''; try{ pretty=JSON.stringify(obj,null,2);}catch{pretty=String(obj);}
            const body=escapeHtml(pretty);
            return [
              '<td class="inputs">',
              '  <details class="inline-block">',
              '    <summary>view</summary>',
              '    <pre>', body, '</pre>',
              '  </details>',
              '</td>'
            ].join('');
          }

          // Acceptance as stacked lines
          if (c==='acceptance'){
            const acc=r[c]||[];
            if(Array.isArray(acc)) return '<td>'+acc.map(a=>'<div>'+escapeHtml(a)+'</div>').join('')+'</td>';
            return '<td>'+escapeHtml(String(acc))+'</td>';
          }

          // Intent as code
          if (c==='intent'){ return '<td><code>'+escapeHtml(valueAt(r,c))+'</code></td>'; }

          // Patch: show a small view expander if object with diff/after
          if (c==='patch' && r.patch && typeof r.patch==='object'){
            let pretty=''; try{ pretty=JSON.stringify(r.patch,null,2);}catch{ pretty=String(r.patch); }
            return [
              '<td>',
              '  <details class="inline-block">',
              '    <summary>view</summary>',
              '    <pre>', escapeHtml(pretty), '</pre>',
              '  </details>',
              '</td>'
            ].join('');
          }

          // default text cell (preserve newlines)
          return '<td class="mono" style="white-space:pre-wrap;">'+escapeHtml(valueAt(r,c))+'</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';

      host.innerHTML = '<table>'+thead+tbody+'</table>';
    }

    try{
      const planSteps = (payload && payload.plan && Array.isArray(payload.plan.steps)) ? payload.plan.steps : [];
      const execution = payload && payload.execution ? (payload.execution.steps || payload.execution) : [];
      const observation = payload && payload.observation
        ? (payload.observation.summary && Array.isArray(payload.observation.summary.created))
            ? Array.from(new Set(payload.observation.summary.created)).map((f,i)=>({ id:i+1, file:f }))
            : (payload.observation.notes ? payload.observation.notes.map((n,i)=>({ id:i+1, note:n })) : [])
        : [];

      renderSmartTable('#plan-steps', planSteps);
      renderSmartTable('#execution', execution);
      renderSmartTable('#observation', observation);

      document.getElementById('raw-json').textContent = JSON.stringify(payload, null, 2);
    }catch(e){
      document.getElementById('raw-json').textContent = 'Render error: '+(e && e.message ? e.message : String(e));
    }
  </script>
</body>
</html>`;
}
