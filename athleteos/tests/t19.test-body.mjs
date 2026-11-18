const cc = page.locator('[data-widget="command"]'), ct = await cc.innerText();
ok(await cc.locator('.d2-status .d2-badge').count() === 1 && /(On track|Watch|Needs attention|Getting started)/i.test(ct), 'overall athlete status');
ok(/Biggest priority today|Nothing needs fixing|Log a workout/.test(ct) && /(mental readiness|Recovery is|scheduled sessions|Training:)/.test(ct), 'status summary from data: ' + (await cc.locator('.d2-status p').innerText()).slice(0, 240));
ok(await cc.locator('.d2-row').count() === 7 && !/undefined|NaN|null/.test(ct), 'daily briefing: 7 rows, no broken values');
for (const k of ['Priorities', 'Training', 'Recovery', 'Nutrition', 'Mental', 'Schedule', 'Insight']) ok(ct.includes(k.toUpperCase()) || ct.includes(k), 'briefing row ' + k);
await page.evaluate(() => { const t = todayIso(); mind().checks[shiftIso(t, -1)] = { confidence: 7, focus: 6, motivation: 8, stress: 4 }; persist('aos-mind'); refresh(); }); await page.waitForTimeout(150);
ok(/7-day avg/.test(await page.locator('[data-widget="command"] .cc-s', { hasText: 'Mind' }).innerText()), 'mental tile says which number it is (7-day avg when no check-in today)');
await page.evaluate(() => { mind().checks[todayIso()] = { confidence: 8, focus: 8, motivation: 8, stress: 3 }; persist('aos-mind'); refresh(); }); await page.waitForTimeout(150);
const mt = await page.locator('[data-widget="command"] .cc-s', { hasText: 'Mind' }).innerText(), mh = await page.locator('[data-widget="mind"]').innerText();
ok(/today/.test(mt) && mh.includes(mt.match(/(\d+) today/)?.[1]), 'mental score identical on tile and Mind card: ' + mt.replace(/\n/g, ' '));
await page.click('[data-d2-refresh]'); await page.waitForTimeout(150); ok(await cc.count() === 1, 'refresh re-renders');
// charts keep full range
const lab = await page.evaluate(() => [...document.querySelectorAll('#vz-sleep .axis text')].map((t) => t.textContent).filter((x) => /[A-Z][a-z]{2} \d/.test(x)));
const from = await page.evaluate(() => fmtD(shiftIso(todayIso(), -13)));
ok(process.env.SEED === '0' ? true : lab[0] === from, 'sleep chart starts 14 days ago: ' + lab.join(','));
// new widgets
ok(await page.locator('[data-widget="radar"] svg').count() === 1, 'performance radar from real results');
ok(await page.locator('[data-widget="heat"] .d2-heat i').count() === 112, 'heatmap 16 weeks');
await page.locator('[data-widget="heat"] [data-seg="heatCat"] button[data-v="check"]').evaluate((b) => b.click()); await page.waitForTimeout(150);
ok(/Check-ins/.test(await page.locator('[data-widget="heat"] .seg .on').innerText()), 'heatmap category switch');
ok(await page.locator('[data-widget="mix"] svg').count() === (process.env.SEED === '0' ? 0 : 1), 'weekly training mix (empty state with no data)');
await page.selectOption('[data-cmp-sel="cmpB"]', 'sleep'); await page.waitForTimeout(150);
ok(await page.locator('#d2-cmp svg').count() === 1 && await page.evaluate(() => ui('cmpB')) === 'sleep', 'trend comparison with selectable metrics');
ok(process.env.SEED === '0' ? await page.locator('[data-widget="timeline"] .empty').count() === 1 : await page.locator('[data-widget="timeline"] .d2-e').count() >= 1, 'development timeline events (or empty state)');
// pin + compact
await page.locator('[data-pin="vz-shot"]').evaluate((b) => b.click()); await page.waitForTimeout(150);
ok(await page.evaluate(() => document.querySelector('.vz-grid').firstElementChild.dataset.vz) === 'vz-shot', 'pinned chart moves first');
await page.locator('[data-homemode="compact"]').evaluate((b) => b.click()); await page.waitForTimeout(200);
ok(await page.locator('.vz').count() === 1 && await page.locator('[data-widget="heat"]').count() === 0, 'compact shows pinned charts only and drops long cards');
await overflow('home compact'); await shot('home-compact');
await page.locator('[data-homemode="detailed"]').evaluate((b) => b.click()); await page.waitForTimeout(200);
ok(await page.locator('.vz').count() === 8, 'detailed shows everything again');
await overflow('home detailed'); await shot('home-detailed');
