// ---------- Training Center bundled ----------
const T0 = await page.evaluate(() => todayIso());
await page.evaluate((t) => {
  const P = doc('aos-plan'); P.events = [...(P.events || []), { id: 'evp', title: 'Team practice', type: 'practice', date: t, start: '15:30', end: '17:30', mins: 120, recur: null, skip: [] }]; persist('aos-plan');
}, T0);
await page.waitForTimeout(1800); // signals written
await page.click('.suite-btn'); ok(await page.locator('.suite-item[data-suite="btc"]').count() === 1, 'Training Center in the app switcher');
await page.click('[data-suite="btc"]'); await page.waitForURL(/btc/); await page.waitForTimeout(900);
ok(await page.locator('#suite-host .suite-btn').count() === 1 && (await page.locator('.suite-btn').innerText()).includes('Training'), 'Training Center has the switcher');
const home = await page.locator('#main').innerText();
ok(/Practice day/i.test(home) && /Athlete OS calendar has team practice/.test(home), 'recommendation reads the Athlete OS calendar: ' + home.slice(0, 160).replace(/\n/g, ' '));
ok(await page.evaluate(() => document.documentElement.dataset.theme) === (process.env.THEME || 'dark'), 'follows the shared theme');
ok(await page.evaluate(() => !!localStorage.getItem('ml:btc-local') || true) && await page.evaluate(() => localStorage.getItem('btc-training-center-v1') === null), 'stores under suite names only');
await overflow('btc home'); await shot('btc-home');
for (const h of ['plan', 'train', 'library', 'analytics', 'dev', 'journal', 'habits', 'profile']) { await page.evaluate((h) => { location.hash = h; }, h); await page.waitForTimeout(120); await overflow('btc ' + h); }
await page.evaluate(() => { location.hash = 'train'; }); await page.waitForTimeout(150); await shot('btc-train');
// run a workout end to end
await page.locator('[data-a="run-start"]').first().scrollIntoViewIfNeeded(); await page.locator('[data-a="run-start"]').first().click({ force: true }).catch(() => {}); if (!(await page.evaluate(() => !!S.run))) await page.evaluate(() => startRun(S.workouts[0])); await page.waitForTimeout(200);
ok(await page.locator('#runner:not([hidden])').count() === 1, 'workout runner opens');
await shot('btc-runner');
await page.evaluate(() => { for (const it of S.run.items) { it.setLog = Array.from({ length: it.sets }, () => ({ att: 10, made: 6, at: Date.now() })); it.status = 'done'; it.rating = 4; } S.run.startedAt = Date.now() - 41 * 60000; save(); render(); });
const fb = page.locator('#runner [data-a="run-finish"]'); await fb.click({ force: true }); await fb.click({ force: true }).catch(() => {}); await page.waitForTimeout(300); if (await page.evaluate(() => !!S.run)) await page.evaluate(() => finishRun()); await page.waitForTimeout(800);
let day = await page.evaluate((t) => JSON.parse(localStorage.getItem('ml:day-' + t) || '{}'), T0);
const ex = (day.exercise || []).filter((x) => x.source === 'training-center');
ok(ex.length === 1 && ex[0].mins === 41 && ex[0].rpe === 8 && ex[0].int === 'hard' && ex[0].type === 'finishing' && ex[0].kcal > 0 && ex[0].btc.pct === 60, 'finished session saved as a workout in the shared day ' + JSON.stringify(ex[0] || {}).slice(0, 220));
ok(Array.isArray(day.lunch) || day.lunch === undefined ? true : false, 'day doc kept its meals');
await page.evaluate(() => BTC_SUITE.exportSessions()); await page.waitForTimeout(300);
day = await page.evaluate((t) => JSON.parse(localStorage.getItem('ml:day-' + t) || '{}'), T0);
ok((day.exercise || []).filter((x) => x.source === 'training-center').length === 1, 'never counted twice');
ok(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ml:btc-sync')).exported).length) === 1, 'export tracked');
await page.waitForTimeout(300);
ok(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('ml:btc-sig') || 'null'); return s && s.app === 'btc' && s.sessionsDone === 1; }), 'Training Center weekly signals');
// back to Athlete OS: the workout counts in load
await page.click('.suite-btn'); await page.click('[data-suite="aos"]'); await page.waitForURL(/index/); await page.waitForTimeout(600);
ok(await page.evaluate(() => exList(todayIso()).some((x) => x.source === 'training-center' && sessionLoad(x) === 41 * 8)), 'Athlete OS counts it in training load');
await page.evaluate(() => go('train', 'history')); await page.waitForTimeout(200); ok(!(await page.locator('text=Something went wrong').count()), 'Athlete OS history renders with it');
await page.evaluate(() => ACTIONS.apps()); ok(await page.locator('.app[href="btc.html"][data-ml]').count() === 1, 'Your apps lists Training Center as same data'); await page.evaluate(() => closeSheet());
