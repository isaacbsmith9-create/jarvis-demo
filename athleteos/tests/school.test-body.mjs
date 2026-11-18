await page.click('.suite-btn'); await page.click('[data-suite="school"]'); await page.waitForURL(/school/); await page.waitForTimeout(600);
ok((await page.locator('.suite-btn').innerText()).includes('School') && await page.locator('.tabbar').isHidden(), 'School app with switcher, no Athlete OS tab bar');
ok(await page.evaluate(() => state.view === 'school'), 'opens on School');
await overflow('school empty'); 
// add two classes
for (const [n, core] of [['Chemistry', true], ['Weights PE', false]]) { await page.evaluate(() => ACTIONS['sc-class']({ dataset: {} })); await page.fill('#c-name', n); if (!core) await page.uncheck('#c-core'); await page.click('#c-save'); await page.waitForTimeout(100); }
ok(await page.evaluate(() => school().classes.length) === 2, 'classes added');
// test tomorrow + homework today
await page.evaluate(() => ACTIONS['sc-item']({ dataset: {} })); await page.fill('#i-title', 'Unit 4 test'); await page.selectOption('#i-type', 'test'); await page.selectOption('#i-cls', { index: 1 }); await page.fill('#i-mins', '60'); await page.click('#i-save');
await page.evaluate(() => ACTIONS['sc-item']({ dataset: {} })); await page.fill('#i-title', 'Worksheet'); await page.fill('#i-due', await page.evaluate(() => shiftIso(todayIso(), -1))); await page.click('#i-save'); await page.waitForTimeout(150);
const due = await page.locator('#vbody').innerText();
ok(/1 overdue/.test(due) && due.includes('Unit 4 test') && due.includes('Overdue'), 'Due screen: overdue + this week');
// grades: chem 92/100 test, PE 65/100 test
for (const [i, s] of [[0, 92], [1, 65]]) { await page.evaluate(() => ACTIONS['sc-grade']({ dataset: {} })); await page.selectOption('#g-cls', { index: i }); await page.fill('#g-score', String(s)); await page.click('#g-save'); await page.waitForTimeout(100); }
const G = await page.evaluate(() => ({ g: gpa(), core: gpa((c) => c.core), e: eligibility().flag, pct: school().classes.map(classPct) }));
ok(G.g === 2.5 && G.core === 4 && G.e === 'watch' && G.pct.join() === '92,65', 'GPA, core GPA and eligibility math ' + JSON.stringify(G));
await page.evaluate(() => go('school', 'grades')); await page.waitForTimeout(150); ok(await page.locator('.sc-bar').count() === 2, 'grade bars'); await overflow('school grades'); await shot('school-grades');
await page.evaluate(() => go('school', 'classes')); await page.waitForTimeout(150); ok((await page.locator('#vbody').innerText()).includes('Core'), 'classes list');
await page.evaluate(() => go('school', 'due')); await page.waitForTimeout(150); await shot('school-due');
await page.locator('[data-sc-done]').first().evaluate((c) => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(200);
ok(await page.evaluate(() => scOverdue().length === 0), 'checking off removes overdue');
ok(await page.evaluate(() => !!localStorage.getItem('ml:life-school')), 'saved in shared storage (life-school)');
// back to Athlete OS
await page.click('.suite-btn'); await page.click('[data-suite="aos"]'); await page.waitForURL(/index/); await page.waitForTimeout(600);
ok((await page.locator('[data-widget="school"]').innerText()).includes('Unit 4 test'), 'Home: School this week');
ok(/Due tomorrow: Unit 4 test/.test(await page.locator('[data-df]').innerText()), 'Do first: due tomorrow');
ok(/Test tomorrow: Unit 4 test/.test(await page.locator('[data-widget="command"]').innerText()), 'daily briefing mentions the test');
ok(await page.locator('.wkc-sc').count() >= 1, 'week calendar school badge');
await page.evaluate(() => { setUi('calView', 'day'); setUi('calDay', shiftIso(todayIso(), 1)); go('train', 'plan'); }); await page.waitForTimeout(200);
ok((await page.locator('#day-card').innerText()).includes('FROM SCHOOL'), 'calendar day shows school items');
ok(await page.locator('.tabbar .tab').count() === 7, 'Athlete OS tab bar unchanged');
