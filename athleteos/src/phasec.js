// ===================== Hub 2.0 · Phase C: Today Action Center + morning text =====================
// 1. Action Center (top of Hub › Today): the 3 most important things today, picked from the engine's insights,
//    what's due, tests coming up and Gameplan's Top 3. Done / Skip per item, saved in doc "hub-actions"
//    { days: { date: { shown: [ids], s: { id: { s: 'done'|'skip', at, title } } } } }, with a 7-day hit rate.
// 2. Morning text: doc "hub-brief" { v, at, days: { date: { text, lines, readiness } } } holds today's and tomorrow's
//    short briefing (readiness, Gameplan/calendar schedule, what's due, protein target, one action). A scheduled
//    Claude task reads it at 8:15 AM and sends it. It's rebuilt every time any page of the Hub bundle loads.
// 3. Athlete OS's Command Center and "Start your day" become short links to the Hub (one source of truth).

// ---------- 1. Action Center ----------
const hubAct = () => doc('hub-actions') || (cache['hub-actions'] = { v: 1, days: {} });
function actionCandidates(t = todayIso()) {
  const out = [], add = (x) => { if (!out.some((y) => y.id === x.id)) out.push(x); }, tm = shiftIso(t, 1), S = doc('life-school');
  if (S) {
    for (const x of scDue(t, t)) { const c = scClass(x.cls); const isT = HP_TESTS.includes(x.type); add({ id: 'due:' + x.id, score: c?.latePolicy === 'none' ? 98 : 92, app: 'school', title: isT ? `${x.title} today: 10-min review beforehand` : `Finish ${x.title}`, why: `${isT ? x.type[0].toUpperCase() + x.type.slice(1) + ' today' : 'Due today'}${c ? ' · ' + c.name : ''}${c?.latePolicy === 'none' ? ' · no late work' : ''}`, href: 'student.html' }); }
    for (const x of scDue(tm, shiftIso(t, 3)).filter((x) => HP_TESTS.includes(x.type))) { const c = scClass(x.cls), dd = daysBetween(t, x.due); add({ id: 'study:' + x.id, score: 90 - dd * 6, app: 'school', title: `Study for ${x.title} (${dd === 1 ? '30–45' : '20–30'} min)`, why: `${x.type[0].toUpperCase() + x.type.slice(1)} ${dd === 1 ? 'tomorrow' : 'in ' + dd + ' days'}${c ? ' · ' + c.name : ''}`, href: 'student.html' }); }
    for (const x of scDue(tm, tm).filter((x) => !HP_TESTS.includes(x.type))) { const c = scClass(x.cls); add({ id: 'due:' + x.id, score: c?.latePolicy === 'none' ? 85 : 70, app: 'school', title: `Get ${x.title} done`, why: `Due tomorrow${c ? ' · ' + c.name : ''}${c?.latePolicy === 'none' ? ' · no late work' : ''}`, href: 'student.html' }); }
    for (const x of scOverdue()) { const c = scClass(x.cls); add({ id: 'late:' + x.id, score: c?.latePolicy === 'full' ? 55 : 88, app: 'school', title: `Turn in ${x.title}`, why: `Overdue since ${fmtD(x.due)}${c?.latePolicy === 'full' ? ' · still full credit' : ''}`, href: 'student.html' }); }
  }
  for (const i of hubSafe(() => engInsights(), []) || []) {
    if (i.kind === 'unlock' || i.kind === 'pattern' || i.lvl === 'good') continue;
    if (/^(Overdue|Test tomorrow|.*: .* due )/.test(i.title) && i.apps[0] === 'school') continue; // already covered above
    const base = i.lvl === 'act' ? 95 : i.lvl === 'watch' ? 65 : 30;
    add({ id: 'ins:' + i.id, score: base - (i.kind === 'trend' ? 15 : 0), app: i.apps[0] || 'aos', title: i.action && i.kind !== 'alert' ? i.action : i.title, why: i.kind === 'alert' ? i.evidence[0] || '' : i.title, href: i.href });
  }
  const sig = doc('gp-sig'); (sig?.updated === t ? sig.top3Today || [] : []).forEach((x, n) => add({ id: 'gp:' + x, score: 75 - n * 3, app: 'gp', title: x, why: 'Your Gameplan Top 3', href: 'gameplan.html' }));
  return out.sort((a, b) => b.score - a.score);
}
function actionCenterHtml() {
  const t = todayIso(), A = hubAct(), D = (A.days[t] ||= { shown: [], s: {} });
  const open = actionCandidates(t).filter((x) => !D.s[x.id]).slice(0, 3), done = Object.entries(D.s).filter(([, v]) => v.s === 'done');
  let changed = false; for (const x of open) if (!D.shown.includes(x.id)) { D.shown.push(x.id); changed = true; }
  if (changed) { for (const d of Object.keys(A.days)) if (d < shiftIso(t, -60)) delete A.days[d]; persist('hub-actions'); }
  const wk = lastNDays(7).map((d) => A.days[d]).filter(Boolean), shown = sum(wk.map((d) => d.shown.length)), did = sum(wk.map((d) => Object.values(d.s).filter((v) => v.s === 'done').length));
  return `<section class="card ac"><div class="card-head"><div><h3>Do these today</h3><span class="sub">Picked from every app: deadlines, tests, recovery and your plan${shown ? ` · ${did} of ${shown} done this week` : ''}</span></div></div>
    ${open.length ? `<ol class="ac-list">${open.map((x) => `<li style="--c:${EV_APPS[x.app]?.color || '#14b8a6'}"><div class="ac-b"><b>${esc(x.title)}</b><small>${esc(x.why)}</small></div><div class="ac-btns"><button type="button" class="btn sm primary" data-acdone="${esc(x.id)}" data-actitle="${esc(x.title)}">Done</button><button type="button" class="btn sm" data-acskip="${esc(x.id)}" data-actitle="${esc(x.title)}">Skip</button></div></li>`).join('')}</ol>`
      : `<p class="small muted" style="margin:4px 0 0">${done.length ? `All clear: ${done.length} done today.` : 'Nothing urgent. Add deadlines in Student Lens or plan your day in Gameplan, and your top 3 shows up here.'}</p>`}
    ${done.length && open.length ? `<p class="tiny muted" style="margin:8px 0 0">Done today: ${done.map(([, v]) => esc(v.title)).join(' · ')}</p>` : ''}</section>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-acdone],[data-acskip]'); if (!b) return;
  const t = todayIso(), A = hubAct(), D = (A.days[t] ||= { shown: [], s: {} }), id = b.dataset.acdone || b.dataset.acskip;
  D.s[id] = { s: b.dataset.acdone ? 'done' : 'skip', at: Date.now(), title: b.dataset.actitle }; persist('hub-actions');
  if (b.dataset.acdone) toast('Nice. Next one up.'); refresh(); hubSafe(() => saveBrief());
});
const pcToday = HUB.today;
HUB.today = (el) => { pcToday(el); hubSafe(() => $('.hub-head', el)?.insertAdjacentHTML('afterend', actionCenterHtml())); };

// ---------- 2. morning text ----------
const clk = (hm) => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')}`; };
function briefFor(date) {
  const t = todayIso(), dow = DOW[parseIso(date).getDay()], rd = date === t ? doc('rl-ready')?.days?.[date]?.score ?? null : null;
  const its = (hubSafe(() => tdItems(date), []) || []).filter((x) => x.type !== 'sleep' || /bed/i.test(x.title));
  const sched = its.slice(0, 5).map((x) => `${clk(`${Math.floor(x.st / 60)}:${x.st % 60}`)} ${x.title}`), more = its.length - sched.length;
  const S = doc('life-school'), due = S ? scDue(date, date).map((x) => `${HP_TESTS.includes(x.type) ? x.type[0].toUpperCase() + x.type.slice(1) + ': ' : ''}${x.title}${scClass(x.cls)?.latePolicy === 'none' ? ' (no late work)' : ''}`) : [];
  const soon = S ? scDue(shiftIso(date, 1), shiftIso(date, 3)).filter((x) => HP_TESTS.includes(x.type)).map((x) => `${x.title} ${DOW[parseIso(x.due).getDay()]}`) : [];
  const act = date === t ? actionCandidates(t).filter((x) => !hubAct().days[t]?.s?.[x.id])[0] : actionCandidates(date)[0];
  const lines = [
    `${dow} ${fmtD(date)}${rd != null ? ` · Readiness ${rd}` : ''}`,
    `🗓 ${sched.length ? sched.join(' · ') + (more > 0 ? ` +${more} more` : '') : 'Nothing planned yet. Plan your day in Gameplan.'}`,
    `📚 ${due.length || soon.length ? [due.length ? 'Due: ' + due.join(' · ') : '', soon.length ? 'Coming up: ' + soon.join(' · ') : ''].filter(Boolean).join(' · ') : 'Nothing due today'}`,
    `🍗 Protein target ${targets(date).protein} g`,
    act ? `👉 ${act.title}` : null,
  ].filter(Boolean);
  return { date, readiness: rd, lines, text: lines.join('\n') };
}
function saveBrief() {
  const t = todayIso(), B = { v: 1, at: Date.now(), days: { [t]: briefFor(t), [shiftIso(t, 1)]: briefFor(shiftIso(t, 1)) } }, cur = doc('hub-brief');
  if (cur && JSON.stringify(cur.days) === JSON.stringify(B.days)) return;
  cache['hub-brief'] = B; persist('hub-brief');
}
const pcSignals = writeSignals;
writeSignals = function (...a) { const r = pcSignals(...a); hubSafe(() => saveBrief()); return r; };
window.Ecosystem = { ...(window.Ecosystem || {}), actions: actionCandidates, brief: briefFor };

// ---------- 3. Athlete OS: "today" screens point to the Hub ----------
const hubLinkCard = (el, title) => { const top = actionCandidates().filter((x) => !hubAct().days[todayIso()]?.s?.[x.id]).slice(0, 3);
  el.innerHTML = `<div class="card-head"><div><h3>${title}</h3><span class="sub">Your top 3 for today now live in the Hub, picked from every app</span></div><a class="btn sm primary" data-ml href="index.html">Open Hub</a></div>
    ${top.length ? `<ol class="ac-list mini">${top.map((x) => `<li style="--c:${EV_APPS[x.app]?.color}"><div class="ac-b"><b>${esc(x.title)}</b><small>${esc(x.why)}</small></div></li>`).join('')}</ol>` : '<p class="small muted" style="margin:0">Nothing urgent today.</p>'}`; };
if (window.APP_MODE !== 'hub') {
  homeCommand = (el) => hubLinkCard(el, 'Today');
  doFirstHtml = () => '';
}
