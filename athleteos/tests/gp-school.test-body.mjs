await page.evaluate(() => { const S = school(); S.classes.push({ id: 'c1', name: 'Chemistry', color: '#3d8bff', core: true }); S.items.push({ id: 'i1', title: 'Unit 4 test', cls: 'c1', type: 'test', due: shiftIso(todayIso(), 2), mins: 60, done: false }, { id: 'i2', title: 'Worksheet', cls: 'c1', type: 'hw', due: shiftIso(todayIso(), 1), mins: 30, done: false }); persist('life-school'); });
await page.goto(base + 'gameplan.html'); await page.waitForTimeout(700);
const sc = await page.locator('#school-card').innerText();
ok(!(await page.locator('#school-card').isHidden()) && sc.includes('Unit 4 test') && sc.includes('Worksheet'), 'Gameplan shows School work: ' + sc.replace(/\n/g, ' | ').slice(0, 160));
await page.click('#study-plan'); await page.waitForTimeout(300);
ok((await page.locator('#pb-preview').innerText()).includes('Study time from School'), 'Plan study time proposes blocks');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ml:life-school')).items.length) === 2, 'School data untouched by Gameplan');
