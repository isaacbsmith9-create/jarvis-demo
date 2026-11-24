// ===================== Hub: Sunday Weekly Plan =====================
// Builds a week (Mon–Sun; next week from Saturday on) from what the apps already know:
//   games/practices (calendar + Gameplan via tdItems), tests and due work (Student Lens), readiness (Recovery Lens),
//   and the day templates (round2.js). Rules: games and practices set the day; light the day before and after a game;
//   at most 2 hard days and never back to back; at least 1 rest day; study 2 days before each test, a work block the
//   day before each assignment. You can change any day's type or level, then approve: each day's template goes into
//   Gameplan (gp-d-<date>, src "Weekly plan") with the workout block renamed to that day's focus and study blocks added.
// Saved in doc "hub-week" { v, week: <Monday>, days: [...], approvedAt }. The morning brief shows "📅 Plan: <focus>".
SUBS.hub.splice(SUBS.hub.findIndex((s) => s[0] === 'goals'), 0, ['weekplan', 'Plan week']);
const WP_LEVEL = { hard: ['Hard', '#ef4444'], moderate: ['Moderate', '#f59e0b'], light: ['Light', '#22c55e'], rest: ['Rest', '#64748b'] };
const WP_KIND = { game: ['Game day', 'game'], practice: ['School + practice', 'school-practice'], off: ['Off day (school)', 'off'], weekend: ['Weekend', 'weekend'], sit: ['Sitting (varsity only)', 'off'], unsure: ['Not sure yet', 'off'] };
const WP_CHIPS = [['practice', 'Practice'], ['game', 'Game'], ['sit', 'Sit'], ['off', 'Off'], ['unsure', '?']];
const WP_SIT = /sitting|varsity only/i;
function wpHoliday(d) { const [y, m, dd] = d.split('-').map(Number), md = d.slice(5); if (['12-24', '12-25', '12-31', '01-01', '07-04'].includes(md)) return md === '12-25' ? 'Christmas' : md === '12-24' ? 'Christmas Eve' : md === '12-31' ? 'New Year’s Eve' : md === '01-01' ? 'New Year’s Day' : 'July 4th'; if (m === 11) { const first = new Date(y, 10, 1).getDay(), th = 1 + ((4 - first + 7) % 7) + 21; if (dd === th) return 'Thanksgiving'; } return null; }
const wpHist = () => doc('hub-week-hist') || { v: 1, weeks: {} };
function wpUsual(d) { const W = wpHist().weeks || {}, dow = parseIso(d).getDay(), c = {}; for (const mon of Object.keys(W).sort().slice(-6)) { const k = W[mon]?.[dow]; if (k && k !== 'unsure') c[k] = (c[k] || 0) + 1; } const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return top && top[1] >= 2 ? top[0] : null; }
const WP_FOCUS = ['Shooting volume: 300 shots, track makes', 'Finishing + handles: 60 min', 'Lower-body lift + 20 min form shooting', 'Game-speed shooting + conditioning'];
const WP_FOCUS_LIGHT = { game: 'Form shots + free throws, 15 min before the game', before: 'Light: 20 min form shooting + free throws', after: 'Recovery: stretch, walk, light shooting', practice: 'Practice is the session. Stretch after.', light: 'Light: 30 min shooting rhythm' };
let wpDraft = null;
const wpMonday = () => { const t = todayIso(), dow = parseIso(t).getDay(); return dow === 6 ? shiftIso(t, 2) : dow === 0 ? shiftIso(t, 1) : shiftIso(t, -(dow - 1)); };
const wpDoc = () => doc('hub-week');
function wpEvents(d) {
  const its = [...(hubSafe(() => tdItems(d), []) || []), ...(hubSafe(() => itemsOn(d), []) || []).filter((x) => !x.time).map((x) => ({ title: x.title, type: x.type, st: null }))];
  const isG = (x) => x.type === 'game' || (/\bgame\b|\bvs\.?\b|@/i.test(x.title) && ['practice', 'game'].includes(x.type));
  const game = its.find((x) => isG(x) && !WP_SIT.test(x.title)), sit = !game && its.find((x) => WP_SIT.test(x.title || ''));
  const prac = its.find((x) => x !== game && x !== sit && (x.type === 'practice' || /practice/i.test(x.title)));
  return { game, prac, sit };
}
function wpBuild(mon = wpMonday(), keep = null) {
  const days = [], t = todayIso();
  const rd = (() => { const R = doc('rl-ready')?.days || {}, v = []; for (let i = 0; i < 7; i++) { const s = R[shiftIso(t, -i)]?.score; if (s != null) v.push(s); } return v.length ? Math.round(sum(v) / v.length) : null; })();
  for (let i = 0; i < 7; i++) {
    const d = shiftIso(mon, i), dow = parseIso(d).getDay(), ev = wpEvents(d), k = keep?.[i];
    const hol = wpHoliday(d), base = dow === 0 || dow === 6 ? 'weekend' : 'off', usual = !ev.game && !ev.prac && !ev.sit && !hol ? wpUsual(d) : null;
    const kind = k?.kindLocked ? k.kind : ev.game ? 'game' : ev.prac ? 'practice' : ev.sit ? 'sit' : usual && usual !== base ? usual : base;
    const guess = !k?.kindLocked && !!usual && usual !== base && kind === usual;
    days.push({ date: d, kind, kindLocked: !!k?.kindLocked, guess, hol, level: k?.levelLocked ? k.level : null, levelLocked: !!k?.levelLocked, ev: { game: ev.game?.title || null, prac: ev.prac?.title || ev.sit?.title || null }, study: [], focus: '' });
  }
  const isGame = (i) => days[i]?.kind === 'game';
  // levels: games light, around games light, practice moderate; off/weekend fill with hard/moderate under the caps
  for (let i = 0; i < 7; i++) { const x = days[i]; if (x.levelLocked) continue;
    if (x.kind === 'unsure') { const near = isGame(i + 1) || isGame(i - 1); x.level = near ? 'light' : 'moderate'; x.focus = near ? 'Not sure yet: if practice happens, that’s it (game nearby). If not, 20 min form shooting.' : 'Not sure yet: if practice happens, that’s your session. If not, 45 min shooting.'; }
    else if (x.kind === 'game') { x.level = 'light'; x.focus = WP_FOCUS_LIGHT.game; }
    else if (isGame(i + 1)) { x.level = 'light'; x.focus = x.kind === 'practice' ? 'Practice only, nothing extra: game tomorrow' : WP_FOCUS_LIGHT.before; }
    else if (isGame(i - 1)) { x.level = x.kind === 'weekend' ? 'rest' : 'light'; x.focus = x.kind === 'practice' ? 'Practice only, then recover from the game' : WP_FOCUS_LIGHT.after; }
    else if (x.kind === 'practice') { x.level = 'moderate'; x.focus = WP_FOCUS_LIGHT.practice; }
    else if (x.hol && ['off', 'weekend'].includes(x.kind)) { x.level = 'rest'; }
    }
  let hard = days.filter((x) => x.level === 'hard').length, rot = 0;
  const hardOk = rd == null || rd >= 55;
  for (let i = 0; i < 7; i++) { const x = days[i]; if (x.level) continue;
    const nextToHard = days[i - 1]?.level === 'hard' || days[i + 1]?.level === 'hard';
    x.level = hardOk && hard < 2 && !nextToHard && x.kind !== 'sit' ? 'hard' : 'moderate'; if (x.level === 'hard') hard++; }
  if (!days.some((x) => x.level === 'rest')) {
    const cand = [6, 5, 0, 1, 2, 3, 4].map((i) => days[i]).find((x) => !x.levelLocked && x.kind !== 'game' && x.kind !== 'practice' && x.level !== 'hard') || [6, 5].map((i) => days[i]).find((x) => !x.levelLocked && x.kind !== 'game');
    if (cand) cand.level = 'rest';
  }
  for (const x of days) { if (x.level === 'rest') x.focus = 'Rest: sleep in, stretch, eat well';
    else if (x.level === 'hard' || (x.level === 'moderate' && !x.focus)) x.focus = WP_FOCUS[rot++ % WP_FOCUS.length] + (x.level === 'moderate' ? ' (keep it moderate)' : '');
    else if (!x.focus) x.focus = WP_FOCUS_LIGHT.light;
    if (x.kind === 'sit') x.focus += ' · Evening: sit with varsity. Eat before you go, bag packed.'; }
  // school: study 2 days before tests, a work block the day before assignments
  const S = doc('life-school');
  if (S) for (const it of (hubSafe(() => scDue(mon, shiftIso(mon, 8)), []) || [])) {
    const cls = hubSafe(() => scClass(it.cls)?.name, '') || '', test = HP_TESTS.includes(it.type);
    const di = Math.round((parseIso(it.due) - parseIso(mon)) / 864e5);
    const put = (j, title, mins) => { if (j >= 0 && j < 7 && days[j].study.length < 3) days[j].study.push({ title, mins, due: it.due }); };
    if (test) { put(di - 2, `Study: ${it.title}${cls ? ` (${cls})` : ''}`, 30); put(di - 1, `Review: ${it.title}`, 45); }
    else put(di - 1, `${it.title}${cls ? ` (${cls})` : ''}`, it.mins || 45);
  }
  return { v: 1, week: mon, days, readiness: rd, built: Date.now(), approvedAt: null };
}
function wpBlocks(x) {
  const tpl = (hubSafe(() => r2List(), []) || []).find((t) => t.id === WP_KIND[x.kind][1]); if (!tpl) return [];
  const have = hubSafe(() => tdItems(x.date), []) || [], norm = (s) => String(s || '').toLowerCase();
  // skip template blocks your schedule already has (same title, or a practice/game within an hour of it)
  let out = tpl.blocks.map((b) => ({ ...b })).filter((b) => !have.some((h) => norm(h.title) === norm(b.title) || (['practice'].includes(b.type) && (['practice', 'game'].includes(h.type) || /practice|game/i.test(h.title)) && Math.abs(h.st - b.start) <= 60)));
  const wi = out.findIndex((b) => b.type === 'train' && !/warm-up/i.test(b.title));
  const noExtra = x.level === 'rest' || x.kind === 'game' || /^Practice (is the session|only)/.test(x.focus);
  if (wi >= 0 && noExtra) out.splice(wi, 1);
  else if (wi >= 0) {
    const [head, ...rest] = x.focus.split(':'), tail = rest.join(':').trim();
    out[wi].title = (tail && /^(light|recovery|rest)$/i.test(head.trim()) ? tail : head).replace(/\s*\(keep it moderate\)/, '').slice(0, 44);
    if (x.level === 'light') out[wi].mins = Math.min(out[wi].mins, 30);
  }
  const hw = out.findIndex((b) => b.type === 'focus'); let at = hw >= 0 ? out[hw].start + out[hw].mins : 19 * 60 + 30;
  for (const s of x.study) { out.push({ title: s.title.slice(0, 60), start: at, mins: s.mins, type: 'focus' }); at += s.mins; }
  return out.sort((a, b) => a.start - b.start);
}
function wpApprove() {
  const W = wpDraft; if (!W) return; let n = 0;
  for (const x of W.days) {
    if (x.date < todayIso()) continue;
    const k = 'gp-d-' + x.date, d = doc(k) || (cache[k] = { blocks: [], entries: [], night: { done: {}, completedAt: null } }); d.blocks = d.blocks || [];
    for (const b of wpBlocks(x)) { const st = r1Clk(b.start); if (d.blocks.some((y) => y.title === b.title)) continue; d.blocks.push({ id: uid('b'), title: b.title, start: st, mins: b.mins, type: b.type, done: false, src: 'Weekly plan' }); n++; }
    persist(k);
  }
  W.approvedAt = Date.now(); cache['hub-week'] = JSON.parse(JSON.stringify(W)); persist('hub-week');
  const H = wpHist(); H.weeks = { ...(H.weeks || {}), [W.week]: Object.fromEntries(W.days.map((x) => [parseIso(x.date).getDay(), x.kind])) }; for (const k of Object.keys(H.weeks).sort().slice(0, -12)) delete H.weeks[k]; cache['hub-week-hist'] = H; persist('hub-week-hist'); hubSafe(() => saveBrief());
  toast(`Week approved: ${n} blocks added to Gameplan`); refresh();
}
function wpHtml() {
  const cur = wpDoc(), mon = wpMonday();
  if (!wpDraft) wpDraft = cur && cur.week === mon ? JSON.parse(JSON.stringify(cur)) : wpBuild(mon);
  const W = wpDraft, approved = cur?.week === W.week && cur.approvedAt && JSON.stringify(cur.days) === JSON.stringify(W.days);
  const opt = (obj, val) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === val ? ' selected' : ''}>${v[0]}</option>`).join('');
  const hardN = W.days.filter((x) => x.level === 'hard').length, restN = W.days.filter((x) => x.level === 'rest').length, games = W.days.filter((x) => x.kind === 'game').length, studyN = sum(W.days.map((x) => x.study.length));
  return `<section class="hub-head"><h1>Plan week</h1><p class="hub-sum">Week of ${fmtD(W.week)}: ${games ? `${games} game${games > 1 ? 's' : ''}, ` : ''}${hardN} hard day${hardN === 1 ? '' : 's'}, ${restN} rest, ${studyN} study block${studyN === 1 ? '' : 's'}${W.readiness != null ? ` · readiness avg ${W.readiness}` : ''}.</p></section>
    ${W.readiness != null && W.readiness < 55 ? '<div class="notice warn">Your readiness has averaged under 55 this week, so no day is set to hard. Sleep and food first.</div>' : ''}
    <section class="card"><ul class="wp-days">${W.days.map((x, i) => `<li style="--c:${WP_LEVEL[x.level][1]}"${x.date < todayIso() ? ' class="past"' : ''}><div class="wp-d"><b>${DOW[parseIso(x.date).getDay()]}</b><small>${fmtD(x.date)}</small></div>
      <div class="wp-main"><div class="wp-chips" role="group" aria-label="What is this day?">${WP_CHIPS.map(([k, l]) => { const on = x.kind === k || (k === 'off' && x.kind === 'weekend'); return `<button type="button" class="chip${on ? ' on' : ''}" data-wpc="${i}" data-k="${k}">${l}</button>`; }).join('')}</div>
      <div class="wp-sel"><select data-wpl="${i}" aria-label="Training level">${opt(WP_LEVEL, x.level)}</select>${x.guess ? '<span class="tag">your usual</span>' : ''}${x.hol ? `<span class="tag">🎉 ${esc(x.hol)}</span>` : ''}</div>
      <p class="wp-focus">${esc(x.focus)}</p>${x.ev.game || x.ev.prac ? `<p class="tiny muted">From your schedule: ${esc([x.ev.game, x.ev.prac].filter(Boolean).join(' · '))}</p>` : ''}
      ${x.study.map((s) => `<p class="wp-study">📚 ${esc(s.title)} · ${s.mins} min</p>`).join('')}</div></li>`).join('')}</ul>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn sm" id="wp-re">↻ Rebuild</button>${aiOn() ? '<button type="button" class="btn sm" id="wp-ai">✨ Ask Claude to review</button>' : ''}<button type="button" class="btn primary" id="wp-ok">${approved ? '✓ Approved · add again' : 'Approve and add to Gameplan'}</button></div>
      <p class="tiny muted" style="margin:8px 0 0">Approving adds each day’s blocks to Gameplan (days already passed are skipped; a block already on that day is never added twice). Change a day’s type or level first if it’s off. ↻ Rebuild keeps the days you changed.</p></section>`;
}
HUB.weekplan = (el) => { el.innerHTML = wpHtml(); };
document.addEventListener('change', (e) => {
  const k = e.target.closest?.('[data-wpk]'), l = e.target.closest?.('[data-wpl]'); if (!wpDraft || (!k && !l)) return;
  const x = wpDraft.days[+(k || l).dataset[k ? 'wpk' : 'wpl']];
  if (k) { x.kind = k.value; x.kindLocked = true; wpDraft = wpBuild(wpDraft.week, wpDraft.days); }
  else { x.level = l.value; x.levelLocked = true; wpDraft = wpBuild(wpDraft.week, wpDraft.days); }
  refresh();
});
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-wpc]');
  if (c && wpDraft) { const x = wpDraft.days[+c.dataset.wpc], dow = parseIso(x.date).getDay(); x.kind = c.dataset.k === 'off' && (dow === 0 || dow === 6) ? 'weekend' : c.dataset.k; x.kindLocked = true; x.guess = false; wpDraft = wpBuild(wpDraft.week, wpDraft.days); refresh(); return; }
  if (e.target.id === 'wp-re') { wpDraft = wpBuild(wpDraft?.week || wpMonday(), wpDraft?.days); refresh(); toast('Rebuilt from your latest schedule'); }
  if (e.target.id === 'wp-ok') wpApprove();
  if (e.target.id === 'wp-ai') { const W = wpDraft, q = `Review my plan for the week of ${fmtD(W.week)} and suggest specific changes (which day, what to change, why): ${W.days.map((x) => `${DOW[parseIso(x.date).getDay()]} ${WP_KIND[x.kind][0]}, ${WP_LEVEL[x.level][0]}: ${x.focus}${x.study.length ? '; ' + x.study.map((s) => s.title).join(', ') : ''}`).join(' | ')}`; go('hub', 'ask'); setTimeout(() => { const ta = $('#ask-q'); if (ta) { ta.value = q.slice(0, 600); $('#ask-f')?.requestSubmit(); } }, 250); }
  if (e.target.closest('[data-wpgo]')) go('hub', 'weekplan');
});
// Weekend card on Hub Today until next week is approved
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => {
  const dow = parseIso(todayIso()).getDay(), W = wpDoc(); if (!(dow === 6 || dow === 0 || (dow === 1 && new Date().getHours() < 12))) return;
  if (W?.week === wpMonday() && W.approvedAt) return;
  (el.querySelector('.r3-now') || el.querySelector('.cap') || el.querySelector('.hub-head'))?.insertAdjacentHTML('afterend', `<section class="card wp-card"><h3>📅 Plan ${dow === 1 ? 'this' : 'next'} week</h3><p class="small muted" style="margin:4px 0 10px">Games, practices, tests and readiness are already in. Takes 2 minutes: check it, change anything, approve.</p><button type="button" class="btn primary" data-wpgo>Plan the week</button></section>`);
}); }; }
// Morning brief: today's planned focus
{ const _bf = briefFor; briefFor = function (date) { const B = _bf(date); try { const W = wpDoc(), x = W?.approvedAt && W.days.find((y) => y.date === date); if (x) { const i = B.lines.findIndex((l) => l.startsWith('🍗')); B.lines.splice(i < 0 ? B.lines.length : i, 0, `📅 Plan: ${WP_LEVEL[x.level][0]} · ${x.focus}`); B.text = B.lines.join('\n'); } } catch {} return B; }; window.Ecosystem = { ...(window.Ecosystem || {}), brief: briefFor, week: { build: wpBuild, blocks: wpBlocks } }; }
