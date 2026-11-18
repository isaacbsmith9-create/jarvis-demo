const cc = page.locator('[data-widget="command"]');
ok(await cc.count() === 1, 'Command Center on Home');
const txt = await cc.innerText();
ok(/Daily briefing/.test(txt) && /THIS WEEK/.test(txt) && !/undefined|NaN|null/.test(txt), 'daily + weekly briefing, no broken values: ' + txt.replace(/\n/g, ' | ').slice(0, 420));
ok(await cc.locator('.cc-s').count() === 6, '6 system statuses');
ok(await page.evaluate(() => [...document.querySelectorAll('[data-widget]')].map((x) => x.dataset.widget)[0]) === 'command', 'Command Center is first');
await page.locator('.cc-s').first().evaluate((b) => b.click()); await page.waitForTimeout(150); ok(await page.evaluate(() => state.view === 'train'), 'status opens its section');
await page.evaluate(() => go('home')); await page.waitForTimeout(200); await overflow('home'); await cc.screenshot({ path: OUT + '/cc-' + (process.env.THEME || 'dark') + (process.env.SEED === '0' ? '-empty' : '') + '.png' });
