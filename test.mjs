// Self-check: the official parser accepts the real stock V15 package. Run: node test.mjs <FM-1_015.fwsc>
import { readFileSync } from 'node:fs'; import vm from 'node:vm'; import { webcrypto } from 'node:crypto';
const ctx = { globalThis: null, crypto: webcrypto, location: { href: 'http://x/' }, atob, setTimeout, clearTimeout, console };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(readFileSync('webupdate.js', 'utf8'), ctx);
const b = vm.runInContext("(b)=>new Uint8Array(b)", ctx)(readFileSync(process.argv[2])); const p = ctx.FM1Web.inspectPackage(b, true);
if (p.product !== 'FM-1_015') throw new Error('bad product'); console.log('ok', p.product, p.image.length);
