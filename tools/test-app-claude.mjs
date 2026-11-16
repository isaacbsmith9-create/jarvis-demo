// Checks Baseline's "inside Claude" mode with a fake window.claude: loads from the account store,
// writes back to it, shows the AI photo scan, and never errors. Usage: node tools/test-app-claude.mjs [shots-dir]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const root = new URL('../app/', import.meta.url).pathname, shots = process.argv[2] || '/tmp/baseline-shots';
await mkdir(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'America/Chicago' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-16T12:40:00-06:00') });
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  // Account store as MacroLens data would look after migration, plus nothing for the planner.
  const store = window.__remote = {
    'ml__core': { profile: { age: 16, sex: 'male', heightIn: 70, weightLb: 145, activity: 'athlete', goal: 'maintain' }, targets: { calories: 3220, protein: 131, carbs: 456, fat: 97, waterOz: 97 }, overrides: {}, custom: [], recents: [], weights: [] },
    'ml__day-2026-11-16': { breakfast: [{ name: 'Oikos Pro Vanilla Greek yogurt (2%)', serving: '1 cup', calories: 140, protein: 20, carbs: 7, fat: 3, servings: 1, addedAt: 1, source: 'AI scan' }], lunch: [], dinner: [], snacks: [], water: 8, type: 'training' },
  };
  try { localStorage.clear(); } catch {}
  const coll = { get: async () => ({ docs: Object.entries(store).map(([id, d]) => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(d)) })) }),
    doc: (id) => ({ set: async (d) => { store[id] = d; }, delete: async () => { delete store[id]; } }) };
  const sample = Object.assign(async () => ({ text: '' }), {
    json: async () => ({ items: [{ name: 'Quesadilla, chicken', serving: '1/2 quesadilla', calories: 600, protein: 32, carbs: 30, fat: 39, confidence: 'medium' }, { name: 'Fries', serving: '3/4 side', calories: 425, protein: 5, carbs: 54, fat: 21, confidence: 'low' }], note: 'Check the fries portion.' }),
    limits: async () => ({ images: true }) });
  window.claude = { use: async (n) => (n === 'db' ? { collection: () => coll } : n === 'user' ? { id: async () => 'u1' } : n === 'sample' ? sample : null) };
});
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
await page.goto(base + '#food'); await page.waitForTimeout(600);
ok(await page.locator('text=Oikos Pro Vanilla').count() === 1, 'loads food from the Claude account');
await page.click('[data-act="addFood"][data-meal="lunch"]'); await page.waitForTimeout(300);
ok(await page.locator('dialog [data-act="addPane"][data-pane="scan"][aria-pressed="true"]').count() === 1, 'Scan tab shows first inside Claude');
await page.fill('dialog textarea', 'half a chicken quesadilla and fries'); await page.click('dialog [data-act="scanGo"]'); await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/claude-scan.png` });
await page.click('dialog [data-act="scanAdd"]'); await page.waitForTimeout(1000);
const remote = await page.evaluate(() => window.__remote['ml__day-2026-11-16']);
ok(remote.lunch.length === 2 && remote.lunch[0].name === 'Quesadilla, chicken', 'scan adds items and saves them to the Claude account');
await page.evaluate(() => { location.hash = '#plan-tasks'; }); await page.waitForTimeout(200);
await page.fill('form[data-submit="taskQuick"] input', 'Film study'); await page.press('form[data-submit="taskQuick"] input', 'Enter'); await page.waitForTimeout(1000);
ok((await page.evaluate(() => window.__remote['gp__core']?.tasks?.length)) === 1, 'planner changes sync to the Claude account');
await page.evaluate(() => { location.hash = '#more'; }); await page.waitForTimeout(300);
ok(await page.locator('text=Synced').count() >= 1, 'Profile shows Synced');
ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
