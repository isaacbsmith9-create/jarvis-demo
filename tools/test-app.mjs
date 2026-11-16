// End-to-end check of Baseline on an iPhone-sized viewport with realistic data from every app.
// Usage: node tools/test-app.mjs [shots-dir]   Serves app/ locally, seeds localStorage, visits every screen in
// light and dark mode, exercises the main flows, and fails on page errors or horizontal scrolling.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const root = new URL('../app/', import.meta.url).pathname, shots = process.argv[2] || '/tmp/baseline-shots';
await mkdir(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

// ---------- realistic seed data (same shapes the original apps write) ----------
function seed(nowIso) {
  const s = {}, pad = (n) => String(n).padStart(2, '0'), iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shift = (i, n) => { const d = new Date(i + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const wd = (i) => (new Date(i + 'T12:00:00').getDay() + 6) % 7;
  let seedN = 11; const rnd = () => ((seedN = (seedN * 9301 + 49297) % 233280) / 233280);
  const F = (name, serving, calories, protein, carbs, fat, extra = {}) => ({ id: 'b' + name.length, source: 'built-in', name, serving, calories, protein, carbs, fat, fiber: 2, sugar: 3, sodium: 300, iron: 1, calcium: 60, ...extra });
  const foods = { eggs: F('Egg, large', '1 egg', 72, 6, 0.4, 5), oats: F('Oatmeal, cooked', '1 cup', 166, 6, 28, 3.6), banana: F('Banana', '1 medium', 105, 1.3, 27, 0.4), milk: F('Milk, 2%', '1 cup', 122, 8, 12, 5),
    chicken: F('Chicken breast, grilled', '4 oz', 187, 35, 0, 4), rice: F('White rice, cooked', '1 cup', 205, 4, 45, 0.4), burrito: F('Burrito, chicken', '1 burrito', 650, 40, 70, 22), shake: F('Whey protein shake (water)', '1 scoop', 120, 24, 3, 1.5),
    pasta: F('Spaghetti with meat sauce', '1.5 cups', 480, 25, 60, 15), pb: F('PB&J sandwich', '1 sandwich', 380, 12, 50, 16), yogurt: F('Greek yogurt, nonfat plain', '1 cup', 130, 23, 9, 0), gatorade: F('Sports drink', '20 oz bottle', 140, 0, 36, 0) };
  s['ml:core'] = { profile: { age: 16, sex: 'male', heightIn: 71, weightLb: 158, activity: 'athlete', goal: 'gain' }, targets: { bmr: 1760, tdee: 3340, calories: 3640, protein: 158, carbs: 499, fat: 109, waterOz: 103 }, overrides: {},
    custom: [{ id: 'c1', source: 'custom', name: 'Mom\'s chicken pasta', serving: '1 plate', calories: 720, protein: 45, carbs: 80, fat: 22 }], recents: [foods.eggs, foods.chicken, foods.shake], weights: [], goalW: { lb: 165, date: shift(nowIso, 90) },
    meals: [{ id: 'm1', name: 'Egg, large + 2 more', items: [{ ...foods.eggs, servings: 3 }, { ...foods.oats, servings: 1 }, { ...foods.milk, servings: 1 }] }] };
  const tasks = [];
  s['gp:core'] = { tasks, routine: { steps: [{ id: 'bag', label: 'Pack bag and lay out clothes' }, { id: 'plan', label: "Plan tomorrow's Top 3" }, { id: 'charge', label: 'Phone on the charger, outside the room' }, { id: 'stretch', label: 'Stretch 5 min' }, { id: 'lights', label: 'Lights out' }], bed: '22:30', wake: '06:45', wind: 45 }, running: null, settings: { phoneGoal: 120 } };
  s['wb:core'] = { settings: { school: '15:15', bed: '22:30', wkstart: '09:00', max: 120 }, rules: [{ id: 'r1', title: 'Varsity practice', type: 'practice', days: [0, 1, 2, 3, 4], start: '15:45', mins: 120 }, { id: 'r2', title: 'Lift', type: 'lift', days: [1, 3], start: '06:30', mins: 45 }, { id: 'r3', title: 'Shift at work', type: 'work', days: [5], start: '10:00', mins: 240 }], tray: [{ id: 't1', title: 'Chem lab report', type: 'homework', mins: 60, due: shift(nowIso, 3) }] };
  s['ru:core'] = { settings: { wake: '06:45', goal: 9, sport: 'basketball, guard' } };
  s['ch:core'] = { settings: { goal: 10, accent: 'es-MX', rate: 0.9, autoplay: true, english: false }, setup: { level: 'Spanish 2', topic: 'Los deportes', grammar: 'Any' }, words: [{ es: 'el entrenador', en: 'the coach', box: 2, due: nowIso, added: shift(nowIso, -5) }, { es: 'ganar', en: 'to win', box: 1, due: nowIso, added: shift(nowIso, -3) }, { es: 'la cancha', en: 'the court', box: 5, due: shift(nowIso, 20), added: shift(nowIso, -20) }] };
  for (let i = 34; i >= 0; i--) {
    const d = shift(nowIso, -i), w = wd(d), school = w < 5, tr = (34 - i) / 34;
    const day = { breakfast: [{ ...foods.eggs, servings: 3, addedAt: 0 }, { ...foods.oats, servings: 1 }, { ...foods.banana, servings: 1 }], lunch: [{ ...foods.burrito, servings: 1 }], dinner: i === 0 ? [] : [{ ...foods.chicken, servings: 2 }, { ...foods.rice, servings: 1.5 }], snacks: [{ ...foods.shake, servings: rnd() < 0.7 ? 1 : 2 }, ...(rnd() < 0.5 ? [{ ...foods.pb, servings: 1 }] : []), ...(school ? [{ ...foods.gatorade, servings: 1 }] : [])], water: Math.round(48 + rnd() * 60) };
    if (i === 0) day.water = 40;
    if (!school && rnd() < 0.4) day.type = 'rest';
    s['ml:day-' + d] = day;
    const sleep = Math.round((6.6 + rnd() * 2.4 + tr * 0.4) * 10) / 10;
    s['ru:day-' + d] = { checkin: rnd() < 0.85 || i === 0 ? { bed: '22:45', wake: '06:45', sleepH: sleep, quality: 3 + Math.round(rnd()), soreness: 2 + Math.round(rnd() * 2), energy: 3 + Math.round(rnd()), stress: 2 + Math.round(rnd()), areas: ['Legs'], pain: false, painWhere: '', rhr: 58 + Math.round(rnd() * 4), at: 0 } : null,
      sessions: i === 0 ? [] : school ? [{ type: 'Practice', mins: 120, rpe: 6 + Math.round(rnd() * 2) }, ...(w === 1 || w === 3 ? [{ type: 'Lifting', mins: 45, rpe: 7 }] : [])] : rnd() < 0.5 ? [{ type: 'Skill work', mins: 60, rpe: 5 }] : [] };
    const entries = [{ cat: 'phone', mins: Math.round(160 - 60 * tr + rnd() * 60) }, { cat: 'homework', mins: school ? Math.round(30 + rnd() * 60) : 0 }, { cat: 'gaming', mins: Math.round(rnd() * 90) }, { cat: 'people', mins: Math.round(rnd() * 60) }];
    if (school && i) entries.push({ cat: 'school', mins: 420 }, { cat: 'practice', mins: 120 });
    s['gp:d-' + d] = { blocks: i === 0 ? [{ id: 'b1', title: 'Form shooting, 200 makes', start: '19:00', mins: 45, type: 'train', done: false }] : [], entries: entries.filter((e) => e.mins > 0).map((e, k) => ({ id: d + k, ...e, start: new Date(d + 'T15:00:00').getTime() })), night: { done: rnd() < 0.6 ? { bag: true, charge: true, stretch: true, lights: true } : { bag: true }, completedAt: null } };
    if (i < 12) for (let k = 0; k < 3; k++) tasks.push({ id: 'k' + i + k, title: ['Film study: pick-and-roll reads', 'Chem worksheet', 'Ball handling: 300 reps', 'Email coach about camp'][k + (i % 2)], u: k < 2, i: true, due: '', top: d, done: i === 0 ? k === 0 : rnd() < 0.7, doneAt: new Date(d + 'T18:00:00').getTime() });
    s['ch:day-' + d] = { secs: rnd() < 0.7 ? Math.round(240 + rnd() * 500) : 0 };
    if (i % 3 === 0) s['ml:core'].weights.push({ date: d, lb: Math.round((156 + tr * 2.5 + rnd() * 0.8) * 10) / 10 });
  }
  tasks.push({ id: 'o1', title: 'Sign up for summer league', u: false, i: true, due: shift(nowIso, 5), done: false, top: null }, { id: 'o2', title: 'Return library book', u: true, i: false, due: shift(nowIso, -1), done: false, top: null });
  const mon = shift(nowIso, -wd(nowIso));
  s['wb:w-' + mon] = { items: [{ id: 'w1', title: 'Spanish quiz study', type: 'study', date: nowIso, start: '18:30', mins: 30, done: false }, { id: 'w2', title: 'Game vs. North', type: 'game', date: shift(mon, 4), start: '19:00', mins: 120, done: false }], done: {}, skip: {} };
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, JSON.stringify(v)]));
}

const NOW = new Date('2026-11-16T17:20:00-06:00'); // Monday afternoon, Central time
const browser = await chromium.launch();
let failures = 0;
async function run(scheme) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'America/Chicago', colorScheme: scheme });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const data = seed('2026-11-16');
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, data);
  const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${shots}/${scheme}-${name}.png`, fullPage: true }); };
  const check = async (name) => {
    const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
    if (w > 390) { failures++; console.log(`✗ ${scheme} ${name}: scrollWidth ${w}`); const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > 391).slice(0, 5).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right))); const over = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible').slice(0, 6).map((e) => e.tagName + '.' + e.className + ' ' + e.scrollWidth + '/' + e.clientWidth)); console.log('  wide:', wide, over); }
  };
  const routes = ['today', 'food', 'food/nutrition', 'food/nutrition/nutrients', 'food/nutrition/macros', 'train', 'plan', 'plan/week', 'plan/tasks', 'plan/time', 'plan/night', 'progress', 'more', 'more/spanish'];
  await page.goto(base + '#today');
  for (const r of routes) { await page.evaluate((h) => { location.hash = h; }, '#' + r); await page.waitForTimeout(200); await check(r); await shot(r.replace(/\//g, '-')); }
  if (scheme === 'light') {
    // Flows: add food via search, quick add, water, check-in, session, task, week item, timer, weight, flashcard.
    await page.evaluate(() => { location.hash = '#food'; }); await page.waitForTimeout(150);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ml:day-2026-11-16')).dinner.length);
    await page.click('[data-act="addFood"][data-meal="dinner"]'); await page.fill('#food-q', 'salmon'); await page.waitForTimeout(100); await shot('flow-search');
    await page.click('#food-results [data-act="pickFood"]'); await page.waitForTimeout(250); await page.click('dialog[data-detail] [data-act="srv"][data-d="0.5"]'); await shot('flow-detail');
    await page.click('dialog[data-detail] .sheet-body [data-act="detailAdd"]'); await page.waitForTimeout(300);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ml:day-2026-11-16')).dinner);
    if (after.length !== before + 1 || after.at(-1).servings !== 1.5 || !/Salmon/.test(after.at(-1).name)) { failures++; console.log('✗ add food flow', after); } else console.log('✓ add food (1.5 × salmon to dinner)');
    await page.click('#toast [data-undo]'); await page.waitForTimeout(150);
    if (await page.evaluate(() => JSON.parse(localStorage.getItem('ml:day-2026-11-16')).dinner.length) !== before) { failures++; console.log('✗ undo'); } else console.log('✓ undo');
    await page.click('[data-act="addFood"][data-meal="snacks"]'); await page.click('[data-act="addPane"][data-pane="quick"]');
    await page.fill('input[name="name"]', 'Chipotle bowl'); await page.fill('input[name="calories"]', '820'); await page.fill('input[name="protein"]', '52'); await shot('flow-quick');
    await page.click('form[data-submit="foodQuickAdd"] .btn.primary'); await page.waitForTimeout(200);
    const snack = await page.evaluate(() => JSON.parse(localStorage.getItem('ml:day-2026-11-16')).snacks.at(-1));
    console.log(snack?.name === 'Chipotle bowl' && snack.calories === 820 ? '✓ quick add' : (failures++, '✗ quick add'));
    await page.click('[data-act="water"][data-oz="16"]'); await page.waitForTimeout(100);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('ml:day-2026-11-16')).water)) === 56 ? '✓ water' : (failures++, '✗ water'));
    // entry edit
    await page.click('[data-act="editEntry"][data-meal="lunch"]'); await page.click('dialog [data-act="srv"][data-d="0.5"]'); await page.click('dialog .sheet-body [data-act="entrySave"]'); await page.waitForTimeout(250);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('ml:day-2026-11-16')).lunch[0].servings)) === 1.5 ? '✓ edit entry' : (failures++, '✗ edit entry'));
    // check-in redo
    await page.evaluate(() => { location.hash = '#train'; }); await page.waitForTimeout(150);
    await page.click('[data-act="qaCheckin"]'); await page.waitForTimeout(200); await shot('flow-checkin');
    for (const [k, v] of [['quality', 5], ['soreness', 1], ['energy', 5], ['stress', 1]]) await page.click(`dialog [data-act="ciScale"][data-k="${k}"][data-v="${v}"]`);
    await page.click('dialog .sheet-body [data-act="ciSave"]'); await page.waitForTimeout(250);
    const ci = await page.evaluate(() => JSON.parse(localStorage.getItem('ru:day-2026-11-16')).checkin);
    console.log(ci.quality === 5 && ci.soreness === 1 ? '✓ check-in' : (failures++, '✗ check-in'));
    await page.click('.sh [data-act="qaWorkout"]'); await page.click('dialog [data-act="sesType"][data-t="Skill work"]'); await page.click('dialog [data-act="sesMinsSet"][data-m="60"]'); await page.click('dialog [data-act="sesRpe"][data-v="7"]'); await shot('flow-session');
    await page.click('dialog .sheet-body [data-act="sesSave"]'); await page.waitForTimeout(200);
    const ses = await page.evaluate(() => JSON.parse(localStorage.getItem('ru:day-2026-11-16')).sessions.at(-1));
    console.log(ses?.type === 'Skill work' && ses.mins === 60 && ses.rpe === 7 ? '✓ session' : (failures++, '✗ session', ses));
    await page.click('[data-act="routine"][data-i="2"]'); await page.waitForTimeout(300); await shot('flow-breath'); await page.click('dialog [data-close]'); await page.waitForTimeout(250);
    // tasks
    await page.evaluate(() => { location.hash = '#plan/tasks'; }); await page.waitForTimeout(150);
    await page.fill('form[data-submit="taskQuick"] input', 'Watch Curry off-ball film'); await page.press('form[data-submit="taskQuick"] input', 'Enter'); await page.waitForTimeout(150);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('gp:core')).tasks.some((t) => t.title === 'Watch Curry off-ball film' && t.u && t.i))) ? '✓ add task' : (failures++, '✗ add task'));
    // week item
    await page.evaluate(() => { location.hash = '#plan/week'; }); await page.waitForTimeout(150);
    await page.click('[data-act="addWbItem"]'); await page.fill('#wb-title', 'English essay draft'); await page.click('dialog .sheet-body [data-act="wbSave"]'); await page.waitForTimeout(150);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('wb:w-2026-11-16')).items.some((i) => i.title === 'English essay draft'))) ? '✓ week item' : (failures++, '✗ week item'));
    await page.click('[data-act="wbAutofit"]'); await page.waitForTimeout(150);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('wb:core')).tray.length)) === 0 ? '✓ auto-fit' : (failures++, '✗ auto-fit'));
    await page.click('[data-act="wbCheck"][data-id="r1|2026-11-16"]'); await page.waitForTimeout(100);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('wb:w-2026-11-16')).done['r1|2026-11-16'])) ? '✓ check weekly item' : (failures++, '✗ check weekly'));
    // timer
    await page.evaluate(() => { location.hash = '#plan/time'; }); await page.waitForTimeout(150);
    await page.click('[data-act="timerCat"][data-cat="homework"]'); await page.clock.runFor(26 * 60 * 1000); await page.waitForTimeout(100); await shot('flow-timer'); await page.click('[data-act="timerStop"]'); await page.waitForTimeout(150);
    const hw = await page.evaluate(() => JSON.parse(localStorage.getItem('gp:d-2026-11-16')).entries.filter((e) => e.cat === 'homework').at(-1));
    console.log(hw?.mins >= 26 ? '✓ timer' : (failures++, '✗ timer', hw));
    // night step
    await page.evaluate(() => { location.hash = '#plan/night'; }); await page.waitForTimeout(150);
    const was = await page.evaluate(() => !!JSON.parse(localStorage.getItem('gp:d-2026-11-16')).night.done.charge);
    await page.click('[data-act="nightStep"][data-id="charge"]'); await page.waitForTimeout(100);
    console.log((await page.evaluate(() => !!JSON.parse(localStorage.getItem('gp:d-2026-11-16')).night.done.charge)) !== was ? '✓ night step' : (failures++, '✗ night'));
    // weight
    await page.evaluate(() => { location.hash = '#progress'; }); await page.waitForTimeout(150);
    await page.click('.sh [data-act="logWeight"]'); await page.fill('#w-lb', '159.4'); await page.click('dialog .sheet-body [data-act="weightSave"]'); await page.waitForTimeout(150);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('ml:core')).weights.at(-1).lb)) === 159.4 ? '✓ weight' : (failures++, '✗ weight'));
    // flashcards
    await page.evaluate(() => { location.hash = '#more/spanish'; }); await page.waitForTimeout(150);
    await page.click('button.card[data-act="flip"]'); await page.waitForTimeout(100); await shot('flow-flash'); await page.click('[data-act="grade"][data-g="1"]'); await page.waitForTimeout(100);
    console.log((await page.evaluate(() => JSON.parse(localStorage.getItem('ch:core')).words.filter((w) => w.due > '2026-11-16').length)) === 2 ? '✓ flashcard' : (failures++, '✗ flashcard'));
    // quick add sheet + today
    await page.evaluate(() => { location.hash = '#today'; }); await page.waitForTimeout(150); await page.click('#fab'); await page.waitForTimeout(350); await shot('flow-fab'); await page.click('dialog [data-act="qaWater"]'); await page.waitForTimeout(350); await shot('flow-water');
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#today'; }); await page.waitForTimeout(200); await shot('today-after');
    // Data still readable by the original apps' key layout
    const keysOk = await page.evaluate(() => ['ml:core', 'ru:core', 'wb:core', 'gp:core', 'ch:core', 'mlw:today'].every((k) => localStorage.getItem(k)));
    console.log(keysOk ? '✓ shared keys intact' : (failures++, '✗ keys'));
  }
  if (errors.length) { failures += errors.length; console.log(`✗ ${scheme} errors:\n  ` + errors.join('\n  ')); } else console.log(`✓ ${scheme}: no page errors, ${routes.length} screens`);
  await ctx.close();
}
await run('light');
await run('dark');
await browser.close(); server.close();
console.log(failures ? `\n${failures} problem(s)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
