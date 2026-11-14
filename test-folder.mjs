// Self-check for the backup-folder helpers in app.js (fake directory, no browser). Run: node test-folder.mjs
import { readFileSync } from 'node:fs';
const src = readFileSync('app.js', 'utf8');
const grab = n => { const i = src.indexOf(n); return src.slice(i, src.indexOf('\n}', i) + 2); };
const fileFor = eval('(' + src.match(/const fileFor = (.*);\n/)[1] + ')');
const folderBackups = new Function('folderReady', 'return ' + grab('async function folderBackups').replace('async function folderBackups', 'async function'))(async () => dir);
const names = ['fm1-backup-FM-1_8000014-2026-11-14T15-00-00-000Z.json', 'fm1-backup-FM-1_8000014-2026-11-09T10-00-00-000Z.json', 'fm1-backup-FM-1_800-2026-11-20T00-00-00-000Z.json', 'notes.txt', 'fm1-backup-FM-1_8000014-2026-11-20T09-00-00-000Z.bak'];
const dir = { entries: async function* () { for (const n of names) yield [n, { kind: 'file' }]; } };
const r = await folderBackups('FM-1_8000014');
console.assert(r.length === 2 && r[0].name.includes('11-14'), 'newest first, exact firmware only', r.map(x => x.name));
console.assert((await folderBackups()).length === 3, 'all json backups when no firmware given');
console.assert(fileFor({ firmware: 'FM-1_8000014', created: '2026-11-14T15:00:00.000Z' }) === names[0], 'filename', fileFor({ firmware: 'FM-1_8000014', created: '2026-11-14T15:00:00.000Z' }));
console.log('folder checks ok');
