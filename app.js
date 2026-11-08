/* SPDX-License-Identifier: GPL-3.0-only */
// FM-1 Switcher UI. All flashing is done by M-VAVE's unmodified webupdate.js (FM1Web).
const $ = id => document.getElementById(id);
const STOCK_SHA = 'db1642b2b6fa5c2cccb11ffd13878068bb28601678d3644049f99dc40e7edb8a';
const STOCK_LOADER = 'ef1f2db89b011fa53e71df363f0122de0ea896618c53fb53e8da676322004541';
const STOCK_URL = 'https://raw.githubusercontent.com/m-vave/fm1_open/4c7496daac04a95ff10d1afdcc8f9ead2dbabc41/sdk/firmware/FM-1_015.fwsc';
let access, updater, identity = null, busy = false;

// --- library (IndexedDB: key = sha256, value = web-package meta incl. base64 data) ---
const db = new Promise((ok, no) => {
  const r = indexedDB.open('fm1-switcher', 2);
  r.onupgradeneeded = () => {
    if (!r.result.objectStoreNames.contains('fw')) r.result.createObjectStore('fw', { keyPath: 'sha256' });
    if (!r.result.objectStoreNames.contains('saves')) r.result.createObjectStore('saves', { keyPath: 'id' });
  };
  // An older tab holding the previous version open would block the upgrade forever: say so, and let newer tabs step aside.
  r.onblocked = () => msg('Close your other FM-1 Switcher tabs, then reload this page.', true);
  r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ok(r.result); };
  r.onerror = () => no(r.error);
});
const tx = async (mode, fn, store = 'fw') => { const d = await db; return new Promise((ok, no) => {
  const q = fn(d.transaction(store, mode).objectStore(store)); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); };
const all = () => tx('readonly', s => s.getAll());
const put = m => tx('readwrite', s => s.put(m));
const removed = () => { try { return new Set(JSON.parse(localStorage.getItem('fm1-removed') || '[]')); } catch { return new Set(); } };
const setRemoved = s => { try { localStorage.setItem('fm1-removed', JSON.stringify([...s])); } catch {} };
const del = k => tx('readwrite', s => s.delete(k));
// Saves (backups of your project, samples and voice banks) live in their own store; library resets never touch them.
const allSaves = () => tx('readonly', s => s.getAll(), 'saves');
const putSave = v => tx('readwrite', s => s.put(v), 'saves');
const delSave = k => tx('readwrite', s => s.delete(k), 'saves');
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

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
  if (f.name.endsWith('.json')) { let m = JSON.parse(new TextDecoder().decode(u8));
    if (m.format === 'fm1-switcher-backup') {
      if (typeof m.firmware !== 'string' || typeof m.project !== 'string' || typeof m.samples !== 'string') throw new Error('not a valid save file');
      await putSave({ ...m, id: m.id || crypto.randomUUID(), label: m.label || `${m.firmware} · ${m.created}` }); return renderSaves();
    }
    return add(m.stock ? (await add(m.stock), (delete m.stock, m)) : m); }
  if (await sha(u8) !== STOCK_SHA) throw new Error('Raw .fwsc files are only accepted for stock V15; use the .json web package for other firmware.');
  return addStock(u8);
}
const addStock = u8 => add({ schema: 1, kind: 'stock', product: 'FM-1_015', profile: 'M-VAVE Original V15', family: 7,
  build_id: STOCK_SHA, sha256: STOCK_SHA, bytes: u8.length, loader_sha256: STOCK_LOADER, data: b64(u8) });

// --- community firmwares: catalogue + packages come from thefirmwarehub.com, pinned by its SHA-256 ---
const HUB = 'https://thefirmwarehub.com/';
const EMU = 'https://joakimeriksson.github.io/fm1-emu/';
const HUB_IDS = ['sloop', 'melodee', 'amb', 'coralflower', 'zen', 'chord', 'fmel', 'frodhes', 'clipper', 'fm106', 'sloopdx', 'tonitor', 'jiant', 'choralroot', 'mono2k', 'karma', 'fm1dock', 'x0x', 'fomni'];
// An older release of the same hub firmware (stored with hubId, or before hubId existed: same name prefix and product).
const sameFw = (m, f) => m.pkg && m.sha256 !== f.sha256 && (m.hubId ? m.hubId === f.id : m.label.startsWith(f.name + ' '));
async function pruneOlder(f) { for (const m of await all()) if (sameFw(m, f)) await del(m.sha256); }
const infoOf = f => ({ what: f.what, author: f.author, editor: f.editor || (f.id === 'fm1dock' ? 'https://joakimeriksson.github.io/fm1-dock/' : undefined), site: f.site, source: f.source, release: f.release, date: f.date, stars: f.stars || 0,
  built: !!(f.provenance && f.provenance.verified === true && f.provenance.sha256 === f.sha256 && /^[0-9a-f]{40}$/.test(f.provenance.commit || '')), commit: f.provenance && f.provenance.commit });
async function addHub(id, cat) {
  cat = cat || await (await fetch(HUB + 'catalog.json', { cache: 'no-store' })).json();
  const f = cat.firmwares.find(x => x.id === id);
  if (!f || !f.pkg) throw new Error(id + ' is not in the hub catalogue');
  const r = await fetch(HUB + f.pkg); if (!r.ok) throw new Error('download failed: HTTP ' + r.status);
  const pkg = new Uint8Array(await r.arrayBuffer());
  if (Felucca.productOf(pkg) !== f.product || await Felucca.sha256hex(pkg) !== f.sha256) throw new Error('package does not match the hub catalogue');
  const olds = (await all()).filter(m => sameFw(m, f));
  await put({ sha256: f.sha256, label: `${f.name} ${f.version}`, info: infoOf(f), updatedFrom: olds[0] && olds[0].release_version, updatedAt: olds.length ? Date.now() : undefined, release_version: f.version, product: f.product,
    bytes: pkg.length, lic: f.lic, chip: f.chip, hubId: id, card: f.card || null, installs: f.installs || 0, kind: f.kind || 'other', pkg });
  await pruneOlder(f); await render();
}
// Firmwares not on the hub: packages kept in this repo, pinned by SHA-256 (GitHub release downloads can't be fetched by a web page).
const EXTRAS = [{ file: 'firmware/garden-main-5e185e6.fwsc', sha256: '2e8e1cb2f9e293dba3b1372bf9b08a9cf401a60acc66a6157c34f94046e9554c', name: 'Garden', version: 'main-5e185e6', product: 'FM-1_900',
  lic: 'GPL-3.0', chip: 'unknown', kind: 'groove', info: { what: 'Garden FM: custom firmware based on JIANT. Not on The Firmware Hub, so not vetted; flash-chip support unknown.', author: 'nvhhh', play: 'https://nvhhh.github.io/Garden-FM/emu/',
  source: 'https://github.com/nvhhh/Garden-FM', release: 'https://github.com/nvhhh/Garden-FM/releases/tag/main-5e185e6', site: 'https://nvhhh.github.io/Garden-FM/flasher/' } }];
async function addExtra(x) {
  const r = await fetch(x.file); if (!r.ok) throw new Error('download failed: HTTP ' + r.status);
  const pkg = new Uint8Array(await r.arrayBuffer());
  if (Felucca.productOf(pkg) !== x.product || await Felucca.sha256hex(pkg) !== x.sha256) throw new Error(x.name + ': package does not match its pinned hash');
  await put({ sha256: x.sha256, label: `${x.name} ${x.version}`, product: x.product, bytes: pkg.length, lic: x.lic, chip: x.chip, kind: x.kind, installs: 0, info: x.info, pkg }); await render();
}
async function runFelucca(m) {
  const bytes = m.pkg || ub64(m.data), stock = m.kind === 'stock';   // stock V15 comes back through the community updater, as the hub does
  if (stock && Felucca.productOf(bytes) !== m.product) throw new Error('not the official V15 package');
  const up = new Felucca.Updater(access, console.log), image = Felucca.logicalImage(bytes), total = 2 * Math.ceil(image.length / 512);
  const step = (k, a) => {
    const t = { start: 'Asking the FM-1…', verify: 'The FM-1 reads the package…', loader: 'Update loader starting (the FM-1 restarts)…', write: 'Writing. Do not unplug.', reboot: 'Restarting…', done: 'Done.' }[k];
    if (t) msg(t); if (typeof a === 'number') $('bar').style.width = Math.min(100, (k === 'write' ? total / 2 + a : a) / total * 100) + '%';
  };
  const ota = await up.find(id => /^ota-/i.test(id.model));
  if (ota) { ota.link.close(); if (!(await up.resume(image, step, stock ? { product: m.product } : {}))) throw new Error('stopped'); }
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
    const fw = (await all()).find(m => m.product === identity);
    out.id = crypto.randomUUID(); out.programs = lib.programs; out.label = `${fw ? fw.label : identity} · ${new Date(out.created).toLocaleString()}`;
    await putSave(out); await renderSaves();
    const url = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `fm1-backup-${out.created.slice(0, 10)}.json` }).click();
    URL.revokeObjectURL(url); localStorage.setItem('fm1-lastBackup', out.created);
    msg('Saved in My saves, and a copy downloaded to your Downloads folder.');
  } catch (e) {
    msg('Backup failed: ' + e.message + '. Backups only work under the official FM1 Open firmware; for other firmwares use their own editor.', true);
  } finally { try { await lib.disconnect(); } catch {} busy = false; $('backup').disabled = !identity; }
}
$('backup').onclick = backup;

// Restore a save onto the FM-1. Same firmware only: formats differ between firmwares. Each write is read back and checked.
async function restore(s) {
  if (busy) return;
  if (!identity) return msg('Connect the FM-1 first.', true);
  if (identity !== s.firmware) return msg(`This save is from ${s.firmware} but the FM-1 is running ${identity}. Switch to that firmware first: saves don't carry across firmwares.`, true);
  if (!confirm(`Restore "${s.label}"?\n\nThis replaces the FM-1's current project, samples and voice banks. Keep the FM-1 plugged in and powered until it finishes.`)) return;
  busy = true; render(); $('emu').hidden = true; const lib = new FM1Web.Library(access);
  try {
    await lib.connect();
    msg('Writing project…'); const proj = ub64(s.project); await lib.upload(0, 0, proj);
    const want = lib.projectPayload(proj), got = await lib.download(0);
    if (got.length !== want.length || got.some((v, i) => v !== want[i])) throw new Error('the project read back differently; nothing more was written');
    msg('Writing samples…'); await lib.samplesWrite(ub64(s.samples), p => $('bar').style.width = (p * 100 || 0) + '%');
    if (s.banks && s.banks.length && lib.programs === 128) for (let i = 0; i < s.banks.length; i++) { msg(`Writing voice bank ${i + 1}…`); await lib.writeBank(i, ub64(s.banks[i])); }
    msg('Restored. Reload the project on the FM-1 if it looks unchanged.');
  } catch (e) { msg('Restore failed: ' + e.message + '. Run Restore again to finish.', true); }
  finally { try { await lib.disconnect(); } catch {} busy = false; render(); }
}
async function renderSaves() {
  const box = $('saveList'), items = (await allSaves()).sort((x, y) => (y.created || '').localeCompare(x.created || ''));
  box.replaceChildren(); $('saveCount').textContent = items.length ? ` (${items.length})` : '';
  for (const s of items) {
    const row = document.createElement('div'); row.className = 'setRow';
    row.append(Object.assign(document.createElement('span'), { textContent: s.label }));
    const btns = document.createElement('span');
    btns.append(
      Object.assign(document.createElement('button'), { textContent: 'Restore', className: 'p', onclick: () => restore(s) }),
      Object.assign(document.createElement('button'), { textContent: 'Export', onclick: () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' }));
        Object.assign(document.createElement('a'), { href: url, download: `fm1-save-${(s.created || '').slice(0, 10)}.json` }).click(); URL.revokeObjectURL(url); } }),
      Object.assign(document.createElement('button'), { textContent: 'Delete', onclick: async () => { if (confirm(`Delete the save "${s.label}"? This cannot be undone.`)) { await delSave(s.id); renderSaves(); } } }));
    row.append(btns); box.append(row);
  }
  if (!items.length) box.textContent = 'No saves yet. Connect an FM-1 running FM1 Open and press Back up.';
}

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
  $('backup').disabled = !identity; $('dot').className = 'dot' + (identity ? ' on' : ''); $('dot').title = identity ? 'Connected' : 'Not connected'; $('dev').textContent = identity || '';
  updateNotice(); render();
}
function updateNotice() {
  const n = $('notice'); n.hidden = true; if (!access) return;
  if (!identity) n.textContent = 'No FM-1 found. Plug it in over USB, switch it on, and close other MIDI apps and tabs. If it still does not appear, hold OCT\u2212 while switching it on to start it in update mode.';
  else if (/^ota-/i.test(identity)) n.textContent = 'The FM-1 is in update mode (' + identity + '). Pick the firmware you were installing to finish the update.';
  else return;
  n.hidden = false;
}

async function render() {
  const items = await all(); $('list').replaceChildren(); $('listOld').replaceChildren();
  const kinds = [...new Set(items.map(m => m.kind).filter(Boolean))].sort(), sel = $('kind');
  if (sel.options.length - 2 !== kinds.length) sel.replaceChildren(new Option('All', ''), new Option('★ Favourites', '__fav'), ...kinds.map(k => new Option(k, k)));
  sel.value = pref('kind'); $('sort').value = pref('sort') || 'name';
  const S = { installs: (a, b) => (b.installs || 0) - (a.installs || 0), stars: (a, b) => ((b.info && b.info.stars) || 0) - ((a.info && a.info.stars) || 0),
    newest: (a, b) => ((b.info && b.info.date) || '').localeCompare((a.info && a.info.date) || ''), name: (a, b) => a.label.localeCompare(b.label) };
  const by = S[$('sort').value] || S.name, q = $('q').value.trim().toLowerCase(), favs = getFavs(), hideOld = $('hideOld').checked;
  const hay = m => [m.label, m.kind, m.info && m.info.what, m.info && m.info.author].join(' ').toLowerCase();
  for (const m of items.filter(m => (!sel.value || (sel.value === '__fav' ? favs.has(favKey(m)) : m.kind === sel.value)) && (!q || hay(m).includes(q)) && !(hideOld && (m.chip === 'old' || m.chip === 'unknown'))).sort(by)) {
    const el = document.createElement('div'); el.className = 'card' + (identity === m.product ? ' cur' : '');
    const src = m.hubId ? HUB + (m.card ? m.card.replace(/^\//, '') : `img/w0/${m.hubId}.webp`) : 'assets/fm1.svg';
    const pic = src ? `<img alt="" src="${esc(src)}">` : esc(m.label.slice(0, 2));
    el.innerHTML = `<div class="pic">${pic}</div><div class="t"><b></b><small></small></div><div class="row"></div>`;
    el.querySelector('b').textContent = m.label;
    const img = el.querySelector('.pic img'); if (img) img.onerror = () => { img.onerror = null; img.src = 'assets/fm1.svg'; };
    el.querySelector('small').textContent = `${m.product} · ${(m.bytes / 1024) | 0} KB` + (m.lic ? ' · ' + m.lic : '') + (identity === m.product ? ' · installed' : '');
    if (m.chip === 'old') el.querySelector('.t').insertAdjacentHTML('beforeend', '<br><span class="badge w" title="Only knows the first FM-1s\' Puya flash chip">old flash chip only</span>');
    else if (m.chip === 'unknown') el.querySelector('.t').insertAdjacentHTML('beforeend', '<br><span class="badge w" title="Not on the Firmware Hub: flash-chip support has not been checked">chip support unknown</span>');
    const sw = Object.assign(document.createElement('button'), { textContent: 'Switch', className: 'p', disabled: !identity || busy });
    sw.onclick = () => run(m);
    const row = el.querySelector('.row');
    const star = Object.assign(document.createElement('button'), { textContent: getFavs().has(favKey(m)) ? '★' : '☆', className: 'star', title: 'Favourite', onclick: () => { toggleFav(m); render(); } });
    el.querySelector('.pic').append(star);
    if (m.updatedAt && Date.now() - m.updatedAt < 14 * 864e5) el.querySelector('.t').insertAdjacentHTML('beforeend', `<br><span class="badge">updated from ${esc(String(m.updatedFrom || 'older'))}</span>`);
    if (!m.hubId && m.info && /^https:\/\//.test(m.info.play || '')) row.append(Object.assign(document.createElement('a'), { textContent: '▶', title: 'Try it in its browser emulator', href: m.info.play, target: '_blank', rel: 'noopener', className: 'try' }));
    if (m.hubId) row.append(Object.assign(document.createElement('a'), { textContent: '▶', title: 'Try it in the browser emulator (fm1-emu), no FM-1 needed', href: EMU + '?fw=' + encodeURIComponent(m.hubId), target: '_blank', rel: 'noopener', className: 'try', onclick: e => { e.preventDefault(); openEmu(m); } }));
    if (m.info && /^https:\/\//.test(m.info.editor || '')) row.append(Object.assign(document.createElement('a'), { textContent: '✎', title: 'Open its editor / backup tool', href: m.info.editor, target: '_blank', rel: 'noopener', className: 'try' }));
    row.append(Object.assign(document.createElement('button'), { textContent: 'ⓘ', title: 'Details', className: 'ic', onclick: () => showInfo(m) }));
    row.append(sw); $(m.chip === 'old' || m.chip === 'unknown' ? 'listOld' : 'list').append(el);
  }
  $('bFav').classList.toggle('on', sel.value === '__fav'); $('bOld').classList.toggle('on', hideOld);
  $('old').hidden = !items.some(m => m.chip === 'old' || m.chip === 'unknown');
  if (!items.length) $('list').innerHTML = '<p class="sub">Loading firmwares…</p>';
}
const favKey = m => m.hubId || m.sha256;
const getFavs = () => { try { return new Set(JSON.parse(localStorage.getItem('fm1-favs') || '[]')); } catch { return new Set(); } };
const toggleFav = m => { const f = getFavs(), k = favKey(m); f.has(k) ? f.delete(k) : f.add(k); try { localStorage.setItem('fm1-favs', JSON.stringify([...f])); } catch {} };
function showInfo(m) {
  const i = m.info || {}, box = $('infoBody'); box.replaceChildren();
  const row = (k, v) => { if (!v) return; const d = document.createElement('div'); d.className = 'setRow'; d.append(Object.assign(document.createElement('span'), { textContent: k }), Object.assign(document.createElement('span'), { textContent: v })); box.append(d); };
  $('infoTitle').textContent = m.label;
  if (i.what) box.append(Object.assign(document.createElement('p'), { textContent: i.what, className: 'sub', style: 'margin:6px 0' }));
  row('Author', i.author); row('Licence', m.lic); row('Released', i.date); row('Identity', m.product); row('Hub installs', m.installs ? String(m.installs) : ''); row('GitHub stars', i.stars ? String(i.stars) : '');
  row('Flash chip', { old: 'Older chip only: saving may fail on newer FM-1s', new: 'Both FM-1 flash chips', any: 'Either chip', unknown: 'Unknown: not checked by the hub' }[m.chip]);
  row('Built from source', i.built ? 'Yes, GitHub signed this exact file' + (i.commit ? ` (commit ${i.commit.slice(0, 7)})` : '') : m.pkg ? 'Not verified by the hub' : '');
  const links = document.createElement('div'); links.className = 'setRow';
  for (const [t, u] of [['Release notes', i.release], ['Source', i.source], ['Project site', i.site], ['Editor', i.editor]]) if (/^https:\/\//.test(u || '')) links.append(Object.assign(document.createElement('a'), { textContent: t, href: u, target: '_blank', rel: 'noopener' }));
  if (links.children.length) box.append(links);
  $('info').showModal();
}
$('infoClose').onclick = () => $('info').close();
$('q').oninput = () => render(); $('hideOld').onchange = e => { pref('hideOld', e.target.checked ? '1' : ''); render(); };
const pref = (k, v) => { try { if (v !== undefined) localStorage.setItem('fm1-' + k, v); return localStorage.getItem('fm1-' + k) || ''; } catch { return ''; } };
$('hideOld').checked = !!pref('hideOld');
$('sort').onchange = e => { pref('sort', e.target.value); render(); };
$('kind').onchange = e => { pref('kind', e.target.value); render(); };
const PALETTES = ['cream', 'lilac', 'graphite', 'orange', 'blue', 'mint'];
const setPalette = p => { document.documentElement.dataset.palette = p; pref('palette', p); document.querySelectorAll('.sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === p)); };
document.querySelectorAll('.sw').forEach(b => b.onclick = () => setPalette(b.dataset.p));
$('palBtn').onclick = () => $('palettes').showModal();
$('palClose').onclick = () => $('palettes').close();
setPalette(PALETTES.includes(pref('palette')) ? pref('palette') : 'cream');
// Device controls: the knobs cycle sort / category, the buttons are shortcuts to filters and panels. The LCD shows what changed.
const lcdHint = t => { const h = $('hint'); h.textContent = t; h.classList.add('on'); clearTimeout(lcdHint.t); lcdHint.t = setTimeout(() => h.classList.remove('on'), 1600); };
const cycle = (btn, sel) => { sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length; sel.dispatchEvent(new Event('change')); btn.style.setProperty('--rot', sel.selectedIndex * 48 + 'deg'); lcdHint(sel.options[sel.selectedIndex].text); };
$('kSort').onclick = () => cycle($('kSort'), $('sort'));
$('kShow').onclick = () => cycle($('kShow'), $('kind'));
$('bFav').onclick = () => { const s = $('kind'); s.value = s.value === '__fav' ? '' : '__fav'; s.dispatchEvent(new Event('change')); lcdHint(s.value ? 'favourites' : 'all'); };
$('bOld').onclick = () => { const c = $('hideOld'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); lcdHint(c.checked ? 'older chip hidden' : 'older chip shown'); };
const openPanel = id => { const d = $(id); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
$('bSaves').onclick = () => openPanel('savesBox'); $('bRescue').onclick = () => openPanel('rescue');
// Flash history: what this browser switched to, newest first.
const hist = () => { try { return JSON.parse(localStorage.getItem('fm1-history') || '[]'); } catch { return []; } };
const showHist = () => { $('hist').textContent = hist().length ? 'Recent switches: ' + hist().slice(0, 5).map(h => `${h.label} (${new Date(h.at).toLocaleDateString()})`).join(' · ') : ''; };
const logHist = m => { try { localStorage.setItem('fm1-history', JSON.stringify([{ label: m.label, product: m.product, at: Date.now() }, ...hist()].slice(0, 20))); } catch {} showHist(); };
showHist(); renderSaves();
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
  const oldChip = meta.chip === 'unknown' ? '\n\nWARNING: this firmware is not listed on The Firmware Hub, so nobody has vetted it, and its flash-chip support is unknown. On a newer FM-1 saving may fail.' : meta.chip === 'old' ? '\n\nWARNING: this version only knows the first FM-1s\' flash chip (Puya). On a newer FM-1 (UC25HQ80, common on AliExpress units) saving may fail and later updates from it may not work. Only continue if you know your unit has the older chip.' : '';
  if (!confirm(`Switch the FM-1 to "${meta.label}"?\n\nBack up first (the Back up button works under official FM1 Open firmware only). Do not unplug or power off until it finishes.${oldChip}`)) return;
  busy = true; render(); $('bar').style.width = '0';
  try {
    const community = identity && !/^(FM1_OFFICIAL_OPEN|FM1_COMMUNITY_\d+|FM-1_8\d{6}|FM-1_015)$/.test(identity);
    if (meta.pkg || (meta.kind === 'stock' && community)) { if (meta.kind === 'stock') await FM1Web.prepare(meta); await runFelucca(meta); msg('Done: now running ' + meta.label); logHist(meta); await probe(); busy = false; return render(); }
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
  await render(); renderSaves(); const have = new Set([...(await all()).map(m => m.sha256), ...removed()]), jobs = [];
  if (!have.has('7e7b6d260163cdf9d716f7fab44f19be600edeffcd390de74370b83c917fd0c6')) jobs.push(() => fetch('firmware/fm1-open-v14.json').then(r => r.json()).then(add));
  if (!have.has(STOCK_SHA)) jobs.push(() => fetch(STOCK_URL).then(r => r.arrayBuffer()).then(b => addStock(new Uint8Array(b))));
  const cat = await fetch(HUB + 'catalog.json').then(r => r.json()).catch(() => ({ firmwares: [] }));
  for (const m of await all()) { const f = cat.firmwares.find(x => HUB_IDS.includes(x.id) && x.sha256 === m.sha256); if (f && (!m.hubId || m.installs === undefined || m.card === undefined || m.info === undefined)) await put({ ...m, info: infoOf(f), hubId: f.id, card: f.card || null, installs: f.installs || 0, kind: f.kind || 'other' }); }
  for (const id of HUB_IDS) { const f = cat.firmwares.find(x => x.id === id); if (!f) continue; if (have.has(f.sha256)) await pruneOlder(f); else jobs.push(() => addHub(id, cat)); }
  for (const x of EXTRAS) if (!have.has(x.sha256)) jobs.push(() => addExtra(x));
  if (jobs.length) msg('Loading firmwares…');
  for (const j of jobs) await j().catch(e => msg(e.message, true));
  if (jobs.length && !$('msg').className) msg('');
})().catch(e => msg('Could not load the firmware library: ' + e.message, true));
