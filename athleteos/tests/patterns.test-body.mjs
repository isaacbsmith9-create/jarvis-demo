const P = await page.evaluate(() => findPatterns().map((p) => ({ kind: p.kind, id: p.id, conf: p.conf, n: p.n, r: p.r, t: p.t })));
ok(process.env.SEED === '0' ? P.length === 0 : P.length > 0, 'patterns found only when data supports them: ' + JSON.stringify(P.slice(0, 5)));
ok(P.every((p) => p.kind !== 'pair' || (p.n >= 10 && Math.abs(p.r) >= 0.3 && p.t >= 2.1)), 'every link meets the data and signal thresholds');
ok(P.every((p) => !['sleep-recovery-0', 'energy-recovery-0', 'sore-recovery-0'].includes(p.id)), 'no built-in (definitional) links');
const pure = await page.evaluate(() => { const ps = Array.from({ length: 30 }, (_, i) => [i % 7, (i * 37) % 11]); const r = pearson(ps); return r ? Math.abs(r.r) : 0; });
ok(pure < 0.3, 'unrelated data does not pass the filter (|r| ' + pure.toFixed(2) + ')');
await page.evaluate(() => go('intel', 'patterns')); await page.waitForTimeout(300);
const txt = await page.locator('#vbody').innerText();
ok(!/undefined|NaN/.test(txt) && (P.length ? /not proven cause/.test(txt) && /How to test it/.test(txt) : /No clear patterns yet/.test(txt)), 'cards explain + say not proven cause (or empty state)');
ok(await page.locator('.pt svg').count() >= 1 || !P.some((p) => p.kind === 'pair'), 'scatter drawn for links');
await overflow('patterns'); await shot('patterns');
const btn = page.locator('[data-pt-open]').first(); if (await btn.count()) { await btn.evaluate((b) => b.click()); await page.waitForTimeout(200); ok(await page.evaluate(() => state.view === 'analytics' && subOf('analytics') === 'correlations'), 'opens Correlations with the pair'); }
await page.evaluate(() => go('home')); await page.waitForTimeout(200);
ok(await page.locator('.cc-pt').count() === (P.length ? 1 : 0), 'Command Center shows the top pattern');
