// Home follows the day (clock 16:30). Seed: practice 15:30-17:30 today in calendar; Gameplan blocks.
await page.evaluate(() => { const t = todayIso(); const P = doc('aos-plan'); P.events = [...(P.events || []), { id: 'evp', title: 'Team practice', type: 'practice', date: t, start: '13:00', end: '15:00', mins: 120, recur: null, skip: [] }]; persist('aos-plan');
  localStorage.setItem('ml:gp-d-' + t, JSON.stringify({ blocks: [{ id: 'g1', title: 'Homework', start: '16:00', mins: 60, type: 'focus', done: false }, { id: 'g2', title: 'Dinner', start: '18:00', mins: 30, type: 'meal', done: false }, { id: 'g3', title: 'Shooting', start: '19:00', mins: 45, type: 'train', done: false }], entries: [], night: { done: {} } })); delete cache['gp-d-' + t];
  delete dayDoc(t).feel; persist('day-' + t); go('home'); });
await page.waitForTimeout(300);
const un = await page.locator('[data-widget="upnext"]').innerText();
ok(/NOW/i.test(un) && un.includes('Homework') && /NEXT/i.test(un) && un.includes('Dinner') && un.includes('Gameplan'), 'Up next shows the current and next Gameplan blocks: ' + un.replace(/\n/g, ' | ').slice(0, 200));
ok(await page.locator('[data-widget="calendar"] .wkc-d').count() === 7 && await page.locator('[data-widget="calendar"] .tl-strip i').count() >= 4, 'week calendar + today timeline on Home');
const df = await page.locator('[data-df]').innerText();
ok(/Morning check-in/.test(df) && /How did practice go/.test(df), 'Do first shows check-in and practice: ' + df.replace(/\n/g, ' | ').slice(0, 220));
ok(!(/Block out your day/.test(df)), 'no "plan your day" when Gameplan has blocks');
await page.locator('[data-df] [data-chk]').click({ force: true }); await page.waitForTimeout(300);
ok(!(/How did practice go/.test(await page.locator('[data-df]').innerText())), 'checked practice leaves Do first');
await page.evaluate(() => { const t = todayIso(); dayDoc(t, true).feel = { sleepH: 8, energy: 4, sore: 2 }; persist('day-' + t); mind().checks[t] = { confidence: 7, focus: 7 }; persist('aos-mind'); refresh(); }); await page.waitForTimeout(200);
ok(await page.locator('[data-df]').count() === 0, 'Do first disappears when everything is done');
await page.locator('[data-wkc]').nth(1).evaluate((b) => b.click()); await page.waitForTimeout(200); ok(await page.evaluate(() => state.view === 'train' && ui('calView') === 'day' && ui('calDay') === shiftIso(todayIso(), 1)), 'tapping a day opens it in the calendar');
await page.evaluate(() => go('home')); await page.waitForTimeout(200); await overflow('home'); await shot('home-day');
