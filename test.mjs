// Self-check: the official parser accepts the real stock V15 package. Run: node test.mjs <FM-1_015.fwsc>
import { readFileSync } from 'node:fs'; import vm from 'node:vm'; import { webcrypto } from 'node:crypto';
const ctx = { globalThis: null, crypto: webcrypto, location: { href: 'http://x/' }, atob, setTimeout, clearTimeout, console };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(readFileSync('webupdate.js', 'utf8'), ctx);
const b = vm.runInContext("(b)=>new Uint8Array(b)", ctx)(readFileSync(process.argv[2])); const p = ctx.FM1Web.inspectPackage(b, true);
if (p.product !== 'FM-1_015') throw new Error('bad product'); console.log('ok', p.product, p.image.length);
// Bundled packages must pass the official prepare() (hash + loader + identity checks).
const m = JSON.parse(readFileSync('firmware/fm1-open-v14.json', 'utf8'));
const pkg = await ctx.FM1Web.prepare(m); console.log('ok prepare', pkg.product, pkg.loaderIdentity);
// Hub community packages: the extracted updater must recognise the live hub packages and match the catalogue pin.
vm.runInContext(readFileSync('felucca.js', 'utf8'), ctx);
const cat = await (await fetch('https://thefirmwarehub.com/catalog.json')).json();
for (const id of ['sloop', 'melodee', 'amb']) {
  const f = cat.firmwares.find(x => x.id === id);
  const pkg = vm.runInContext('(b)=>new Uint8Array(b)', ctx)(await (await fetch('https://thefirmwarehub.com/' + f.pkg)).arrayBuffer());
  if (ctx.Felucca.productOf(pkg) !== f.product || await ctx.Felucca.sha256hex(pkg) !== f.sha256) throw new Error(id + ' mismatch');
  ctx.Felucca.logicalImage(pkg); console.log('ok hub', id, f.version, f.product, f.lic);
}
for (const id of ['coralflower', 'zen', 'chord', 'fmel', 'frodhes', 'clipper', 'fm106', 'sloopdx', 'tonitor', 'jiant', 'choralroot']) {
  const f = cat.firmwares.find(x => x.id === id);
  const pkg = vm.runInContext('(b)=>new Uint8Array(b)', ctx)(await (await fetch('https://thefirmwarehub.com/' + f.pkg)).arrayBuffer());
  if (ctx.Felucca.productOf(pkg) !== f.product || await ctx.Felucca.sha256hex(pkg) !== f.sha256) throw new Error(id + ' mismatch');
  ctx.Felucca.logicalImage(pkg); console.log('ok hub', id, f.version, f.product, 'chip', f.chip);
}
