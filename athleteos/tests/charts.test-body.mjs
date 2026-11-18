ok(await page.locator('[data-widget="charts"] .vz').count() === 8, 'home has 8 charts');
ok(await page.locator('[data-widget="charts"] svg').count() >= 6, 'charts drawn: ' + await page.locator('[data-widget="charts"] svg').count());
ok(await page.locator('.tab[data-view="coach"]').count() === 0 && await page.locator('[data-widget="ai"]').count() === 0, 'AI coach hidden from tabs and Home');
await page.evaluate(() => go('coach')); ok((await page.locator('#vbody').innerText()).includes('moving to your new app'), 'coach placeholder');
await page.evaluate(() => go('home')); await page.waitForTimeout(200); await overflow('home'); await page.locator('[data-widget="charts"]').screenshot({ path: OUT + '/charts.png' });
