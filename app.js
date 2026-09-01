const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const PORT = 43127;
const dashboardUrl = `http://127.0.0.1:${PORT}`;

function desktopDirectory() {
  const home = os.homedir();
  if (process.platform === 'linux') {
    try {
      const config = fs.readFileSync(path.join(home, '.config', 'user-dirs.dirs'), 'utf8');
      const match = config.match(/^XDG_DESKTOP_DIR=(.+)$/m);
      if (match) {
        const configured = match[1].trim().replace(/^['"]|['"]$/g, '')
          .replace(/\$HOME|\$\{HOME\}/g, home);
        if (configured) return configured;
      }
    } catch {}
    const linuxCandidates = [path.join(home, 'Desktop'), path.join(home, 'Bureau')];
    return linuxCandidates.find(candidate => fs.existsSync(candidate)) || linuxCandidates[0];
  }
  if (process.platform === 'win32') {
    const windowsCandidates = [
      process.env.OneDrive && path.join(process.env.OneDrive, 'Desktop'),
      path.join(home, 'Desktop'),
      path.join(home, 'Bureau')
    ].filter(Boolean);
    return windowsCandidates.find(candidate => fs.existsSync(candidate)) || windowsCandidates[0];
  }
  return path.join(home, 'Desktop');
}

const downloadDir = path.join(desktopDirectory(), 'SVG Network Downloads');
fs.mkdirSync(downloadDir, { recursive: true });

let browser;
let context;
let monitoredPage;
let paused = false;
let saved = [];
const seen = new Set();

function diskFiles() {
  return fs.readdirSync(downloadDir)
    .filter(name => name.toLowerCase().endsWith('.svg'))
    .map(name => {
      const stat = fs.statSync(path.join(downloadDir, name));
      const known = saved.find(item => item.name === name);
      return { name, url: known?.url || '', time: known?.time || stat.mtime.toLocaleTimeString('fr-FR') };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function validNames(input) {
  const available = new Set(diskFiles().map(file => file.name));
  return [...new Set(input || [])].filter(name => available.has(name) && path.basename(name) === name);
}

function safeName(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 90) || 'image';
}

function fileNameFor(url, index) {
  try {
    const u = new URL(url);
    const raw = decodeURIComponent(path.basename(u.pathname)).replace(/\.svg(?:z)?$/i, '');
    return `${String(index).padStart(4, '0')}-${safeName(raw || u.hostname)}.svg`;
  } catch {
    return `${String(index).padStart(4, '0')}-image.svg`;
  }
}

async function capture(response) {
  if (paused || response.request().resourceType() === 'document' && response.url() === dashboardUrl + '/') return;
  const headers = await response.allHeaders().catch(() => ({}));
  const type = String(headers['content-type'] || '').toLowerCase();
  const url = response.url();
  const looksSvg = type.includes('image/svg+xml') || /\.svg(?:z)?(?:[?#]|$)/i.test(url);
  if (!looksSvg) return;
  const key = `${response.status()}|${url}`;
  if (seen.has(key)) return;
  seen.add(key);
  try {
    let body = await response.body();
    if (!body || !body.length) return;
    if (url.toLowerCase().includes('.svgz') || type.includes('gzip')) {
      try { body = require('zlib').gunzipSync(body); } catch {}
    }
    const textStart = body.subarray(0, 500).toString('utf8').toLowerCase();
    if (!type.includes('image/svg+xml') && !textStart.includes('<svg')) return;
    const name = fileNameFor(url, saved.length + 1);
    const target = path.join(downloadDir, name);
    fs.writeFileSync(target, body);
    saved.unshift({ name, url, time: new Date().toLocaleTimeString('fr-FR') });
    saved = saved.slice(0, 200);
  } catch (error) {
    console.error('SVG non enregistré:', url, error.message);
  }
}

async function openTarget(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!monitoredPage || monitoredPage.isClosed()) {
    monitoredPage = await context.newPage();
    monitoredPage.on('response', capture);
  }
  await monitoredPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await monitoredPage.bringToFront();
}

async function launchCompatibleBrowser() {
  const attempts = [];
  if (process.env.SVG_COLLECTOR_BROWSER) {
    attempts.push({ label: process.env.SVG_COLLECTOR_BROWSER, options: { executablePath: process.env.SVG_COLLECTOR_BROWSER } });
  }
  if (process.platform === 'win32') {
    attempts.push(
      { label: 'Microsoft Edge', options: { channel: 'msedge' } },
      { label: 'Google Chrome', options: { channel: 'chrome' } },
      { label: 'Chromium Playwright', options: {} }
    );
  } else {
    attempts.push({ label: 'Chromium Playwright', options: {} });
    const linuxBrowsers = [
      '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium', '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ];
    for (const executablePath of linuxBrowsers) {
      if (fs.existsSync(executablePath)) attempts.push({ label: executablePath, options: { executablePath } });
    }
    attempts.push({ label: 'Google Chrome', options: { channel: 'chrome' } });
  }

  const errors = [];
  for (const attempt of attempts) {
    try {
      return await chromium.launch({ ...attempt.options, headless: false });
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message.split('\n')[0]}`);
    }
  }
  const linuxHelp = process.platform === 'linux'
    ? '\nSous Linux, lancez d’abord : bash "Installer Linux.sh"'
    : '\nLancez « Installer Windows.cmd » ou installez Microsoft Edge.';
  throw new Error(`Aucun navigateur compatible n’a pu démarrer.${linuxHelp}\n${errors.join('\n')}`);
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SVG Network Collector</title><style>
:root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#0b1020;color:#eef2ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0,#263469 0,transparent 35%),#0b1020}.wrap{max-width:1100px;margin:auto;padding:42px 24px}.brand{display:flex;align-items:center;gap:14px}.logo{width:46px;height:46px;border-radius:14px;background:#7c5cff;display:grid;place-items:center;font-size:25px;box-shadow:0 10px 35px #7c5cff55}h1{font-size:28px;margin:0}p{color:#aab2d5;line-height:1.55}.card{background:#121a31dd;border:1px solid #2a355b;border-radius:20px;padding:22px;margin-top:22px;box-shadow:0 24px 80px #0005}.bar,.actions,.reorder{display:flex;gap:10px;flex-wrap:wrap}input{flex:1;min-width:250px;background:#090f20;border:1px solid #33406b;border-radius:12px;padding:15px;color:white;font-size:16px;outline:none}input:focus{border-color:#826aff;box-shadow:0 0 0 3px #7c5cff2e}button{border:0;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer;background:#7c5cff;color:white}button.secondary{background:#273252}button.danger{background:#8f3045}.stats{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:22px 0 8px;flex-wrap:wrap}.pill{background:#1d2849;padding:8px 12px;border-radius:99px;color:#bec7eb;font-size:14px}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-top:18px}.tile{position:relative;background:#0c1327;border:2px solid #222d50;border-radius:15px;overflow:hidden;transition:.15s}.tile.selected{border-color:#7c5cff}.tile.dragging{opacity:.35}.tile.dragover{transform:scale(1.03);border-color:#78e6ac}.preview{display:grid;place-items:center;height:155px;background:white;cursor:zoom-in}.preview img{width:100%;height:100%;object-fit:contain}.meta{padding:10px}.name{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.check{position:absolute;z-index:2;top:9px;left:9px;width:22px;height:22px;accent-color:#7c5cff}.trash{position:absolute;z-index:2;top:7px;right:7px;padding:6px 9px;background:#8f3045}.reorder{margin-top:9px}.reorder button{flex:1;padding:5px;background:#273252}.position{position:absolute;left:39px;top:7px;z-index:2;width:44px;min-width:0;padding:4px 5px;border:1px solid #7c5cff;background:#121a31ef;color:white;border-radius:8px;font-size:12px;text-align:center}.empty{text-align:center;padding:42px;color:#7f89ad}.hint{font-size:13px}.ok{color:#78e6ac}.result{margin-top:14px;color:#78e6ac}.modal{position:fixed;inset:0;background:#050817eF;display:none;place-items:center;padding:28px;z-index:10}.modal.open{display:grid}.modal img{max-width:92vw;max-height:88vh;background:white;border-radius:12px}.modal>button{position:fixed;right:24px;top:24px}@media(max-width:650px){.bar{flex-direction:column}.bar button{height:48px}.gallery{grid-template-columns:repeat(2,1fr)}}</style></head><body><main class="wrap"><div class="brand"><div class="logo">◇</div><div><h1>SVG Network Collector</h1><p style="margin:4px 0 0">Capture, vérifie, puis assemble.</p></div></div><section class="card"><div class="bar"><input id="url" value="https://" placeholder="Adresse du site"><button id="go">Ouvrir et surveiller</button></div><div class="stats"><div><span class="pill"><b id="count">0</b> SVG</span> <span class="pill ok" id="state">Surveillance active</span></div><button class="secondary" id="pause">Pause</button></div><p class="hint">Dossier : <b>${downloadDir.replace(/\\/g, '\\\\')}</b></p></section><section class="card"><div class="stats"><div><h2 style="margin:0 0 6px">Fichiers à valider</h2><span class="hint"><b id="selectedCount">0</b> sélectionnés · Glisse les vignettes pour changer l’ordre du PDF</span></div><div class="actions"><button class="secondary" id="all">Tout sélectionner</button><button class="danger" id="deleteSelected">Supprimer la sélection</button><button id="pdf">Valider et créer le PDF</button></div></div><div class="result" id="result"></div><div class="gallery" id="list"><div class="empty">Aucun SVG détecté pour l’instant.</div></div></section></main><div class="modal" id="modal"><button id="close">Fermer</button><img id="large"></div><script>
const q=s=>document.querySelector(s),selected=new Set();let files=[],manualOrder=[],dragged='';async function api(url,opt){const r=await fetch(url,opt),d=await r.json();if(!r.ok)throw Error(d.error||'Erreur');return d}function orderedSelected(){return files.filter(x=>selected.has(x.name)).map(x=>x.name)}q('#go').onclick=async()=>{q('#go').textContent='Ouverture…';try{await api('/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:q('#url').value})})}finally{q('#go').textContent='Ouvrir et surveiller'}};q('#url').onkeydown=e=>{if(e.key==='Enter')q('#go').click()};q('#pause').onclick=async()=>render(await api('/pause',{method:'POST'}));q('#all').onclick=()=>{if(selected.size===files.length)selected.clear();else files.forEach(x=>selected.add(x.name));draw()};async function deleteFiles(names){const targets=[...new Set(names)].filter(Boolean);if(!targets.length)return;const d=await api('/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({names:targets})});if(!d.deleted)throw Error('Aucun fichier n’a été supprimé.');const removed=new Set(targets);files=files.filter(x=>!removed.has(x.name));manualOrder=files.map(x=>x.name);targets.forEach(name=>selected.delete(name));draw();q('#result').textContent=d.deleted+' fichier(s) supprimé(s).'}q('#deleteSelected').onclick=async()=>{const names=orderedSelected();if(!names.length)return alert('Sélectionne au moins un fichier à supprimer.');if(!confirm('Supprimer définitivement '+names.length+' fichier(s) ?'))return;q('#deleteSelected').disabled=true;try{await deleteFiles(names)}catch(e){alert('Suppression impossible : '+e.message);await refresh()}finally{q('#deleteSelected').disabled=false}};q('#pdf').onclick=async()=>{if(!selected.size)return alert('Sélectionne au moins un SVG.');q('#pdf').textContent='Création…';try{const d=await api('/pdf',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({names:orderedSelected()})});q('#result').textContent='PDF créé dans cet ordre ('+d.pages+' pages) : '+d.path}catch(e){alert(e.message)}finally{q('#pdf').textContent='Valider et créer le PDF'}};q('#close').onclick=()=>q('#modal').classList.remove('open');q('#modal').onclick=e=>{if(e.target.id==='modal')q('#modal').classList.remove('open')};function move(name,delta){const i=files.findIndex(x=>x.name===name),j=i+delta;if(i<0||j<0||j>=files.length)return;[files[i],files[j]]=[files[j],files[i]];manualOrder=files.map(x=>x.name);draw()}function moveTo(name,value){const from=files.findIndex(x=>x.name===name);if(from<0)return;const requested=Math.round(Number(value));if(!Number.isFinite(requested))return draw();const to=Math.max(0,Math.min(files.length-1,requested-1));const [item]=files.splice(from,1);files.splice(to,0,item);manualOrder=files.map(x=>x.name);draw()}function moveBefore(from,to){if(!from||from===to)return;const i=files.findIndex(x=>x.name===from),j=files.findIndex(x=>x.name===to);if(i<0||j<0)return;const [item]=files.splice(i,1);files.splice(j,0,item);manualOrder=files.map(x=>x.name);draw()}function draw(){q('#selectedCount').textContent=selected.size;q('#all').textContent=selected.size===files.length&&files.length?'Tout désélectionner':'Tout sélectionner';q('#list').innerHTML=files.length?files.map((x,i)=>'<article draggable="true" data-tile="'+esc(x.name)+'" class="tile '+(selected.has(x.name)?'selected':'')+'"><input class="check" type="checkbox" '+(selected.has(x.name)?'checked':'')+' data-name="'+esc(x.name)+'"><input class="position" type="number" min="1" max="'+files.length+'" value="'+(i+1)+'" data-position="'+esc(x.name)+'" title="Modifier le numéro puis appuyer sur Entrée"><button class="trash" data-delete="'+esc(x.name)+'">×</button><div class="preview" data-view="'+esc(x.name)+'"><img draggable="false" loading="lazy" src="/svg?name='+encodeURIComponent(x.name)+'"></div><div class="meta"><div class="name">'+esc(x.name)+'</div><span class="hint">'+esc(x.time)+'</span><div class="reorder"><button data-left="'+esc(x.name)+'">←</button><button data-right="'+esc(x.name)+'">→</button></div></div></article>').join(''):'<div class="empty">Aucun SVG détecté pour l’instant.</div>';document.querySelectorAll('[data-name]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.name):selected.delete(el.dataset.name);draw()});document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{q('#large').src='/svg?name='+encodeURIComponent(el.dataset.view);q('#modal').classList.add('open')});document.querySelectorAll('[data-delete]').forEach(el=>el.onclick=async e=>{e.preventDefault();e.stopPropagation();const name=el.dataset.delete;if(!confirm('Supprimer définitivement ce fichier ?'))return;el.disabled=true;try{await deleteFiles([name])}catch(error){el.disabled=false;alert('Suppression impossible : '+error.message);await refresh()}});document.querySelectorAll('[data-position]').forEach(el=>{el.onclick=e=>e.stopPropagation();el.onmousedown=e=>e.stopPropagation();el.ondragstart=e=>e.preventDefault();el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();moveTo(el.dataset.position,el.value)}}});document.querySelectorAll('[data-left]').forEach(el=>el.onclick=()=>move(el.dataset.left,-1));document.querySelectorAll('[data-right]').forEach(el=>el.onclick=()=>move(el.dataset.right,1));document.querySelectorAll('[data-tile]').forEach(el=>{el.ondragstart=()=>{dragged=el.dataset.tile;el.classList.add('dragging')};el.ondragend=()=>{dragged='';el.classList.remove('dragging')};el.ondragover=e=>{e.preventDefault();el.classList.add('dragover')};el.ondragleave=()=>el.classList.remove('dragover');el.ondrop=e=>{e.preventDefault();el.classList.remove('dragover');moveBefore(dragged,el.dataset.tile)}})}function render(d){const incoming=new Map(d.saved.map(x=>[x.name,x]));files=manualOrder.filter(n=>incoming.has(n)).map(n=>incoming.get(n));for(const x of d.saved)if(!manualOrder.includes(x.name))files.push(x);manualOrder=files.map(x=>x.name);for(const n of [...selected])if(!incoming.has(n))selected.delete(n);q('#count').textContent=files.length;q('#state').textContent=d.paused?'En pause':'Surveillance active';q('#state').className=d.paused?'pill':'pill ok';q('#pause').textContent=d.paused?'Reprendre':'Pause';draw()}function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}async function refresh(){if(document.activeElement&&document.activeElement.matches('[data-position]'))return;render(await api('/status'))}setInterval(refresh,1200);refresh();
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return;
  }
  if (req.method === 'GET' && req.url === '/status') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ saved: diskFiles(), paused })); return;
  }
  if (req.method === 'GET' && req.url.startsWith('/svg?')) {
    const name = new URL(req.url, dashboardUrl).searchParams.get('name') || '';
    if (!validNames([name]).length) { res.statusCode = 404; res.end('Introuvable'); return; }
    res.setHeader('Content-Type', 'image/svg+xml'); fs.createReadStream(path.join(downloadDir, name)).pipe(res); return;
  }
  if (req.method === 'POST' && req.url === '/pause') {
    paused = !paused; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ saved: diskFiles(), paused })); return;
  }
  if (req.method === 'POST' && req.url === '/open') {
    let body = ''; req.on('data', c => body += c); req.on('end', async () => {
      try { await openTarget(JSON.parse(body).url); res.end('{"ok":true}'); }
      catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }
  if (req.method === 'POST' && req.url === '/delete') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      try { const names = validNames(JSON.parse(body).names); names.forEach(name => fs.unlinkSync(path.join(downloadDir, name))); saved = saved.filter(x => !names.includes(x.name)); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, deleted: names.length })); }
      catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }
  if (req.method === 'POST' && req.url === '/pdf') {
    let body = ''; req.on('data', c => body += c); req.on('end', async () => {
      let pdfPage;
      try {
        const names = validNames(JSON.parse(body).names);
        if (!names.length) throw new Error('Aucun SVG valide sélectionné.');
        const pages = names.map(name => {
          const data = fs.readFileSync(path.join(downloadDir, name)).toString('base64');
          return `<section class="page"><img src="data:image/svg+xml;base64,${data}"><footer>${name.replace(/[&<>]/g, '')}</footer></section>`;
        }).join('');
        pdfPage = await context.newPage();
        await pdfPage.setContent(`<!doctype html><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0}.page{width:210mm;height:297mm;page-break-after:always;display:flex;align-items:center;justify-content:center;padding:14mm 14mm 20mm;position:relative;background:white}.page:last-child{page-break-after:auto}img{max-width:100%;max-height:100%;object-fit:contain}footer{position:absolute;bottom:7mm;font:10px Arial;color:#777;max-width:180mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style>${pages}`, { waitUntil: 'load' });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const target = path.join(downloadDir, `SVG-valides-${stamp}.pdf`);
        await pdfPage.pdf({ path: target, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
        await pdfPage.close();
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, path: target, pages: names.length }));
      } catch (e) { if (pdfPage && !pdfPage.isClosed()) await pdfPage.close().catch(() => {}); res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }
  res.statusCode = 404; res.end('Not found');
});

(async () => {
  server.listen(PORT, '127.0.0.1');
  browser = await launchCompatibleBrowser();
  context = await browser.newContext({ acceptDownloads: true });
  const dashboard = await context.newPage();
  await dashboard.goto(dashboardUrl);
  browser.on('disconnected', () => server.close());
})().catch(error => { console.error(error); process.exit(1); });
