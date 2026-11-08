/* SPDX-License-Identifier: GPL-3.0-only */
// FM-1 Switcher UI. All flashing is done by M-VAVE's unmodified webupdate.js (FM1Web).
const $ = id => document.getElementById(id);
const STOCK_SHA = 'db1642b2b6fa5c2cccb11ffd13878068bb28601678d3644049f99dc40e7edb8a';
const STOCK_LOADER = 'ef1f2db89b011fa53e71df363f0122de0ea896618c53fb53e8da676322004541';
const STOCK_URL = 'https://raw.githubusercontent.com/m-vave/fm1_open/4c7496daac04a95ff10d1afdcc8f9ead2dbabc41/sdk/firmware/FM-1_015.fwsc';
let access, updater, identity = null, busy = false;

// --- library (IndexedDB: key = sha256, value = web-package meta incl. base64 data) ---
const db = new Promise((ok, no) => {
  const r = indexedDB.open('fm1-switcher', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('fw', { keyPath: 'sha256' });
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const tx = async (mode, fn) => { const d = await db; return new Promise((ok, no) => {
  const q = fn(d.transaction('fw', mode).objectStore('fw')); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); };
const all = () => tx('readonly', s => s.getAll());
const put = m => tx('readwrite', s => s.put(m));
const removed = () => { try { return new Set(JSON.parse(localStorage.getItem('fm1-removed') || '[]')); } catch { return new Set(); } };
const setRemoved = s => { try { localStorage.setItem('fm1-removed', JSON.stringify([...s])); } catch {} };
const del = k => tx('readwrite', s => s.delete(k));

const msg = (t, err) => { $('msg').textContent = t; $('msg').className = err ? 'err' : ''; };
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); };
const sha = async u8 => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map(b => b.toString(16).padStart(2, '0')).join('');

// Validate with the official code before storing; rejects anything it would refuse to flash.
async function add(meta) {
  await FM1Web.prepare(meta);
  meta.label = meta.label || meta.profile || meta.product;
  await put(meta); await render();
}
async function importFile(f) {
  const u8 = new Uint8Array(await f.arrayBuffer());
  if (f.name.endsWith('.json')) { let m = JSON.parse(new TextDecoder().decode(u8)); return add(m.stock ? (await add(m.stock), (delete m.stock, m)) : m); }
  if (await sha(u8) !== STOCK_SHA) throw new Error('Raw .fwsc files are only accepted for stock V15; use the .json web package for other firmware.');
  return addStock(u8);
}
const addStock = u8 => add({ schema: 1, kind: 'stock', product: 'FM-1_015', profile: 'M-VAVE Original V15', family: 7,
  build_id: STOCK_SHA, sha256: STOCK_SHA, bytes: u8.length, loader_sha256: STOCK_LOADER, data: b64(u8) });

// --- community firmwares: catalogue + packages come from thefirmwarehub.com, pinned by its SHA-256 ---
const HUB = 'https://thefirmwarehub.com/';
const EMU = 'https://joakimeriksson.github.io/fm1-emu/';
const HUB_IDS = ['sloop', 'melodee', 'amb', 'coralflower', 'zen', 'chord', 'fmel', 'frodhes', 'clipper', 'fm106', 'sloopdx', 'tonitor', 'jiant', 'choralroot', 'mono2k', 'karma'];
// An older release of the same hub firmware (stored with hubId, or before hubId existed: same name prefix and product).
const sameFw = (m, f) => m.pkg && m.sha256 !== f.sha256 && (m.hubId ? m.hubId === f.id : m.label.startsWith(f.name + ' '));
async function pruneOlder(f) { for (const m of await all()) if (sameFw(m, f)) await del(m.sha256); }
async function addHub(id) {
  const cat = await (await fetch(HUB + 'catalog.json', { cache: 'no-store' })).json();
  const f = cat.firmwares.find(x => x.id === id);
  if (!f || !f.pkg) throw new Error(id + ' is not in the hub catalogue');
  const r = await fetch(HUB + f.pkg); if (!r.ok) throw new Error('download failed: HTTP ' + r.status);
  const pkg = new Uint8Array(await r.arrayBuffer());
  if (Felucca.productOf(pkg) !== f.product || await Felucca.sha256hex(pkg) !== f.sha256) throw new Error('package does not match the hub catalogue');
  await put({ sha256: f.sha256, label: `${f.name} ${f.version}`, release_version: f.version, product: f.product,
    bytes: pkg.length, lic: f.lic, chip: f.chip, hubId: id, installs: f.installs || 0, kind: f.kind || 'other', pkg });
  await pruneOlder(f); await render();
}
async function runFelucca(m) {
  const up = new Felucca.Updater(access, console.log), image = Felucca.logicalImage(m.pkg), total = 2 * Math.ceil(image.length / 512);
  const step = (k, a) => {
    const t = { start: 'Asking the FM-1…', verify: 'The FM-1 reads the package…', loader: 'Update loader starting (the FM-1 restarts)…', write: 'Writing. Do not unplug.', reboot: 'Restarting…', done: 'Done.' }[k];
    if (t) msg(t); if (typeof a === 'number') $('bar').style.width = Math.min(100, (k === 'write' ? total / 2 + a : a) / total * 100) + '%';
  };
  const ota = await up.find(id => /^ota-/i.test(id.model));
  if (ota) { ota.link.close(); if (!(await up.resume(image, step))) throw new Error('stopped'); }
  else await up.install(image, m.product, step);
}

// --- local backup: project, samples and voice banks, saved as one file in your Downloads ---
// Works only while the FM-1 runs M-VAVE's FM1 Open firmware (the protocol FM1Web.Library speaks).
async function backup() {
  if (busy) return; busy = true; $('backup').disabled = true; const lib = new FM1Web.Library(access);
  try {
    msg('Connecting for backup…'); await lib.connect();
    const out = { format: 'fm1-switcher-backup', version: 1, created: new Date().toISOString(), firmware: identity };
    msg('Reading project…'); out.project = b64(await lib.download(0));
    msg('Reading samples…'); out.samples = b64(await lib.samplesRead(p => $('bar').style.width = (p * 100 || 0) + '%'));
    out.banks = []; if (lib.programs === 128) for (let i = 0; i < 4; i++) { msg(`Reading voice bank ${i + 1}…`); out.banks.push(b64(await lib.readBank(i))); }
    const url = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `fm1-backup-${out.created.slice(0, 10)}.json` }).click();
    URL.revokeObjectURL(url); localStorage.setItem('fm1-lastBackup', out.created);
    msg('Backup saved to your Downloads folder.');
  } catch (e) {
    msg('Backup failed: ' + e.message + '. Backups only work under the official FM1 Open firmware; for other firmwares use their own editor.', true);
  } finally { try { await lib.disconnect(); } catch {} busy = false; $('backup').disabled = !identity; }
}
$('backup').onclick = backup;

// --- settings: delete firmware, reset ---
async function openSettings() {
  const box = $('setList'); box.replaceChildren();
  for (const m of (await all()).sort((x, y) => x.label.localeCompare(y.label))) {
    const row = document.createElement('div'); row.className = 'setRow'; row.append(Object.assign(document.createElement('span'), { textContent: m.label }));
    row.append(Object.assign(document.createElement('button'), { textContent: 'Delete', disabled: busy, onclick: async () => {
      if (!confirm(`Delete "${m.label}" from this browser's library?`)) return;
      await del(m.sha256); const r = removed(); r.add(m.sha256); setRemoved(r); await render(); openSettings(); } }));
    box.append(row);
  }
  if (!box.children.length) box.textContent = 'The library is empty.';
  if (!$('settings').open) $('settings').showModal();
}
$('gear').onclick = openSettings;
$('setClose').onclick = () => $('settings').close();
$('setHist').onclick = () => { try { localStorage.removeItem('fm1-history'); } catch {} showHist(); };
$('setReset').onclick = async () => { if (!confirm('Delete everything in the library and re-download the featured firmwares?')) return;
  try { localStorage.removeItem('fm1-removed'); } catch {} for (const m of await all()) await del(m.sha256); location.reload(); };

// --- device ---
async function connect() {
  try {
    access = await navigator.requestMIDIAccess({ sysex: true });
    access.onstatechange = () => { if (!busy) probe(); };
    await probe();
  } catch (e) { msg('MIDI access failed: ' + e.message, true); }
}
async function probe() {
  const u = new FM1Web.Updater(access, { loaderIdentity: '', product: '', family: 7, build_id: '' });
  try { const d = await u.discover(true); identity = d ? d.identity : null; if (d) await d.link.close(); }
  catch (e) { identity = null; }
  $('backup').disabled = !identity; $('dot').className = 'dot' + (identity ? ' on' : ''); $('dev').textContent = identity ? 'FM-1 connected: ' + identity : 'No FM-1 found';
  render();
}

async function render() {
  const items = await all(); $('list').replaceChildren(); $('listOld').replaceChildren();
  const kinds = [...new Set(items.map(m => m.kind).filter(Boolean))].sort(), sel = $('kind');
  if (sel.options.length - 1 !== kinds.length) sel.replaceChildren(new Option('All', ''), ...kinds.map(k => new Option(k, k)));
  sel.value = pref('kind'); $('sort').value = pref('sort') || 'name';
  const by = $('sort').value === 'installs' ? (a, b) => (b.installs || 0) - (a.installs || 0) : (a, b) => a.label.localeCompare(b.label);
  for (const m of items.filter(m => !sel.value || m.kind === sel.value).sort(by)) {
    const el = document.createElement('div'); el.className = 'card' + (identity === m.product ? ' cur' : '');
    const pic = m.hubId ? `<img loading="lazy" alt="" src="${HUB}img/w0/${m.hubId}.webp">` : esc(m.label.slice(0, 2));
    el.innerHTML = `<div class="pic">${pic}</div><div class="t"><b></b><small></small></div><div class="row"></div>`;
    el.querySelector('b').textContent = m.label;
    el.querySelector('small').textContent = `${m.product} · ${(m.bytes / 1024) | 0} KB` + (m.lic ? ' · ' + m.lic : '') + (identity === m.product ? ' · installed' : '');
    if (m.chip === 'old') el.querySelector('.t').insertAdjacentHTML('beforeend', '<br><span class="badge w" title="Only knows the first FM-1s\' Puya flash chip">old flash chip only</span>');
    const sw = Object.assign(document.createElement('button'), { textContent: 'Switch', className: 'p', disabled: !identity || busy });
    sw.onclick = () => run(m);
    const row = el.querySelector('.row');
    if (m.hubId) row.append(Object.assign(document.createElement('a'), { textContent: '▶', title: 'Try it in the browser emulator (fm1-emu), no FM-1 needed', href: EMU + '?fw=' + encodeURIComponent(m.hubId), target: '_blank', rel: 'noopener', className: 'try', onclick: e => { e.preventDefault(); openEmu(m); } }));
    row.append(sw); $(m.chip === 'old' ? 'listOld' : 'list').append(el);
  }
  $('old').hidden = !items.some(m => m.chip === 'old');
  if (!items.length) $('list').innerHTML = '<p class="sub">Loading firmwares…</p>';
}
const pref = (k, v) => { try { if (v !== undefined) localStorage.setItem('fm1-' + k, v); return localStorage.getItem('fm1-' + k) || ''; } catch { return ''; } };
$('sort').onchange = e => { pref('sort', e.target.value); render(); };
$('kind').onchange = e => { pref('kind', e.target.value); render(); };
const effTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
const setTheme = v => { v === 'auto' ? delete document.documentElement.dataset.theme : (document.documentElement.dataset.theme = v); pref('theme', v === 'auto' ? '' : v); $('theme').value = v; $('themeBtn').textContent = effTheme() === 'dark' ? '☀' : '☾'; $('themeBtn').title = effTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; };
$('themeBtn').onclick = () => setTheme(effTheme() === 'dark' ? 'light' : 'dark');
$('theme').value = pref('theme') || 'auto'; setTheme($('theme').value);
$('theme').onchange = e => setTheme(e.target.value);
// Flash history: what this browser switched to, newest first.
const hist = () => { try { return JSON.parse(localStorage.getItem('fm1-history') || '[]'); } catch { return []; } };
const showHist = () => { $('hist').textContent = hist().length ? 'Recent switches: ' + hist().slice(0, 5).map(h => `${h.label} (${new Date(h.at).toLocaleDateString()})`).join(' · ') : ''; };
const logHist = m => { try { localStorage.setItem('fm1-history', JSON.stringify([{ label: m.label, product: m.product, at: Date.now() }, ...hist()].slice(0, 20))); } catch {} showHist(); };
showHist();
// Emulator panel: fm1-emu embedded, so you can audition a firmware (with your MIDI keyboard) before flashing.
function openEmu(m) {
  const url = EMU + '?fw=' + encodeURIComponent(m.hubId);
  $('emuTitle').textContent = m.label + ' (emulator)'; $('emuOpen').href = url;
  $('emuFrame').src = url; $('emu').hidden = false;
}
$('emuClose').onclick = () => { $('emu').hidden = true; $('emuFrame').src = 'about:blank'; };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function run(meta) {
  const force = $('force').checked;
  const oldChip = meta.chip === 'old' ? '\n\nWARNING: this version only knows the first FM-1s\' flash chip (Puya). On a newer FM-1 (UC25HQ80, common on AliExpress units) saving may fail and later updates from it may not work. Only continue if you know your unit has the older chip.' : '';
  if (!confirm(`Switch the FM-1 to "${meta.label}"?\n\nBack up first (the Back up button works under official FM1 Open firmware only). Do not unplug or power off until it finishes.${oldChip}`)) return;
  busy = true; render(); $('bar').style.width = '0';
  try {
    if (meta.pkg) { await runFelucca(meta); msg('Done: now running ' + meta.label); logHist(meta); await probe(); busy = false; return render(); }
    const pkg = await FM1Web.prepare(meta);
    updater = new FM1Web.Updater(access, pkg, (t, p) => { msg(String(t)); if (p != null) $('bar').style.width = p + '%'; });
    const r = await updater.connect({ force });
    if (r.migration) throw new Error('Current firmware (' + r.identity + ') is not recognised. Tick "Allow switching from firmware this app doesn\'t recognise" and retry.');
    if (r.same) throw new Error('That firmware is already installed.');
    await updater.install({ force });
    msg('Done: now running ' + meta.label); logHist(meta); await probe();
  } catch (e) { msg(e.message, true); }
  busy = false; render();
}

$('connect').onclick = connect;
$('pick').onclick = () => $('file').click();
$('file').onchange = async e => { for (const f of e.target.files) await importFile(f).catch(x => msg(f.name + ': ' + x.message, true)); e.target.value = ''; };
$('addv15').onclick = async () => { try { msg('Downloading…'); const r = await fetch(STOCK_URL); await addStock(new Uint8Array(await r.arrayBuffer())); msg('Added stock V15.'); } catch (e) { msg(e.message, true); } };
$('addv14').onclick = async () => { try { msg('Loading…'); await add(await (await fetch('firmware/fm1-open-v14.json')).json()); msg('Added FM1 Open V14.'); } catch (e) { msg(e.message, true); } };
document.querySelectorAll('[data-hub]').forEach(b => b.onclick = async () => { try { msg('Downloading from the hub…'); await addHub(b.dataset.hub); msg('Added ' + b.textContent + '.'); } catch (e) { msg(e.message, true); } });
const dz = $('drop');
dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
dz.ondrop = async e => { e.preventDefault(); dz.classList.remove('over'); for (const f of e.dataTransfer.files) await importFile(f).catch(x => msg(f.name + ': ' + x.message, true)); };
// First run: fill the library with the featured firmwares so the page is a plain picker.
(async () => {
  await render(); const have = new Set([...(await all()).map(m => m.sha256), ...removed()]), jobs = [];
  if (!have.has('7e7b6d260163cdf9d716f7fab44f19be600edeffcd390de74370b83c917fd0c6')) jobs.push(() => fetch('firmware/fm1-open-v14.json').then(r => r.json()).then(add));
  if (!have.has(STOCK_SHA)) jobs.push(() => fetch(STOCK_URL).then(r => r.arrayBuffer()).then(b => addStock(new Uint8Array(b))));
  const cat = await fetch(HUB + 'catalog.json').then(r => r.json()).catch(() => ({ firmwares: [] }));
  for (const m of await all()) { const f = cat.firmwares.find(x => HUB_IDS.includes(x.id) && x.sha256 === m.sha256); if (f && (!m.hubId || m.installs === undefined)) await put({ ...m, hubId: f.id, installs: f.installs || 0, kind: f.kind || 'other' }); }
  for (const id of HUB_IDS) { const f = cat.firmwares.find(x => x.id === id); if (!f) continue; if (have.has(f.sha256)) await pruneOlder(f); else jobs.push(() => addHub(id)); }
  if (jobs.length) msg('Loading firmwares…');
  for (const j of jobs) await j().catch(e => msg(e.message, true));
  if (jobs.length && !$('msg').className) msg('');
})();
