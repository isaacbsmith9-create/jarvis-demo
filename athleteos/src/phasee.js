// ===================== Hub 2.0 phases E + F: Ask AI, Records (achievements, personal records, search, export) =====================
// Ask: one question box over every app's data (Claude "sample" capability, same as Coach). Last 30 Q&As in doc "hub-ask".
// Records: personal records and achievements computed from day docs, plus search across every app and an export.
// Reads only; writes nothing except "hub-ask".
SUBS.hub.splice(SUBS.hub.findIndex((s) => s[0] === 'goals') + 1, 0, ['ask', 'Ask AI'], ['records', 'Records']);

// ---------- E. Ask AI ----------
const ASK_SUGGEST = ['Am I ready to go hard today?', 'What’s due this week and what should I do first?', 'How is my shooting trending?', 'What should I eat today to hit protein?', 'Plan my afternoon around practice and homework', 'What’s the biggest thing holding me back right now?'];
let askBusy = false;
const askDoc = () => doc('hub-ask') || { v: 1, items: [] };
function hubContext() {
  const t = todayIso(), next = []; for (let i = 0; i < 7; i++) next.push(shiftIso(t, i));
  const S = doc('life-school');
  return {
    today: t, weekday: DOW[parseIso(t).getDay()],
    athlete: hubSafe(() => snapshot(28), null),
    appSummaries: hubSafe(() => Ecosystem.signals(), null),
    morningBrief: { today: hubSafe(() => briefFor(t).lines, null), tomorrow: hubSafe(() => briefFor(shiftIso(t, 1)).lines, null) },
    readiness: { today: hubSafe(() => hpReady(t), null), last7: next.map((d, i) => shiftIso(t, -i)).map((d) => ({ date: d, score: hubSafe(() => hpReady(d), null) })).filter((x) => x.score != null) },
    schedule7days: next.map((d) => ({ date: d, items: (hubSafe(() => tdItems(d), []) || []).slice(0, 12).map((x) => ({ time: x.st != null ? `${Math.floor(x.st / 60)}:${String(x.st % 60).padStart(2, '0')}` : null, title: x.title, type: x.type, from: x.src || null })) })).filter((x) => x.items.length),
    school: S ? { gpa: S.gpa ?? null, classes: (S.classes || []).filter((c) => c.active !== false).map((c) => ({ name: c.name, gradePct: c.slPct ?? null, letter: c.letter ?? null, lateWork: c.latePolicy || null, ends: c.endDate || null, starts: c.startDate || null })),
      due14days: hubSafe(() => scDue(t, shiftIso(t, 14)), []).slice(0, 30).map((x) => ({ due: x.due, title: x.title, type: x.type, cls: hubSafe(() => scClass(x.cls)?.name, null) })) } : null,
    gameplanTasks: (doc('gp-core')?.tasks || []).filter((x) => !x.done).slice(0, 20).map((x) => ({ title: x.title, due: x.due || null })),
    trainingCenter: doc('btc-sig') || null,
    goals: hubSafe(() => goals().map((g) => ({ title: g.title, target: g.target, by: g.date || null, status: goalState(g).status, pct: goalState(g).pct })), []),
    insights: hubSafe(() => engInsights().slice(0, 10).map((x) => ({ kind: x.kind, title: x.title, detail: x.detail || x.text || null })), []),
    note: 'null or missing = not recorded. Never invent numbers.',
  };
}
const ASK_RULES = `You are the Hub assistant for a 16-year-old high-school basketball guard. The Hub connects his apps: Recovery Lens (readiness, sleep), Training Center (drills, shooting), Athlete OS (training load, tests), Student Lens (classes, grades, due work), Gameplan (daily schedule, tasks) and MacroLens (food, protein).
Rules: Use ONLY the JSON data below. null/missing means not recorded: say so, never invent numbers. Correlation is not causation. No medical diagnoses; for pain or injury say see a trainer or doctor. Never encourage restrictive eating or cutting weight.
Answer like a sharp coach and planner: direct, specific, use his real numbers, dates and class names. Prefer short sections and bullet points with exact actions (times, sets, minutes, grams). Keep it under 250 words unless asked for a plan. Address him as "you". Plain text with "- " bullets, no markdown tables.`;
function askFormat(a) {
  return esc(a).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map((p) => {
    const ls = p.split('\n');
    if (ls.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l))) return `<ul>${ls.map((l) => `<li>${l.replace(/^\s*([-•*]|\d+[.)])\s+/, '')}</li>`).join('')}</ul>`;
    return `<p>${ls.join('<br>')}</p>`;
  }).join('');
}
async function askRun(q, el) {
  q = String(q || '').trim(); if (!q || askBusy) return;
  if (!aiOn()) { toast('Ask AI works when the Hub is open inside Claude'); return; }
  askBusy = true; HUB.ask(el, q);
  try {
    const hist = askDoc().items.slice(-4).map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n\n');
    const a = String(await askAI(`${ASK_RULES}\n\nDATA:\n${JSON.stringify(hubContext())}\n\n${hist ? `Earlier in this chat:\n${hist}\n\n` : ''}Question: ${q}`, false)).trim();
    const D = askDoc(); D.items = [...D.items, { q, a, at: Date.now() }].slice(-30); cache['hub-ask'] = D; persist('hub-ask');
  } catch (e) { toast(aiError(e)); }
  askBusy = false; HUB.ask(el);
}
HUB.ask = (el, pending) => {
  const items = askDoc().items.slice().reverse();
  el.innerHTML = `<section class="hub-head"><h1>Ask AI</h1><p class="hub-sum">Ask anything about your training, recovery, school, schedule or food. It answers from all your apps at once. The coaches inside each app still work as before.</p></section>
    ${aiOn() ? '' : aiUnavailable()}
    <section class="card ask-box"><form id="ask-f"><textarea id="ask-q" rows="2" maxlength="600" placeholder="e.g. Should I lift today or shoot? I have a Spanish quiz tomorrow." ${askBusy ? 'disabled' : ''}>${pending ? esc(pending) : ''}</textarea>
      <div class="row" style="margin-top:8px;justify-content:space-between;gap:8px"><span class="tiny muted">Uses your data from every app. Nothing is sent anywhere else.</span><button class="btn primary" type="submit" ${askBusy ? 'disabled' : ''}>${askBusy ? 'Thinking…' : 'Ask'}</button></div></form>
      <div class="ask-chips">${ASK_SUGGEST.map((s) => `<button type="button" class="chip" data-hask="${esc(s)}" ${askBusy ? 'disabled' : ''}>${esc(s)}</button>`).join('')}</div></section>
    ${pending ? `<section class="card ask-a"><b class="ask-qt">${esc(pending)}</b><p class="muted">Reading your apps…</p></section>` : ''}
    ${items.map((x) => `<section class="card ask-a"><div class="row" style="justify-content:space-between;gap:8px"><b class="ask-qt">${esc(x.q)}</b><span class="tiny muted">${fmtD(isoOf(x.at))}</span></div><div class="ask-body">${askFormat(x.a)}</div></section>`).join('')}
    ${items.length ? '<div style="text-align:center;margin:10px 0"><button type="button" class="btn sm" data-askclear>Clear history</button></div>' : ''}`;
  $('#ask-f', el).onsubmit = (e) => { e.preventDefault(); askRun($('#ask-q', el).value, el); };
  $('#ask-q', el).onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askRun(e.target.value, el); } };
  el.onclick = (e) => {
    const c = e.target.closest('[data-hask]'); if (c) return askRun(c.dataset.hask, el);
    if (e.target.closest('[data-askclear]')) { cache['hub-ask'] = { v: 1, items: [] }; persist('hub-ask'); HUB.ask(el); }
  };
};
const isoOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- F. Records: personal records, achievements, search, export ----------
function recDays() { return allDayKeys().filter((d) => d <= todayIso()); }
function recStreak(days, ok) {
  let best = 0, bestEnd = null, cur = 0, prev = null;
  for (const d of days) { if (!ok(d)) { cur = 0; prev = d; continue; } cur = prev && shiftIso(prev, 1) === d && cur ? cur + 1 : 1; prev = d; if (cur > best) { best = cur; bestEnd = d; } }
  // current streak: count back from today (or yesterday if today isn't done yet)
  let now = 0, d = ok(todayIso()) ? todayIso() : shiftIso(todayIso(), -1); while (ok(d)) { now++; d = shiftIso(d, -1); }
  return { best, bestEnd, now };
}
function recordsData() {
  const days = recDays(), t = todayIso(), first = days[0] || t, all = []; for (let d = first; d <= t; d = shiftIso(d, 1)) all.push(d);
  const trained = (d) => exList(d).length > 0, mins = (d) => sum(exList(d).map((x) => +x.mins || 0));
  const btc = all.flatMap((d) => btcOn(d).map((w) => ({ d, ...(w.btc || {}), mins: w.mins, name: w.name })));
  const proteinHit = (d) => hubSafe(() => hasFood(d) && totalsOf(d).protein >= targets(d).protein, false);
  const ready = all.map((d) => ({ d, v: hubSafe(() => hpReady(d), null) })).filter((x) => x.v != null);
  const sleep = all.map((d) => ({ d, v: hubSafe(() => hpSleepNight(d), null) })).filter((x) => x.v != null && x.v < 16);
  const weeks = {}; for (const d of all) { const w = mondayOf(d); weeks[w] = (weeks[w] || 0) + mins(d); }
  const bestWeek = Object.entries(weeks).sort((a, b) => b[1] - a[1])[0];
  const shotDays = all.map((d) => ({ d, a: sum(btcOn(d).map((w) => w.btc?.attempts || 0)), m: sum(btcOn(d).map((w) => w.btc?.makes || 0)) })).filter((x) => x.a > 0);
  const bestPct = shotDays.filter((x) => x.a >= 50).map((x) => ({ ...x, p: Math.round((x.m / x.a) * 100) })).sort((a, b) => b.p - a.p || b.a - a.a)[0];
  const mostMakes = shotDays.slice().sort((a, b) => b.m - a.m)[0];
  const max = (arr) => arr.slice().sort((a, b) => b.v - a.v)[0];
  const tr = recStreak(all, trained), pr = recStreak(all, proteinHit), totalMakes = sum(shotDays.map((x) => x.m)), totalSessions = sum(all.map((d) => exList(d).length));
  const S = doc('life-school');
  const records = [
    ['Best shooting day', bestPct ? `${bestPct.p}%` : null, bestPct ? `${bestPct.m}/${bestPct.a} · ${fmtD(bestPct.d)}` : 'Shoot 50+ in a Training Center session', 'btc'],
    ['Most makes in a day', mostMakes ? String(mostMakes.m) : null, mostMakes ? fmtD(mostMakes.d) : 'Log makes in the Training Center', 'btc'],
    ['Longest training streak', tr.best ? `${tr.best} day${tr.best > 1 ? 's' : ''}` : null, tr.best ? `Now: ${tr.now} · best ended ${fmtD(tr.bestEnd)}` : 'Train 2 days in a row', 'aos'],
    ['Most training in a week', bestWeek && bestWeek[1] ? `${Math.round(bestWeek[1])} min` : null, bestWeek && bestWeek[1] ? `Week of ${fmtD(bestWeek[0])}` : 'Log workouts', 'aos'],
    ['Highest readiness', ready.length ? String(max(ready).v) : null, ready.length ? fmtD(max(ready).d) : 'Do a morning check-in in Recovery Lens', 'rl'],
    ['Longest sleep', sleep.length ? `${r1(max(sleep).v)} h` : null, sleep.length ? fmtD(max(sleep).d) : 'Log sleep in Recovery Lens', 'rl'],
    ['Protein streak', pr.best ? `${pr.best} day${pr.best > 1 ? 's' : ''}` : null, pr.best ? `Now: ${pr.now}` : 'Hit your protein target in MacroLens', 'ml'],
    ['GPA', S?.gpa != null ? String(S.gpa) : null, S?.gpa != null ? 'From Student Lens' : 'Add grades in Student Lens', 'school'],
  ];
  const A = (id, name, desc, cur, goal, app) => ({ id, name, desc, cur: Math.min(cur, goal), goal, done: cur >= goal, app });
  const achievements = [
    A('first', 'First rep', 'Log your first workout', totalSessions, 1, 'aos'),
    A('s7', 'Locked in', '7-day training streak', tr.best, 7, 'aos'),
    A('s30', 'Unbreakable', '30-day training streak', tr.best, 30, 'aos'),
    A('n50', 'Fifty deep', '50 workouts logged', totalSessions, 50, 'aos'),
    A('n200', 'Gym rat', '200 workouts logged', totalSessions, 200, 'aos'),
    A('tc10', 'Training Center regular', '10 Training Center sessions', btc.length, 10, 'btc'),
    A('m1k', '1,000 makes', '1,000 makes logged', totalMakes, 1000, 'btc'),
    A('m5k', '5,000 makes', '5,000 makes logged', totalMakes, 5000, 'btc'),
    A('m10k', '10,000 makes', '10,000 makes logged', totalMakes, 10000, 'btc'),
    A('p50', 'Knock-down shooter', '50%+ on a 50-shot day', bestPct ? bestPct.p : 0, 50, 'btc'),
    A('p7', 'Fueled', '7-day protein streak', pr.best, 7, 'ml'),
    A('r80', 'Fully charged', 'Readiness 80+ on 5 days', ready.filter((x) => x.v >= 80).length, 5, 'rl'),
    A('sl8', 'Sleep stack', '8+ hours of sleep on 7 nights', sleep.filter((x) => x.v >= 8).length, 7, 'rl'),
    A('w300', 'Big week', '300 training minutes in one week', bestWeek ? Math.round(bestWeek[1]) : 0, 300, 'aos'),
  ];
  return { records, achievements };
}
function recSearch(q) {
  q = q.trim().toLowerCase(); if (q.length < 2) return [];
  const t = todayIso(), hit = (s) => String(s || '').toLowerCase().includes(q), out = [];
  for (const e of hubSafe(() => evStream(shiftIso(t, -365), t), []) || []) if (hit(e.title) || hit(e.detail)) out.push({ app: e.app, date: e.date, title: e.title, detail: e.detail });
  const S = doc('life-school'); for (const c of S?.classes || []) if (hit(c.name) || hit(c.teacher)) out.push({ app: 'school', date: null, title: c.name, detail: ['Class', c.letter || (c.slPct != null ? c.slPct + '%' : ''), c.latePolicy === 'none' ? 'no late work' : ''].filter(Boolean).join(' · ') });
  for (const x of S?.items || []) if (hit(x.title) || hit(x.notes)) out.push({ app: 'school', date: x.due || null, title: x.title, detail: [x.type, hubSafe(() => scClass(x.cls)?.name, '')].filter(Boolean).join(' · ') });
  for (const x of doc('gp-core')?.tasks || []) if (hit(x.title)) out.push({ app: 'gp', date: x.due || null, title: x.title, detail: x.done ? 'Task · done' : 'Task' });
  for (const g of hubSafe(() => goals(), []) || []) if (hit(g.title)) out.push({ app: 'aos', date: g.date || null, title: g.title, detail: 'Goal' });
  for (const x of askDoc().items) if (hit(x.q) || hit(x.a)) out.push({ app: 'aos', date: isoOf(x.at), title: 'Ask AI: ' + x.q, detail: x.a.replace(/\*\*/g, '').replace(/\s+/g, ' ').slice(0, 120) });
  const seen = new Set();
  return out.filter((x) => { const k = x.app + x.date + x.title; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 60);
}
async function recSave(name, text) {
  try { const dl = window.claude?.use ? await claude.use('downloads') : null; if (!dl) throw new Error('none'); await dl.save({ filename: name, data: text }); toast('Saved ' + name); }
  catch { try { await navigator.clipboard.writeText(text); toast('Downloads aren’t available here, so it was copied instead'); } catch { toast('Couldn’t save the file here'); } }
}
function recExportJson() {
  const out = {}; for (const k of Object.keys(cache).sort()) if (!k.startsWith('tc-backup-')) out[k] = cache[k];
  return JSON.stringify({ exportedAt: new Date().toISOString(), docs: out }, null, 1);
}
function recExportText() {
  const { records, achievements } = recordsData(), t = todayIso();
  return [`Hub summary · ${fmtD(t)}`, '', 'PERSONAL RECORDS', ...records.map((r) => `- ${r[0]}: ${r[1] ?? 'not yet'}${r[1] ? ` (${r[2]})` : ''}`), '', 'ACHIEVEMENTS', ...achievements.map((a) => `- [${a.done ? 'x' : ' '}] ${a.name}: ${a.desc} (${a.cur}/${a.goal})`), '', 'MORNING BRIEF', ...(hubSafe(() => briefFor(t).lines, []) || [])].join('\n');
}
HUB.records = (el, q = '') => {
  const { records, achievements } = recordsData(), got = achievements.filter((a) => a.done).length, res = recSearch(q);
  const app = (k) => EV_APPS[k] || EV_APPS.aos;
  el.innerHTML = `<section class="hub-head"><h1>Records</h1><p class="hub-sum">Your personal bests and achievements from every app, search across everything, and export your data.</p></section>
    <section class="card"><h3>Search everything</h3><input id="rec-q" type="search" placeholder="A drill, assignment, meal, class, task…" value="${esc(q)}" style="margin-top:8px;width:100%">
      ${q.trim().length >= 2 ? (res.length ? `<ul class="rec-res">${res.map((x) => `<li style="--c:${app(x.app).color}"><span class="rec-app">${esc(app(x.app).name)}</span><b>${esc(x.title)}</b>${x.detail ? `<small>${esc(x.detail)}</small>` : ''}${x.date ? `<em>${fmtD(x.date)}</em>` : ''}</li>`).join('')}</ul>` : '<p class="muted" style="margin-top:10px">Nothing found.</p>') : ''}</section>
    <section class="card"><h3>Personal records</h3><div class="rec-grid">${records.map((r) => `<div class="rec-t" style="--c:${app(r[3]).color}"><small>${esc(r[0])}</small><b>${r[1] != null ? esc(r[1]) : '—'}</b><span>${esc(r[2])}</span></div>`).join('')}</div></section>
    <section class="card"><div class="row" style="justify-content:space-between"><h3>Achievements</h3><span class="tag">${got}/${achievements.length}</span></div>
      <ul class="rec-ach">${achievements.sort((a, b) => b.done - a.done || b.cur / b.goal - a.cur / a.goal).map((a) => `<li class="${a.done ? 'on' : ''}" style="--c:${app(a.app).color}"><span class="rec-badge">${a.done ? '★' : '☆'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${a.done ? '' : `<div class="hub-app-bar"><i style="width:${Math.round((a.cur / a.goal) * 100)}%"></i></div><small>${a.cur.toLocaleString()} / ${a.goal.toLocaleString()}</small>`}</div></li>`).join('')}</ul></section>
    <section class="card"><h3>Export</h3><p class="muted small">A summary to share, or a full backup of everything the Hub stores in your account.</p>
      <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn" data-rec="txt">Summary (.txt)</button><button type="button" class="btn" data-rec="json">Full backup (.json)</button></div></section>`;
  const inp = $('#rec-q', el); let tm = null;
  inp.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { HUB.records(el, inp.value); const n = $('#rec-q', el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  el.onclick = (e) => { const b = e.target.closest('[data-rec]'); if (!b) return; const t = todayIso();
    if (b.dataset.rec === 'txt') recSave(`hub-summary-${t}.txt`, recExportText()); else recSave(`hub-backup-${t}.json`, recExportJson()); };
};
window.Ecosystem = { ...(window.Ecosystem || {}), ask: (q) => askRun(q, document.createElement('div')), context: hubContext, records: recordsData, search: recSearch };
