/**
 * Browser smoke test: plays the core loop and visits every screen for all 11 scenarios.
 * Usage: npm run build && npm run preview  (in another terminal)  then  npm run e2e
 * Requires Playwright with a Chromium browser available.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const SCEN = ['nobody', 'entrepreneur', 'owner', 'inheritor', 'investor', 'fallen', 'boss', 'nightlife', 'shadow', 'hustler', 'double'];
const VIEWS = ['dashboard', 'companies', 'properties', 'staff', 'finance', 'market', 'news', 'organization', 'saves', 'city'];

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);

  // Core loop: entrepreneur leases a storefront, opens a store, hires, runs time, saves, reloads.
  await page.click('[data-testid=menu-new]');
  await page.click('[data-testid=scenario-entrepreneur]');
  await page.fill('[data-testid=player-name]', 'Loop Test');
  await page.click('[data-testid=start-campaign]');
  await page.click('[data-testid=nav-properties]');
  await page.click('text=For lease (');
  await page.click('tr:has-text("Eighth Street Shop 22")');
  await page.click('[data-testid=lease-property]');
  await page.click('[data-testid=subtype-convenience]');
  await page.fill('[data-testid=company-name]', 'Esquina Market');
  await page.click('[data-testid=confirm-found]');
  await page.waitForSelector('[data-testid=company-detail]');
  await page.click('[data-testid=tab-staff]');
  await page.click('tr:has-text("Cashier") [data-testid=hire]');
  await page.evaluate(() => {
    for (let i = 0; i < 40; i++) window.__billionaire.stepDay();
    window.__billionaire.emit();
  });
  const rev = await page.evaluate(() => Object.values(window.__billionaire.state.companies)[0].lifetime.revenue);
  assert(rev > 0, 'company earned revenue');
  await page.click('[data-testid=nav-saves]');
  await page.click('tr:has-text("Slot 3") >> text=Save here');
  await page.waitForTimeout(500);
  const date = await page.textContent('[data-testid=game-date]');
  await page.reload();
  await page.waitForTimeout(600);
  await page.click('[data-testid=menu-continue]');
  await page.waitForSelector('[data-testid=game-date]');
  assert((await page.textContent('[data-testid=game-date]')) === date, 'save restored the same date');
  console.log('core loop ok —', date);

  for (const id of SCEN) {
    await page.evaluate(() => window.__billionaire.state && window.__billionaire.quitToMenu());
    await page.click('[data-testid=menu-new]');
    await page.click(`[data-testid=scenario-${id}]`);
    await page.fill('[data-testid=player-name]', 'Smoke ' + id);
    await page.click('[data-testid=start-campaign]');
    await page.evaluate(() => {
      for (let i = 0; i < 60; i++) window.__billionaire.stepDay();
      window.__billionaire.emit();
    });
    for (const v of VIEWS) await page.click(`[data-testid=nav-${v}]`);
    console.log(`${id.padEnd(13)} ok`);
  }
  await browser.close();
  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
  console.log('All smoke tests passed.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
