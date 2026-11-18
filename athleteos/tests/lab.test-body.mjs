const open = async (v, s) => { await page.evaluate(([v, s]) => go(v, s), [v, s]); await page.waitForTimeout(150); };
const noErr = async (l) => ok(!(await page.locator('text=Something went wrong').count()), l + ' renders');
ok(await page.locator('.tab[data-view="lab"]').count() === 1, 'Lab tab in tab bar');
for (const s of ['dash', 'build', 'train', 'shoot', 'ath']) { await open('lab', s); await noErr('lab ' + s); await overflow('lab ' + s); await shot('lab-' + s); }
if (process.env.SEED === '0') {
  ok(await page.evaluate(() => labSnapshot().isDefault === (labSnapshot().sessions28 === 0)), 'empty data: baseline flagged as template when nothing logged');
  await open('lab', 'build'); ok(await page.locator('#lab-out').innerText().then((t) => /template|21\+ days|No shooting|No test/.test(t)), 'empty data: uncertainties explain missing data');
  await open('lab', 'ath'); await page.selectOption('select[data-lab="ath.test"]', 'broad'); await page.waitForTimeout(150);
  ok(await page.locator('#lab-out .empty').count() === 1, 'missing measurement asks for a value');
} else {
// ---------- engine math ----------
const E = await page.evaluate(() => {
  const r = {};
  const ls = loadStats(), lm = loadMetricsOf(lastNDays(28).map(loadOf), ls.history);
  r.loadSame = ['acute', 'chronic', 'acwr', 'monotony', 'strain'].every((k) => ls[k] === lm[k]); r.ls = [ls, lm];
  const p = sanePlan({ days: 4, items: { shooting: { n: 3, mins: 60, rpe: 5 }, strength: { n: 2, mins: 50, rpe: 6 }, handles: { n: 0 }, finishing: { n: 0 }, skill: { n: 0 }, conditioning: { n: 0 }, practice: { n: 0 } }, attempts: 200 });
  const m = planMetrics(p, labSnapshot());
  r.hand = { load: m.load, mins: m.mins, hours: m.hours, sessions: m.sessions, shots: m.shotsWeek, rest: m.restDays };
  const d = m.daily, mu = d.reduce((a, b) => a + b, 0) / 7, sd = Math.sqrt(d.reduce((a, b) => a + (b - mu) ** 2, 0) / 7);
  r.mono = [m.monotony, Math.round((mu / sd) * 100) / 100];
  r.det = JSON.stringify(weekSchedule(p)) === JSON.stringify(weekSchedule(clonePlan(p)));
  const z = planMetrics({ days: 0, items: {}, attempts: 0 }, labSnapshot()); r.zero = [z.load, z.hours, z.sessions, z.restDays, Number.isNaN(z.load)];
  const s0 = { ...labSnapshot(), shooting: { ...labSnapshot().shooting, trend: null } };
  const sp = shootProject(s0, { pct: 40, sessions: 4, attempts: 250, weeks: 12, target: 45 });
  r.shoot = { perWeek: sp.perWeek, total: sp.total, perMonth: sp.perMonth, src: sp.src, consFlat: sp.rows.every((x) => x.cons === 40), mono: sp.rows.every((x, i) => i === 0 || (x.base >= sp.rows[i - 1].base && x.opt >= sp.rows[i - 1].opt)), cap: sp.rows.every((x) => x.opt <= 90), order: sp.rows.every((x) => x.cons <= x.base && x.base <= x.opt), hit: sp.hit, flat: sp.rows.every((x) => x.flat === 40) };
  r.neg = shootPath(40, -5, 10000);
  r.scap = [shootRates(s0, { assume: [0, 5, 9] }).rates.join(), shootPath(40, 2, 1e6)];
  r.olsLine = ols([0, 1, 2, 3, 4], [1, 3, 5, 7, 9]);
  const tbH = { id: 'vert', unit: 'in', better: 'higher', group: 'Jumping', cur: 28, rate: null }, tbL = { id: 'sprint40', unit: 's', better: 'lower', group: 'Speed', cur: 5.2, rate: 2 };
  const a = athProject(tbH, { cur: 28, weeks: 12, focusNow: 2, focusNew: 2, target: 30 }), b = athProject(tbL, { cur: 5.2, weeks: 12, focusNow: 1, focusNew: 1 });
  r.ath = { src: a.src, f: a.factor, up: a.rows[12].base > 28 && a.rows[12].cons === 28, down: b.rows[12].base < 5.2, srcL: b.src, ratesL: b.rates, order: a.rows.every((x) => x.cons <= x.base && x.base <= x.opt) };
  r.cap = [athRates(tbH, 0, 14).factor, athRates(tbH, 14, 0).factor];
  r.snap = { trend: !!labSnapshot().shooting.trend, vertRate: labSnapshot().tests.vert?.rate, tests: Object.keys(labSnapshot().tests) };
  return r;
});
ok(E.loadSame, 'simulator load math matches the Load tab exactly ' + JSON.stringify(E.ls));
ok(E.hand.load === 3 * 60 * 5 + 2 * 50 * 6 && E.hand.mins === 280 && E.hand.hours === 4.7 && E.hand.sessions === 5 && E.hand.shots === 600 && E.hand.rest === 3, 'plan metrics match hand calculation ' + JSON.stringify(E.hand));
ok(E.mono[0] === E.mono[1], 'monotony matches hand calculation ' + E.mono);
ok(E.det, 'week layout is deterministic');
ok(E.zero.join() === '0,0,0,7,false', 'empty plan gives zeros, no NaN');
ok(E.shoot.perWeek === 1000 && E.shoot.total === 12000 && E.shoot.perMonth === 4333 && E.shoot.src === 'assumption', 'shooting volume math ' + JSON.stringify(E.shoot));
ok(E.shoot.consFlat && E.shoot.flat, 'conservative shooting line does not assume volume raises %');
ok(E.shoot.mono && E.shoot.cap && E.shoot.order, 'shooting paths ordered, rising and capped');
ok(E.scap[0] === '0,2,2' && E.scap[1] <= 65, 'shooting rates limited to 2 per 1,000 and ceiling now+25 ' + E.scap);
ok(E.neg >= 25 && E.neg <= 40, 'negative trend falls but is bounded: ' + E.neg);
ok(E.olsLine && Math.abs(E.olsLine.b - 2) < 1e-9 && E.olsLine.se < 1e-9, 'least squares on a perfect line');
ok(E.ath.src === 'assumption' && E.ath.f === 1 && E.ath.up && E.ath.order, 'athletic projection (assumption, higher is better) ' + JSON.stringify(E.ath));
ok(E.ath.down && E.ath.srcL === 'history' && E.ath.ratesL.join() === '1,2,2', 'athletic projection (personal rate, lower is better; optimistic capped at 2%/4wk for speed) ' + E.ath.ratesL);
ok(E.cap[0] === 1.5 && E.cap[1] === 0.5, 'focus factor limited to 0.5–1.5');
ok(E.snap.trend && E.snap.vertRate > 0 && E.snap.tests.includes('squat'), 'baseline uses real shooting trend and test history ' + JSON.stringify(E.snap));
// ---------- data separation baseline ----------
const realBefore = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((k) => /^ml:(day-|aos-plan|aos-goals|aos-tests|aos-shots|aos-coach)/.test(k)).sort().map((k) => [k, localStorage.getItem(k)])));
// ---------- builder: live update, preset, save ----------
await open('lab', 'dash');
ok(await page.locator('[data-act="lab-preset"]').count() >= 2, 'recommended experiments from data: ' + (await page.locator('.lab-x b').allInnerTexts()).join(' | ')); await page.click('[data-act="lab-preset"] >> nth=0'); await page.waitForTimeout(250);
ok(await page.evaluate(() => state.view === 'lab' && subOf('lab') === 'build'), 'experiment preset opens builder');
const strengthRow = async () => (await page.locator('.lab-table .lt-r', { hasText: 'Strength sessions' }).innerText()).split(/\s+/);
const before = await strengthRow();
await page.fill('input[data-lab="build.mod.items.strength.n"]', '5'); await page.waitForTimeout(150);
const after = await strengthRow();
ok(after.includes('5') && after.join() !== before.join(), 'results update while typing ' + after.join(' '));
ok(await page.locator('#lab-acwr svg, #lab-acwr p').count() >= 1 && await page.locator('#lab-ac svg').count() === 1 && await page.locator('#lab-shot svg').count() === 1, 'builder charts drawn');
ok(await page.locator('.lab-list li').count() >= 3, 'tradeoffs and assumptions listed');
await shot('lab-build2');
await page.click('[data-act="lab-save"]'); await page.fill('#lab-name', 'Strength block'); await page.click('#lab-name-ok'); await page.waitForTimeout(200);
let S = await page.evaluate(() => doc('aos-sim').scenarios);
ok(S.length === 1 && S[0].name === 'Strength block' && S[0].snap && S[0].inputs.mod.items.strength.n === 5 && S[0].results?.metric === 'plan' && S[0].model === 'lab-1', 'scenario saved with inputs, baseline snapshot and results');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ml:aos-sim')).scenarios.length) === 1, 'saved to shared storage (aos-sim)');
await page.click('[data-act="lab-save"]'); await page.fill('#lab-name', 'Strength block'); await page.click('#lab-name-ok'); await page.waitForTimeout(200);
ok(await page.evaluate(() => doc('aos-sim').scenarios.length) === 1, 'duplicate save prevented');
// reopen accuracy: new real data must not change a saved simulation
const r1 = await page.evaluate(() => { const sc = doc('aos-sim').scenarios[0]; return JSON.stringify(planMetrics(sc.inputs.mod, sc.snap)); });
await page.evaluate(() => addWorkout(todayIso(), { type: 'lift', name: 'Real lift', mins: 60, int: 'hard', rpe: 8 }));
const r2 = await page.evaluate(() => { const sc = doc('aos-sim').scenarios[0]; return JSON.stringify(planMetrics(sc.inputs.mod, sc.snap)); });
ok(r1 === r2, 'saved simulation reopens with identical results after new data');
await page.evaluate(() => ACTIONS['lab-close']({ dataset: { kind: 'build' } }));
await page.evaluate(() => ACTIONS['lab-open']({ dataset: { id: doc('aos-sim').scenarios[0].id } })); await page.waitForTimeout(150);
ok(await page.locator('.lab-open').innerText().then((t) => t.includes('Strength block')) && await page.inputValue('input[data-lab="build.mod.items.strength.n"]') === '5', 'reopen restores inputs');
// rename, duplicate, delete
await open('lab', 'dash');
await page.click('[data-act="lab-more"]'); await page.fill('#lab-rn', 'Strength block v2'); await page.click('#lab-rn-ok'); await page.waitForTimeout(150);
ok(await page.evaluate(() => doc('aos-sim').scenarios[0].name) === 'Strength block v2', 'rename');
await page.click('[data-act="lab-more"] >> nth=0'); await page.click('#lab-dup'); await page.waitForTimeout(150);
ok(await page.evaluate(() => doc('aos-sim').scenarios.length) === 2, 'duplicate');
await page.click('[data-act="lab-more"] >> nth=0'); await page.click('#lab-del'); await page.click('#cf-ok'); await page.waitForTimeout(150);
ok(await page.evaluate(() => doc('aos-sim').scenarios.length) === 1, 'delete with confirmation');
// ---------- shooting ----------
await open('lab', 'shoot');
const k1 = await page.locator('.kpi').first().innerText();
await page.fill('input[data-lab="shoot.nAttempts"]', '400'); await page.fill('input[data-lab="shoot.nSessions"]', '5'); await page.waitForTimeout(150);
const k2 = await page.locator('.kpi').first().innerText();
ok(k1 !== k2 && k2.includes('2,000'), 'shooting volume updates live: ' + k2.replace(/\n/g, ' '));
ok(await page.locator('#lab-pct svg path').count() >= 3 && await page.locator('#lab-pct circle[fill="var(--fg)"]').count() > 0, 'shooting chart: measured dots + projections + range');
ok((await page.locator('#lab-out').innerText()).includes('Rates from your own sessions'), 'shooting uses your history when available');
await shot('lab-shoot2');
await page.click('[data-act="lab-save"]'); await page.click('#lab-name-ok'); await page.waitForTimeout(150);
ok(await page.evaluate(() => doc('aos-sim').scenarios.some((s) => s.kind === 'shoot' && s.results.metric === 'shootPct' && s.results.rows.length >= 3)), 'shooting simulation saved with projected checkpoints');
// ---------- athletic ----------
await open('lab', 'ath'); await page.selectOption('select[data-lab="ath.test"]', 'vert'); await page.waitForTimeout(200);
ok(await page.locator('#lab-ath svg').count() === 1 && (await page.locator('#lab-out').innerText()).includes('Your rate'), 'athletic chart from test history');
await page.fill('input[data-lab="ath.focusNew"]', '6'); await page.waitForTimeout(120);
ok((await page.locator('#lab-out').innerText()).includes('×1.5'), 'focus factor capped in UI');
await page.selectOption('select[data-lab="ath.test"]', 'broad'); await page.waitForTimeout(200);
ok(await page.locator('#lab-out .empty').count() === 1, 'missing measurement asks for a value');
await page.fill('input[data-lab="ath.cur"]', '100'); await page.waitForTimeout(150);
ok(await page.locator('#lab-ath svg').count() === 1 && (await page.locator('#lab-out').innerText()).includes('General assumption'), 'entered value uses labeled general assumption');
// ---------- training A vs B ----------
await open('lab', 'train');
await page.fill('input[data-lab="train.B.days"]', '7').catch(() => {}); await page.evaluate(() => { const i = $('input[data-lab="train.B.days"]'); i.value = 7; i.dispatchEvent(new Event('input', { bubbles: true })); });
await page.fill('input[data-lab="train.B.items.conditioning.n"]', '6'); await page.waitForTimeout(150);
ok((await page.locator('#lab-out').innerText()).match(/rest day|in a row|hard days/i), 'B with no rest flags recovery tradeoffs');
await page.click('[data-act="lab-ab"][data-w="swap"]'); await page.waitForTimeout(120);
ok(await page.inputValue('input[data-lab="train.A.items.conditioning.n"]') === '6', 'swap A and B');
ok(await page.locator('#lab-tload svg').count() === 1, 'workload chart drawn'); await shot('lab-train2');
// ---------- separation ----------
const realAfter = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((k) => /^ml:(day-|aos-plan|aos-goals|aos-tests|aos-shots|aos-coach)/.test(k)).sort().map((k) => [k, localStorage.getItem(k)])));
const onlyLift = await page.evaluate(() => exList(todayIso()).filter((x) => x.name !== 'Real lift').length === exList(todayIso()).length - 1);
ok(onlyLift && JSON.stringify(JSON.parse(realBefore).filter(([k]) => k !== 'ml:day-' + '2026-11-17')) === JSON.stringify(JSON.parse(realAfter).filter(([k]) => k !== 'ml:day-' + '2026-11-17')), 'simulations never touch real workouts, plan, goals, tests or shots');
ok(await page.evaluate(() => !JSON.stringify(doc('aos-plan')).includes('sim') && exList(todayIso()).every((x) => !x.sim)), 'no hypothetical workouts in real records');
// dashboard shows saved list & active
await open('lab', 'dash'); ok(await page.locator('[data-act="lab-open"]').count() === 2 && (await page.locator('main, body').first().innerText()).includes('Active simulation'), 'dashboard lists saved + active simulation');
// existing features untouched
await open('train', 'load'); ok(await page.locator('#combo svg').count() === 1, 'existing load chart'); await open('home'); await noErr('home');
}
