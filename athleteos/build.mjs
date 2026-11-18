// Builds the Athlete OS artifact: dist/index.html (Athlete OS) + dist/macrolens.html (MacroLens) + dist/gameplan.html (Gameplan), one database.
// Usage: node athleteos/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
const JS = ['icons.js', 'store.js', 'data.js', 'charts.js', 'shell.js', 'home.js', 'analytics.js', 'hoops.js', 'tests.js', 'coach.js', 'sheets.js', 'library.js', 'intel.js', 'train.js', 'calendar.js', 'routines.js', 'load.js', 'goals.js', 'mind.js', 'hoops2.js', 'analytics2.js', 'director.js', 'profile.js', 'hub.js', 'gameplan.js', 'intel2.js', 'main.js'];

const out = join(here, 'dist');
mkdirSync(out, { recursive: true });
const page = src('index.html').replace('/*CSS*/', () => src('os.css')).replace('/*JS*/', () => JS.map((f) => `// ---- ${f} ----\n${src(f)}`).join('\n'));
writeFileSync(join(out, 'index.html'), SKELETON + page + '\n</body></html>\n');

// MacroLens: the live build plus a way back to Athlete OS and #view-group deep links (e.g. macrolens.html#coach-schedule).
let ml = readFileSync(join(here, '..', 'macrolens', 'live', 'index.html'), 'utf8');
const brand = '<div class="brand">Macro<i>Lens</i></div>';
if (!ml.includes(brand)) throw new Error('MacroLens brand anchor not found');
ml = ml.replace(brand, '<div class="brand"><a class="os-back" href="index.html" aria-label="Back to Athlete OS">‹ OS</a>Macro<i>Lens</i></div>');
const bridge = `<style>.os-back{display:inline-flex;align-items:center;margin-right:8px;padding:4px 9px;border-radius:9px;font:600 12px var(--f-body);text-decoration:none;color:#fff;background:linear-gradient(135deg,var(--accent),var(--purple));vertical-align:2px}</style>
<script>
// Athlete OS bridge: save before leaving, and open a section from the link that brought you here.
document.querySelector('.os-back').addEventListener('click', async (e) => {
  e.preventDefault();
  try { await Promise.race([flush(), new Promise((r) => setTimeout(r, 2500))]); } catch {}
  location.href = 'index.html';
});
window.addEventListener('pagehide', () => { try { if (pending.size) flush(); } catch {} });
(function openFromHash() {
  const [v, g] = location.hash.slice(1).split('-');
  if (!['today', 'coach', 'progress', 'profile'].includes(v)) return;
  showView(v);
  if (v === 'coach' && g && typeof setCoachGroup === 'function') setCoachGroup(g);
})();
</script>
`;
const end = ml.lastIndexOf('</body>');
ml = ml.slice(0, end) + bridge + ml.slice(end);
writeFileSync(join(out, 'macrolens.html'), ml);

// Gameplan: the Gameplan build (vendor/gameplan.html, from gameplan/artifact.html) told to share this artifact's storage,
// with a way back to Athlete OS. Its keys become "ml:gp-…" and its docs "gp-…", so Athlete OS can read its schedule.
let gp = readFileSync(join(here, 'vendor', 'gameplan.html'), 'utf8');
const gpBrand = '<div><h1>Game<span>plan</span></h1>';
if (!gp.includes(gpBrand) || !gp.includes('\n<script>\n')) throw new Error('Gameplan anchors not found');
gp = gp.replace(gpBrand, '<div><a class="os-back" href="index.html" aria-label="Back to Athlete OS">‹ OS</a><h1>Game<span>plan</span></h1>');
gp = gp.replace('\n<script>\n', `\n<style>.os-back{display:inline-flex;align-items:center;margin-bottom:6px;padding:4px 10px;border-radius:9px;font:600 12px var(--f-body);text-decoration:none;color:var(--accent-ink);background:var(--accent)}</style>
<script>window.GP_EMBED = { prefix: 'ml:gp-', docPrefix: 'gp-', aosKey: 'ml:aos-plan' };</script>
<script>\n`);
const gpBridge = `<script>
// Athlete OS bridge: finish saving before going back so Athlete OS loads the newest schedule.
document.querySelector('.os-back').addEventListener('click', async (e) => {
  e.preventDefault();
  const t0 = Date.now();
  try { flush(); while ((pending.size || flushing) && Date.now() - t0 < 2500) { await new Promise((r) => setTimeout(r, 100)); if (pending.size && !flushing) flush(); } } catch {}
  location.href = 'index.html';
});
window.addEventListener('pagehide', () => { try { if (pending.size) flush(); } catch {} });
</script>
`;
const gEnd = gp.lastIndexOf('</script>') + '</script>'.length;
gp = SKELETON + gp.slice(0, gEnd) + '\n' + gpBridge + gp.slice(gEnd) + '\n</body></html>\n';
writeFileSync(join(out, 'gameplan.html'), gp);
console.log('built', join(out, 'index.html'), join(out, 'macrolens.html'), join(out, 'gameplan.html'));
