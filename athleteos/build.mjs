// Builds the Athlete suite artifact, one bundle with one shared database:
//   dist/index.html     Hub (the front door: every app in one place), dist/athlete.html Athlete OS (src/)
//   dist/macrolens.html MacroLens copy    (vendor/macrolens.html = macrolens/artifact.html from the MacroLens branch, unchanged)
//   dist/gameplan.html  Gameplan copy     (vendor/gameplan.html  = gameplan/artifact.html, restyled with the suite look)
//   dist/btc.html       Basketball Training Center (vendor/btc.html = its published page, restyled, connected by src/suite/btc-bridge.js)
// Every page gets the same app switcher (src/suite/suite.js + suite.css) in place of its brand, and one theme setting.
// Usage: node athleteos/build.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');
const vendor = (f) => readFileSync(join(here, 'vendor', f), 'utf8');
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
const JS = ['icons.js', 'store.js', 'data.js', 'charts.js', 'shell.js', 'home.js', 'analytics.js', 'hoops.js', 'tests.js', 'coach.js', 'sheets.js', 'library.js', 'intel.js', 'train.js', 'calendar.js', 'routines.js', 'load.js', 'goals.js', 'mind.js', 'hoops2.js', 'analytics2.js', 'director.js', 'profile.js', 'hub.js', 'gameplan.js', 'intel2.js', 'labengine.js', 'lab.js', 'lab2.js', 'signals.js', 'visuals.js', 'today.js', 'command.js', 'patterns.js', 'school.js', 'dash2.js', 'events.js', 'ecohub.js', 'look.js', 'main.js'];
const SUITE_JS = src('suite/suite.js'), SUITE_CSS = src('suite/suite.css');
const out = join(here, 'dist');
mkdirSync(out, { recursive: true });
const swap = (html, from, to, what) => { if (!html.includes(from)) throw new Error(`${what}: anchor not found`); return html.replace(from, () => to); };
const DAYMERGE = `<script>\n${src('suite/daymerge.js')}\n</script>\n`;
// Every page loads the day-record merge layer before any of its own scripts.
const firstScript = (html) => { const i = html.indexOf('<script'); if (i < 0) throw new Error('no script'); return html.slice(0, i) + DAYMERGE + html.slice(i); };
const beforeLastScript = (html, add) => { const i = html.lastIndexOf('</script>') + '</script>'.length; return html.slice(0, i) + '\n' + add + html.slice(i); };

// ---------- Athlete OS ----------
const page = src('index.html')
  .replace('/*CSS*/', () => src('os.css') + '\n' + SUITE_CSS + '\n' + src('look.css'))
  .replace('/*JS*/', () => `// ---- suite.js ----\n${SUITE_JS}\n` + JS.map((f) => `// ---- ${f} ----\n${src(f)}`).join('\n'));
const pageDm = firstScript(page);
writeFileSync(join(out, 'athlete.html'), SKELETON + pageDm + '\n</body></html>\n');
// School is Student Lens now (student.html); old links to school.html forward there.
writeFileSync(join(out, 'school.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Student Lens</title><meta http-equiv="refresh" content="0;url=student.html"></head><body><script>location.replace(\'student.html\' + location.hash);</script><a href="student.html">Open Student Lens</a></body></html>\n');
// Hub: the ecosystem app (opens every app, one agenda, cross-app graphs), the same bundle in "hub" mode.
writeFileSync(join(out, 'index.html'), SKELETON + pageDm.replace('<title>Athlete OS</title>', '<title>Hub</title>').replace('<script>', '<script>window.APP_MODE = "hub";</script>\n<script>') + '\n</body></html>\n');

// ---------- MacroLens (unchanged app; only its brand becomes the suite switcher) ----------
let ml = vendor('macrolens.html');
ml = swap(ml, '<div class="brand">Macro<i>Lens</i></div>', '<div class="brand" id="suite-host"><span class="suite-fallback">Macro<i>Lens</i></span></div>', 'MacroLens brand');
ml = beforeLastScript(ml, `<style>${SUITE_CSS}
@media (max-width: 430px) { #suite-host .suite-mark { display: none; } #suite-host .suite-btn { gap: 4px; font-size: 17px; } }</style>
<script>
${SUITE_JS}
// Suite bridge: switcher (saves before leaving), and open a section from the link that brought you here (macrolens.html#coach-schedule).
Suite.mount(document.getElementById('suite-host'), 'ml', () => flush());
window.addEventListener('pagehide', () => { try { if (pending.size) flush(); } catch {} });
(function openFromHash() {
  const [v, g] = location.hash.slice(1).split('-');
  if (!['today', 'coach', 'progress', 'profile'].includes(v)) return;
  showView(v);
  if (v === 'coach' && g && typeof setCoachGroup === 'function') setCoachGroup(g);
})();
</script>`);
writeFileSync(join(out, 'macrolens.html'), SKELETON + firstScript(ml) + '\n</body></html>\n');

// ---------- Gameplan (shares this artifact's storage: keys "ml:gp-…", docs "gp-…"; restyled with the suite look) ----------
let gp = vendor('gameplan.html');
gp = swap(gp, '<div><h1>Game<span>plan</span></h1>', '<div><div id="suite-host" class="gp-suite"></div><h1 class="gp-sr">Gameplan</h1>', 'Gameplan brand');
gp = swap(gp, '</style>', `</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">\n<style>${src('suite/gameplan-skin.css')}\n${SUITE_CSS}</style>`, 'Gameplan style');
gp = swap(gp, '\n<script>\n', `\n<script>\n${SUITE_JS}\nSuite.theme();\nwindow.GP_EMBED = { prefix: 'ml:gp-', docPrefix: 'gp-', aosKey: 'ml:aos-plan' };\n</script>\n<script>\n`, 'Gameplan script');
gp = beforeLastScript(gp, `<script>
// Suite bridge: the switcher finishes saving before leaving, and Gameplan publishes its weekly signals (doc "gp-sig").
async function gpSave() { const t0 = Date.now(); flush(); while ((pending.size || flushing) && Date.now() - t0 < 2500) { await new Promise((r) => setTimeout(r, 100)); if (pending.size && !flushing) flush(); } }
Suite.mount(document.getElementById('suite-host'), 'gp', gpSave);
function gpSignals() {
  try {
    const t = todayIso(), mon = mondayOf(t), days = Array.from({ length: 7 }, (_, i) => shiftIso(mon, i));
    const busy = Object.fromEntries(days.map((d) => [d, (day(d, false)?.blocks || []).filter((b) => b.type !== 'sleep').reduce((a, b) => a + (Number(b.mins) || 0), 0)]));
    const school = Object.fromEntries(days.map((d) => [d, (day(d, false)?.blocks || []).filter((b) => b.type === 'school' || b.type === 'focus').reduce((a, b) => a + (Number(b.mins) || 0), 0)]));
    const s = { v: 1, app: 'gp', week: mon, updated: t, busyMinsByDay: busy, schoolMinsByDay: school, openTasks: core().tasks.filter((x) => !x.done).length, top3Today: topFor(t).map((x) => x.title).slice(0, 3), bed: core().routine.bed, wake: core().routine.wake };
    const cur = doc('sig') || {}; if (JSON.stringify({ ...cur, updated: 0 }) === JSON.stringify({ ...s, updated: 0 })) return;
    cache.sig = s; persist('sig');
  } catch (e) { console.error(e); }
}
setTimeout(gpSignals, 1500);
window.addEventListener('pagehide', () => { try { gpSignals(); if (pending.size) flush(); } catch {} });
</script>`);
writeFileSync(join(out, 'gameplan.html'), SKELETON + firstScript(gp) + '\n</body></html>\n');
// ---------- Basketball Training Center (vendor/btc.html = its published page; storage renamed into the suite) ----------
let btc = vendor('btc.html');
btc = swap(btc, "const KEY = 'btc-training-center-v1';", "const KEY = 'ml:btc-local';", 'Training Center storage key');
btc = swap(btc, "ns.doc('data/users/' + id + '/app')", "ns.doc('data/users/' + id + '/btc-app')", 'Training Center account doc');
btc = swap(btc, '<div class="eyebrow">Player development</div>', '<div id="suite-host"></div>', 'Training Center brand');
btc = swap(btc, '</style>', `</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">\n<style>${src('suite/btc-skin.css')}\n${SUITE_CSS}</style>\n<script>\n${SUITE_JS}\nSuite.theme();\n</script>`, 'Training Center style');
btc = beforeLastScript(btc, `<script>\n${src('suite/btc-bridge.js')}\n</script>`);
writeFileSync(join(out, 'btc.html'), firstScript(btc));
// ---------- Recovery Lens (vendor/recovery.html = its published page; built to be page 6 of this bundle) ----------
let rlp = vendor('recovery.html');
rlp = swap(rlp, "  { id: 'aos', plain: 'Athlete OS', href: 'index.html',", "  { id: 'hub', plain: 'Hub', href: 'index.html', desc: 'Every app in one place: your day, alerts and graphs', color: '#14b8a6' },\n  { id: 'aos', plain: 'Athlete OS', href: 'athlete.html',", 'Recovery Lens app list');
rlp = swap(rlp, 'data-nav href="index.html"', 'data-nav href="athlete.html"', 'Recovery Lens Athlete OS link');
rlp = swap(rlp, "{ id: 'school', plain: 'School', href: 'school.html', desc: 'Classes, assignments, tests and grades', color: '#0ea5e9' }", "{ id: 'school', plain: 'Student Lens', href: 'student.html', desc: 'Classes, assignments, grades, studying and exams', color: '#6d7cff' }", 'Recovery Lens Student Lens entry');
writeFileSync(join(out, 'recovery.html'), firstScript(rlp));
// ---------- Student Lens (vendor/student-lens = its published files, unchanged; connected by src/suite/sl-bridge.js) ----------
// Multi-file: student.html plus app.css, js/*.js and vendor/pdf*.js at the bundle root (published with the page's files).
const SLD = join(here, 'vendor', 'student-lens');
let sl = readFileSync(join(SLD, 'index.html'), 'utf8');
sl = swap(sl, '<a class="brand" href="#home" style="text-decoration:none;color:inherit"><span class="mark" id="brand-mark"></span><b>Student<span>Lens</span></b></a>', '<span id="brand-mark" hidden></span><div class="brand" id="suite-host-side"></div>', 'Student Lens brand');
sl = swap(sl, '<div class="crumb grow" id="crumb"></div>', '<div id="suite-host" class="sl-top-suite"></div><div class="crumb grow" id="crumb"></div>', 'Student Lens header');
sl = swap(sl, '</head>', `<style>${SUITE_CSS}
.suite { --surface: var(--panel); --surface-2: var(--raised); }
#suite-host-side { padding: 4px 4px 18px; }
.sl-top-suite { display: none; }
@media (max-width: 960px) { .sl-top-suite { display: flex; flex: none; } .sl-top-suite .suite-name { display: none; } }</style>
</head>`, 'Student Lens head');
sl = swap(sl, '<script src="js/app.js', `<script>\n${SUITE_JS}\n</script>\n<script>\n${src('suite/sl-bridge.js')}\n</script>\n<script src="js/app.js`, 'Student Lens boot');
writeFileSync(join(out, 'student.html'), sl);
for (const f of ['app.css', 'js', 'vendor']) cpSync(join(SLD, f), join(out, f), { recursive: true });
console.log('built', ['index.html', 'athlete.html', 'school.html', 'student.html', 'macrolens.html', 'gameplan.html', 'btc.html', 'recovery.html'].map((f) => join(out, f)).join(' '));
