const open = async (v, s) => { await page.evaluate(([v, s]) => go(v, s), [v, s]); await page.waitForTimeout(150); };
const noErr = async (l) => ok(!(await page.locator('text=Something went wrong').count()), l + ' renders');
for (const s of ['dash', 'compare', 'forecast', 'history', 'ask']) { await open('lab', s); await noErr('lab ' + s); await overflow('lab ' + s); }
if (process.env.SEED === '0') {
  await open('lab', 'forecast'); ok((await page.locator('#vbody').innerText()).match(/Not enough data|No measurements/), 'empty: forecasts say what data is missing');
  await open('lab', 'compare'); ok(await page.locator('#vbody .empty').count() === 1, 'empty: compare explains how to start');
  await open('lab', 'history'); ok((await page.locator('#vbody').innerText()).includes('Save a simulation'), 'empty: history explains checkpoints');
} else {
// ---------- forecast math ----------
const F = await page.evaluate(() => {
  const pts = Array.from({ length: 6 }, (_, i) => ({ date: shiftIso('2026-10-01', i * 7), v: 10 + i })); // +1 per week, perfect line
  const f = forecastSeries(pts, { start: '2026-11-05' }); // last point 2026-11-05
  const eff4 = 7 * [1, 2, 3, 4].reduce((a, i) => a + 0.92 ** i, 0);
  const few = forecastSeries(pts.slice(0, 3)), short = forecastSeries(pts.map((p, i) => ({ ...p, date: shiftIso('2026-10-01', i) })));
  const real = labForecasts().map((x) => ({ id: x.id, ok: x.fc.ok, need: x.fc.need, w4: x.fc.ok ? x.fc.rows[4].opt - x.fc.rows[4].cons : null, w26: x.fc.ok ? x.fc.rows[26].opt - x.fc.rows[26].cons : null }));
  return { slope: f.slopePerWeek, w0: f.rows[0].base, w4: f.rows[4].base, exp4: Math.round((15 + eff4 / 7) * 100) / 100, band: f.rows[4].opt - f.rows[4].cons, few: few.ok, fewNeed: few.need, short: short.ok, real };
});
ok(F.slope === 1 && F.w0 === 15 && Math.abs(F.w4 - F.exp4) < 0.02 && F.band < 0.01, 'forecast math on a perfect line ' + JSON.stringify([F.slope, F.w0, F.w4, F.exp4, F.band]));
ok(!F.few && /1 more/.test(F.fewNeed) && !F.short, 'no forecast without enough points or days');
const fs = Object.fromEntries(F.real.map((x) => [x.id, x]));
ok(fs.shoot.ok && fs.hours.ok && fs['test:vert'].ok && !fs['test:ft'].ok, 'forecasts only where data is sufficient ' + JSON.stringify(F.real.map((x) => x.id + ':' + x.ok)));
ok(F.real.filter((x) => x.ok).every((x) => x.w26 > x.w4), 'uncertainty widens with horizon');
await open('lab', 'forecast'); ok(await page.locator('[id^="fc-"] svg').count() >= 3 && (await page.locator('#vbody').innerText()).includes('Free throws'), 'forecast charts + not-enough list'); await shot('lab-forecast');
await page.click('[data-seg="fcH"] button[data-v="26"]'); await page.waitForTimeout(120); ok((await page.locator('#vbody').innerText()).includes('in 6 months'), 'forecast horizon switch');
// ---------- save two scenarios, compare ----------
await open('lab', 'build');
await page.evaluate(() => { const d = labDraft('build'); d.mod.days = 6; d.mod.items.shooting.n += 2; saveDraft('build', d); }); await open('lab', 'build');
await page.click('[data-act="lab-save"]'); await page.fill('#lab-name', 'Six days'); await page.click('#lab-name-ok'); await page.waitForTimeout(150);
await page.evaluate(() => ACTIONS['lab-preset']({ dataset: { p: 'strength2' } })); await page.waitForTimeout(150);
await page.click('[data-act="lab-save"]'); await page.fill('#lab-name', 'Strength focus'); await page.click('#lab-name-ok'); await page.waitForTimeout(150);
await open('lab', 'compare');
ok(await page.locator('[data-cmp]').count() === 2 && await page.locator('[data-cmp].on').count() === 2, 'compare preselects saved scenarios');
ok(await page.locator('.lab-table.lab-cmp .lt-h > span').count() === 4, 'baseline + 2 scenarios side by side');
ok(await page.locator('#cmp-radar svg').count() === 1 && await page.locator('#cmp-load svg').count() === 1 && await page.locator('#cmp-shot svg').count() === 1 && await page.locator('.cmp-b').count() >= 12, 'comparison charts drawn');
await shot('lab-compare');
await page.click('[data-cmp] >> nth=0'); await page.waitForTimeout(120); ok(await page.locator('.lab-table.lab-cmp .lt-h > span').count() === 3, 'toggle a scenario out of the comparison');
// ---------- history & predicted vs actual ----------
await page.evaluate(() => {
  const s = JSON.parse(JSON.stringify(labSnapshot())); s.date = shiftIso(todayIso(), -56);
  const d4 = shiftIso(s.date, 28), d8 = shiftIso(s.date, 56), act4 = actualShootPct(d4), act8 = actualShootPct(d8);
  window.__act = [act4, act8];
  doc('aos-sim').scenarios.push({ id: 'simPast', name: 'Old shooting plan', kind: 'shoot', created: s.date + 'T12:00:00Z', updated: s.date + 'T12:00:00Z', model: 'lab-1', snap: s, summary: 'test', inputs: { pct: 50, sessions: 3, attempts: 100, nSessions: 4, nAttempts: 200, target: 55, weeks: 12, useAssume: false, assume: [0, 0.3, 0.8] },
    results: { metric: 'shootPct', rows: [{ w: 4, date: d4, cons: act4 - 2, base: act4, opt: act4 + 2 }, { w: 8, date: d8, cons: act8 + 5, base: act8 + 6, opt: act8 + 9 }, { w: 12, date: shiftIso(s.date, 84), cons: 40, base: 45, opt: 50 }] } });
  const p = JSON.parse(JSON.stringify(labSnapshot())); p.date = shiftIso(todayIso(), -14);
  doc('aos-sim').scenarios.push({ id: 'simPlan', name: 'Old plan', kind: 'build', created: p.date + 'T12:00:00Z', updated: p.date + 'T12:00:00Z', model: 'lab-1', snap: p, summary: '', inputs: { mod: p.plan, weeks: 8, sleepH: 8 }, results: { metric: 'plan', hours: 10, load: 3000, restDays: 1, shootRows: [] } });
  persist('aos-sim');
});
const acc = await page.evaluate(() => [labAccuracy(doc('aos-sim').scenarios.find((s) => s.id === 'simPast')), labAccuracy(doc('aos-sim').scenarios.find((s) => s.id === 'simPlan')), window.__act]);
ok(acc[2][0] != null && acc[0].checks.length === 2 && acc[0].checks[0].verdict === 'inside' && acc[0].checks[1].verdict === 'below' && acc[0].next, 'predicted vs actual verdicts ' + JSON.stringify(acc[0].checks.map((c) => [c.act, c.verdict])));
ok(acc[1].plan && acc[1].plan.weeks === 2 && acc[1].plan.hours > 0, 'plan adherence since saving ' + JSON.stringify(acc[1].plan));
await open('lab', 'history');
const ht = await page.locator('#vbody').innerText();
ok(ht.includes('✓ in range') && ht.includes('↓ under') && ht.includes('50%') && ht.includes('Variables & assumptions'), 'history page shows accuracy');
await shot('lab-history');
// ---------- turn into plan (approval required) ----------
const wBefore = await page.evaluate(() => JSON.stringify(allDayKeys().map((d) => exList(d).length)));
await page.evaluate(() => ACTIONS['lab-open']({ dataset: { id: doc('aos-sim').scenarios.find((s) => s.name === 'Six days').id } })); await page.waitForTimeout(200);
await page.click('[data-act="lab-plan"]'); await page.waitForTimeout(120);
ok(await page.locator('#lp-go').isDisabled(), 'plan cannot be added before approval');
ok(await page.evaluate(() => (plan().events || []).filter((e) => e.src === 'lab').length) === 0, 'nothing added while previewing');
await page.check('#lp-ok'); await page.click('#lp-go'); await page.waitForTimeout(150);
const pl = await page.evaluate(() => { const sc = doc('aos-sim').scenarios.find((s) => s.name === 'Six days'), ev = plan().events.filter((e) => e.src === 'lab'), mon = shiftIso(mondayOf(todayIso()), 7), wk = [0, 1, 2, 3, 4, 5, 6].map((i) => itemsOn(shiftIso(mon, i)).filter((x) => x.ev?.src === 'lab').length);
  return { n: ev.length, sessions: planMetrics(sc.inputs.mod, sc.snap).sessions, wk: wk.reduce((a, b) => a + b, 0), after: itemsOn(shiftIso(mon, 7 * 13)).filter((x) => x.ev?.src === 'lab').length, checked: ev.some((e) => Object.values(plan().checks || {}).some((c) => c['e:' + e.id])), sim: ev.every((e) => e.simId === sc.id) }; });
ok(pl.n === pl.sessions && pl.wk === pl.n && pl.after === 0 && !pl.checked && pl.sim, 'approved plan adds recurring events for the period only, none marked done ' + JSON.stringify(pl));
ok(await page.evaluate(() => JSON.stringify(allDayKeys().map((d) => exList(d).length))) === wBefore, 'no workouts logged by proposing a plan');
await page.click('[data-act="lab-plan"]'); await page.check('#lp-ok'); await page.click('#lp-go'); await page.waitForTimeout(120);
ok(await page.evaluate(() => plan().events.filter((e) => e.src === 'lab').length) === pl.n, 're-approving replaces instead of duplicating');
await page.click('[data-act="lab-unplan"]'); await page.click('#cf-ok'); await page.waitForTimeout(120);
ok(await page.evaluate(() => (plan().events || []).filter((e) => e.src === 'lab').length) === 0, 'remove planned sessions');
// ---------- AI assistant (mocked model) ----------
await page.evaluate(() => { window.__calls = 0; ai = { json: async (p, o) => { window.__calls++; window.__p = p; window.__o = o; return { headline: 'Shooting 1,000 a week is doable but costs time', variant: 'shoot1000', changed: ['Shooting 4×250'], predicts: 'Shots 1,000/week', why: 'More reps', assumptions: ['rateSource history'], uncertainties: ['Short history'], tradeoffs: ['+3 h/week'], basedOn: 'variants + baseline' }; } }; });
await open('lab', 'ask');
await page.click('[data-labq="What if I shoot 1,000 shots per week?"]'); await page.waitForTimeout(250);
const P = await page.evaluate(() => ({ calls: window.__calls, hasVariants: window.__p.includes('"variants"') && window.__p.includes('"shoot1000"'), real: window.__p.includes(String(labSnapshot().shooting.attemptsPerWeek)), schema: !!window.__o?.schema, rules: window.__p.includes('never treat it as zero') }));
ok(P.calls === 1 && P.hasVariants && P.real && P.schema && P.rules, 'AI gets computed variants + real data + schema ' + JSON.stringify(P));
ok((await page.locator('#lab-ai-out').innerText()).includes('doable') && await page.locator('#lab-ai-out [data-act="lab-preset"][data-p="shoot1000"]').count() === 1, 'AI answer card with open-in-builder');
await page.click('[data-labq="What if I shoot 1,000 shots per week?"]'); await page.waitForTimeout(200);
ok(await page.evaluate(() => window.__calls) === 1, 'same question + same data is not sent again');
await open('lab', 'ask'); ok(await page.locator('#lab-ai-out .card').count() === 1, 'saved answers listed'); await shot('lab-ask');
// ---------- goal → simulation ----------
await page.evaluate(() => { doc('aos-goals').goals = [{ id: 'gv', title: 'Vertical 32"', cat: 'athletic', horizon: 'season', source: 'test:vert', start: 26, target: 32, better: 'higher', date: shiftIso(todayIso(), 70), created: Date.now() }]; persist('aos-goals'); });
await open('lab', 'dash'); await page.click('[data-act="lab-goal"]'); await page.waitForTimeout(200);
ok(await page.evaluate(() => subOf('lab') === 'ath' && labDraft('ath').test === 'vert' && Number(labDraft('ath').target) === 32 && labDraft('ath').weeks === 10), 'goal opens athletic simulator with its target and date');
ok(await page.locator('#lab-ath svg').count() === 1, 'goal simulation drawn');
await open('lab', 'dash'); await noErr('dashboard with everything'); await shot('lab-dash2');
await open('train', 'plan'); await noErr('calendar'); await open('home'); await noErr('home');
}
