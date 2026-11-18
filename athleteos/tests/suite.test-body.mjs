// ---------- suite: switcher, theme, signals, MacroLens update, Gameplan look ----------
const errs = () => errors.length;
ok(await page.locator('#suite-host .suite-btn').count() === 1 && (await page.locator('.suite-btn').innerText()).includes('Athlete'), 'Athlete OS brand is the app switcher');
await page.click('.suite-btn'); ok(await page.locator('.suite-menu:not([hidden]) .suite-item').count() === 3, 'menu lists 3 apps');
ok(await page.locator('.suite-item.on[data-suite="aos"]').count() === 1, 'current app marked');
await shot('suite-menu');
await page.keyboard.press('Escape'); ok(await page.locator('.suite-menu').isHidden(), 'Escape closes menu');
await page.click('.suite-btn'); await page.mouse.click(200, 600); ok(await page.locator('.suite-menu').isHidden(), 'outside click closes menu');
await page.waitForTimeout(1800);
const sig = await page.evaluate(() => JSON.parse(localStorage.getItem('ml:aos-signals') || 'null'));
ok(sig && sig.app === 'aos' && sig.week && 'acwr' in sig && Object.keys(sig.plannedByDay).length === 7 && sig.trainDays >= 0, 'Athlete OS writes its weekly signals ' + JSON.stringify(sig)?.slice(0, 160));
const sigLen = await page.evaluate(() => localStorage.getItem('ml:aos-signals'));
await page.reload(); await page.waitForTimeout(1800);
ok(await page.evaluate(() => localStorage.getItem('ml:aos-signals')) === sigLen, 'signals not rewritten when nothing changed');
// add a workout while in AOS, go to Gameplan through the switcher, and check the save happened
await page.evaluate(() => addWorkout(todayIso(), { type: 'shooting', name: 'Suite test', mins: 30, int: 'moderate' }));
await page.click('.suite-btn'); await page.click('[data-suite="gp"]'); await page.waitForURL(/gameplan/); await page.waitForTimeout(800);
ok(await page.locator('#suite-host .suite-btn').count() === 1 && (await page.locator('.suite-btn').innerText()).includes('Game'), 'Gameplan has the same switcher');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === (process.env.THEME || 'dark'), 'Gameplan follows the shared theme');
ok(await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Inter') && getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() !== '#0d1512'), 'Gameplan uses the suite look');
await overflow('gameplan'); await shot('suite-gameplan');
await page.waitForTimeout(1600);
const gs = await page.evaluate(() => JSON.parse(localStorage.getItem('ml:gp-sig') || 'null'));
ok(gs && gs.app === 'gp' && Object.keys(gs.busyMinsByDay).length === 7, 'Gameplan writes its weekly signals (gp-sig)');
ok(await page.evaluate(() => (JSON.parse(localStorage.getItem('ml:day-' + todayIso()) || '{}').exercise || []).some((x) => x.name === 'Suite test')), 'switching apps kept the new workout');
// to MacroLens
await page.click('.suite-btn'); await page.click('[data-suite="ml"]'); await page.waitForURL(/macrolens/); await page.waitForTimeout(800);
ok(await page.locator('#suite-host .suite-btn').count() === 1, 'MacroLens has the same switcher');
ok(await page.locator('#gd').count() === 1 && await page.locator('#g-kind').count() === 1, 'MacroLens copy has the new game-day mode');
await overflow('macrolens'); await shot('suite-macrolens');
// deep link still works
await page.goto(base + 'index.html'); await page.goto(base + 'macrolens.html#coach-schedule'); await page.waitForTimeout(600);
ok(await page.evaluate(() => !document.getElementById('view-coach')?.hidden), 'MacroLens deep link still opens a section');
// theme change in Athlete OS applies to Gameplan
await page.goto(base + 'index.html'); await page.waitForTimeout(400);
const other = (process.env.THEME || 'dark') === 'dark' ? 'light' : 'dark';
await page.evaluate((t) => localStorage.setItem('macrolens-theme', t), other);
await page.goto(base + 'gameplan.html'); await page.waitForTimeout(400);
ok(await page.evaluate(() => document.documentElement.dataset.theme) === other, 'theme choice carries across apps');
await page.evaluate((t) => localStorage.setItem('macrolens-theme', t), process.env.THEME || 'dark');
await page.goto(base + 'index.html'); await page.waitForTimeout(400);
ok(!(await page.locator('text=Something went wrong').count()), 'Athlete OS still renders');
