// ===================== ECOSYSTEM PHASE 1: the shared event stream =====================
// One stream of "what happened" across every app in the suite. Each app keeps writing only its own records (CONTRACT.md);
// this layer reads them and turns them into events with stable ids, so nothing is counted twice and MacroLens needs no change.
// Apps that want to say something their records can't (for example "plan accepted") append to their own "ev-<app>" doc:
//   { events: [{ id, type, date: 'YYYY-MM-DD', time: 'HH:MM', title, detail }] }  (newest 300 kept)
// Later phases (inbox, automations, assistant) read from evStream().
const EV_APPS = {
  aos: { name: 'Athlete OS', color: '#3d8bff', href: null },
  gp: { name: 'Gameplan', color: '#22c55e', href: 'gameplan.html' },
  school: { name: 'School', color: '#0ea5e9', href: 'school.html' },
  btc: { name: 'Training Center', color: '#f97316', href: 'btc.html' },
  ml: { name: 'MacroLens', color: '#eab308', href: 'macrolens.html' },
};
const EV_ICON = { workout: 'dumbbell', meal: 'fork', water: 'drop', weight: 'scale', recovery: 'moon', mind: 'brain', test: 'bolt', record: 'trophy', shooting: 'ball', game: 'ball', goal: 'target', grade: 'chart', due: 'calendar', block: 'calendar', night: 'moon', note: 'spark' };
const evTime = (ms) => { if (!(ms > 1e12)) return null; const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const evKind = (type) => type.split('.')[0];
const MEAL_NAME = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };

/** Every event between from and to (inclusive), newest first. Cached until the data changes. */
// Cached only within one render pass (cleared on the next tick), so new logs always show.
let _evCache = {}, _evTick = false;
function evStream(from = shiftIso(todayIso(), -59), to = todayIso()) {
  const sig = from + '|' + to;
  if (_evCache[sig]) return _evCache[sig];
  if (!_evTick) { _evTick = true; setTimeout(() => { _evCache = {}; _evTick = false; }); }
  const out = [], add = (e) => { if (e.date >= from && e.date <= to) out.push(e); };
  const days = []; for (let d = from; d <= to; d = shiftIso(d, 1)) days.push(d);
  for (const d of days) {
    const day = doc('day-' + d);
    if (day) {
      // MacroLens: meals and water
      for (const slot of Object.keys(MEAL_NAME)) {
        const items = day[slot] || []; if (!items.length) continue;
        const k = Math.round(sum(items.map((f) => (f.calories || 0) * (f.servings || 1)))), p = Math.round(sum(items.map((f) => (f.protein || 0) * (f.servings || 1))));
        add({ id: `ml:${d}:${slot}`, app: 'ml', type: 'meal.logged', date: d, time: evTime(Math.min(...items.map((f) => f.addedAt || Infinity))), title: `${MEAL_NAME[slot]} logged`, detail: `${k.toLocaleString()} kcal · ${p} g protein · ${items.map((f) => f.name).slice(0, 2).join(', ')}${items.length > 2 ? ` +${items.length - 2}` : ''}` });
      }
      if (day.water > 0) add({ id: `ml:${d}:water`, app: 'ml', type: 'water.logged', date: d, title: `${day.water} oz water`, detail: (() => { const t = targets(d)?.water; return t ? `${Math.round((day.water / t) * 100)}% of ${t} oz goal` : ''; })() });
      // Workouts: Training Center sessions vs everything logged in Athlete OS / MacroLens
      for (const w of day.exercise || []) {
        const app = w.source === 'training-center' ? 'btc' : 'aos';
        add({ id: `${app}:w:${w.id}`, app, type: 'workout.finished', date: d, time: w.time || evTime(w.addedAt), title: w.name && w.name !== 'W' ? w.name : `${(w.type || 'Workout')[0].toUpperCase()}${(w.type || 'workout').slice(1)} session`, detail: [w.mins && `${w.mins} min`, w.type, w.rpe ? `RPE ${w.rpe}` : w.int].filter(Boolean).join(' · '), link: app === 'aos' ? 'train-overview' : null });
      }
      if (day.feel && (day.feel.sleepH || day.feel.energy)) add({ id: `aos:${d}:feel`, app: 'aos', type: 'recovery.checkin', date: d, title: 'Recovery check-in', detail: [day.feel.sleepH && `${day.feel.sleepH} h sleep`, day.feel.energy && `energy ${day.feel.energy}/5`, day.feel.sore && `soreness ${day.feel.sore}/5`].filter(Boolean).join(' · '), link: 'analytics-overview' });
    }
    // Mind
    const mc = mcheck(d);
    if (mc) { const s = mentalScore(d); add({ id: `aos:${d}:mind`, app: 'aos', type: 'mind.checkin', date: d, time: evTime(mc.at), title: 'Mental check-in', detail: s != null ? `Mental score ${s}` : '', link: 'mind-checkin' }); }
    // Gameplan: finished blocks and the night routine
    const g = doc('gp-d-' + d);
    if (g) {
      for (const b of g.blocks || []) if (b.done && b.type !== 'sleep') add({ id: `gp:${d}:${b.id}`, app: 'gp', type: 'block.done', date: d, time: b.start || null, title: b.title, detail: `${b.mins || 60} min block done` });
      if (g.night?.completedAt) add({ id: `gp:${d}:night`, app: 'gp', type: 'night.done', date: d, time: evTime(g.night.completedAt), title: 'Night routine done', detail: '' });
    }
  }
  // MacroLens: body weight
  for (const w of core().weights || []) add({ id: `ml:wt:${w.date}`, app: 'ml', type: 'weight.logged', date: w.date, title: `Weighed in at ${w.lb} lb`, detail: '' });
  // Athlete OS: tests and records
  const R = doc('aos-tests').results || [];
  for (const r of R) {
    const t = testById(r.test); if (!t) continue;
    const prior = R.filter((x) => x.test === r.test && (x.date < r.date || (x.date === r.date && (x.at || 0) < (r.at || 0))));
    const pr = prior.length && prior.every((x) => (t.better === 'lower' ? r.value < x.value : r.value > x.value));
    add({ id: `aos:t:${r.id}`, app: 'aos', type: pr ? 'record.set' : 'test.result', date: r.date, title: pr ? `New record: ${t.name}` : t.name, detail: `${r.value} ${t.unit}${pr ? ` · was ${betterOf(t, ...prior.map((x) => x.value)) ?? ''}` : ''}`.replace(/ · was $/, ''), link: 'analytics-performance' });
  }
  for (const s of doc('aos-shots').sessions || []) {
    const sp = Object.values(s.spots || {}), m = sum(sp.map((x) => x.m || 0)), a = sum(sp.map((x) => x.a || 0));
    if (a) add({ id: `aos:s:${s.id}`, app: 'aos', type: 'shooting.session', date: s.date, time: evTime(s.at), title: 'Shooting session', detail: `${m}/${a} · ${Math.round((m / a) * 100)}%${s.style ? ` · ${s.style === 'cs' ? 'catch-and-shoot' : 'off the dribble'}` : ''}`, link: 'hoops-court' });
  }
  for (const gm of doc('aos-games').games || []) add({ id: `aos:g:${gm.id}`, app: 'aos', type: 'game.played', date: gm.date, title: `Game vs ${gm.opp || 'opponent'}`, detail: [gm.pts != null && `${gm.pts} pts`, gm.reb != null && `${gm.reb} reb`, gm.ast != null && `${gm.ast} ast`].filter(Boolean).join(' · ') });
  for (const gl of doc('aos-goals').goals || []) for (const m of gl.milestones || []) if (m.done) add({ id: `aos:ms:${gl.id}:${m.label || m.v}`, app: 'aos', type: 'goal.milestone', date: m.done, title: `Milestone: ${m.label || m.v}`, detail: gl.title, link: 'train-goals' });
  // School: grades posted
  const S = doc('life-school');
  if (S) for (const gr of S.grades || []) { const cls = (S.classes || []).find((c) => c.id === gr.cls); add({ id: `school:gr:${gr.id}`, app: 'school', type: 'grade.posted', date: gr.date, title: `${cls?.name || 'Class'}: ${gr.title || gr.cat}`, detail: gr.max ? `${gr.score}/${gr.max} · ${Math.round((gr.score / gr.max) * 100)}%` : String(gr.score) }); }
  // Direct events any app wrote to its own ev-<app> doc
  for (const k of lsKeys()) if (k.startsWith('ev-')) { const app = k.slice(3); if (!EV_APPS[app]) continue; for (const e of doc(k)?.events || []) if (e?.id && e.date) add({ ...e, app, id: `${app}:x:${e.id}`, type: e.type || 'note.added' }); }
  // Order: newest day first, then by time (events without a time go last within their day)
  out.sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  _evCache[sig] = out;
  return out;
}
/** Things already scheduled in the next n days (School due dates). */
function evUpcoming(n = 7) {
  const S = doc('life-school'), t = todayIso(), end = shiftIso(t, n);
  return (S?.items || []).filter((i) => !i.done && i.due >= t && i.due <= end).sort((a, b) => a.due.localeCompare(b.due)).map((i) => { const cls = (S.classes || []).find((c) => c.id === i.cls); return { id: `school:due:${i.id}`, app: 'school', type: 'due.' + (i.type || 'hw'), date: i.due, time: i.time || null, title: i.title, detail: `${cls?.name || ''}${cls ? ' · ' : ''}${i.type === 'test' || i.type === 'exam' || i.type === 'quiz' ? i.type : 'due'}` }; });
}
/** Write an event for something an app's own records can't show. */
function emitEvent(type, title, detail = '', app = 'aos') {
  const k = 'ev-' + app, D = doc(k) || (cache[k] = { events: [] });
  const now = new Date();
  D.events = [...(D.events || []), { id: uid('e'), type, date: todayIso(), time: evTime(now.getTime()), title: String(title).slice(0, 80), detail: String(detail).slice(0, 160), at: now.getTime() }].slice(-300);
  persist(k); _evCache = {};
}
window.Ecosystem = { events: evStream, upcoming: evUpcoming, emit: emitEvent, apps: EV_APPS };

// ---------- presentation ----------
const evWhen = (d) => { const t = todayIso(); return d === t ? 'Today' : d === shiftIso(t, -1) ? 'Yesterday' : d === shiftIso(t, 1) ? 'Tomorrow' : fmtDL(d); };
const evClock = (hm) => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function evRow(e) {
  const A = EV_APPS[e.app], icon = ICONS[EV_ICON[evKind(e.type)]] || ICONS.spark;
  const target = A.href ? `data-ev-href="${A.href}"` : e.link ? `data-go="${e.link}"` : '';
  return `<li class="ev${e.type === 'record.set' ? ' ev-rec' : ''}" style="--c:${A.color}">
    <span class="ev-ic" aria-hidden="true">${icon}</span>
    <div class="ev-b"><div class="ev-t">${esc(e.title)}</div>${e.detail ? `<div class="ev-d">${esc(e.detail)}</div>` : ''}</div>
    <div class="ev-m"><span class="ev-time">${evClock(e.time)}</span>${target ? `<button type="button" class="ev-app" ${target}>${A.name}</button>` : `<span class="ev-app">${A.name}</span>`}</div>
  </li>`;
}
function evGroups(list) {
  const by = {}; for (const e of list) (by[e.date] = by[e.date] || []).push(e);
  return Object.keys(by).sort().reverse().map((d) => `<div class="ev-day"><h4>${evWhen(d)}<span>${by[d].length} event${by[d].length === 1 ? '' : 's'}</span></h4><ul class="ev-list">${by[d].map(evRow).join('')}</ul></div>`).join('');
}
const evCountBy = (list) => Object.fromEntries(Object.keys(EV_APPS).map((a) => [a, list.filter((e) => e.app === a).length]));

// ---------- Intel › Timeline ----------
SUBS.intel.splice(1, 0, ['timeline', 'Timeline']);
INTEL.timeline = (el) => {
  const r = ui('evRange', '7'), on = ui('evApps', null), from = shiftIso(todayIso(), -(Number(r) - 1));
  const all = evStream(from), shown = on ? all.filter((e) => on.includes(e.app)) : all, cnt = evCountBy(all), up = evUpcoming(7);
  const appsActive = Object.values(cnt).filter(Boolean).length;
  el.innerHTML = `<section class="card ev-hero"><div class="card-head"><div><h3>Timeline</h3><span class="sub">Everything you did, across all five apps, in one place</span></div>${seg('evRange', [['7', '7D'], ['30', '30D'], ['60', '60D']], r)}</div>
    <div class="ev-kpis"><div><b>${all.length}</b><span>events</span></div><div><b>${appsActive}<small>/5</small></b><span>apps active</span></div><div><b>${new Set(all.map((e) => e.date)).size}</b><span>days with activity</span></div></div>
    <div class="ev-filter" role="group" aria-label="Show apps">${Object.entries(EV_APPS).map(([k, A]) => `<button type="button" data-ev-app="${k}" class="${!on || on.includes(k) ? 'on' : ''}" aria-pressed="${!on || on.includes(k)}" style="--c:${A.color}"><i></i>${A.name}<b>${cnt[k]}</b></button>`).join('')}</div>
    <div class="chart" id="ev-chart" aria-label="Events per day by app"></div></section>
    ${up.length ? `<section class="card"><div class="card-head"><div><h3>Coming up</h3><span class="sub">Already scheduled in the next 7 days</span></div></div><ul class="ev-list">${up.map(evRow).join('')}</ul></section>` : ''}
    <section class="card">${shown.length ? evGroups(shown) : emptyState('Nothing here yet', 'Log a meal in MacroLens, finish a session in the Training Center, or check off a block in Gameplan. It shows up here automatically.', 'calendar')}</section>`;
  const days = []; for (let d = from; d <= todayIso(); d = shiftIso(d, 1)) days.push(d);
  const step = days.length > 14 ? Math.ceil(days.length / 10) : 1;
  drawBars($('#ev-chart', el), days.map((d, i) => ({ label: i % step === 0 ? (days.length > 7 ? fmtD(d) : DOW[parseIso(d).getDay()]) : '', tip: fmtDL(d), segs: Object.entries(EV_APPS).filter(([k]) => !on || on.includes(k)).map(([k, A]) => ({ v: shown.filter((e) => e.date === d && e.app === k).length, color: A.color, name: A.name })) })), { h: 150, fmt: (v) => String(Math.round(v)) });
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ev-app]');
  if (b) { const all = Object.keys(EV_APPS), cur = ui('evApps', null) || all, k = b.dataset.evApp; let next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]; if (!next.length) next = all; setUi('evApps', next.length === all.length ? null : next); refresh(); return; }
  const h = e.target.closest('[data-ev-href]'); if (h) goTo(h.dataset.evHref);
});

// ---------- Home › "Across your apps" ----------
WIDGETS.push(['apps', 'Across your apps']);
DEFAULT_W.splice(Math.max(0, DEFAULT_W.indexOf('upnext') + 1), 0, 'apps');
function homeApps(el) {
  const t = todayIso(), today = evStream(t), week = evStream(shiftIso(t, -6)), cnt = evCountBy(week);
  el.innerHTML = `<div class="card-head"><div><h3>Across your apps</h3><span class="sub">Today's activity from every app · ${week.length} events this week</span></div><button type="button" class="btn sm" data-go="intel-timeline">Timeline</button></div>
    <div class="ev-apps">${Object.entries(EV_APPS).map(([k, A]) => { const n = today.filter((e) => e.app === k).length; return `<div class="ev-a${n ? ' on' : ''}" style="--c:${A.color}"><i></i><b>${n}</b><span>${A.name}</span><small>${cnt[k]} this week</small></div>`; }).join('')}</div>
    ${today.length ? `<ul class="ev-list">${today.slice(0, 5).map(evRow).join('')}</ul>${today.length > 5 ? `<button type="button" class="btn sm" data-go="intel-timeline" style="margin-top:8px">See all ${today.length} from today</button>` : ''}` : '<p class="small muted" style="margin:8px 0 0">Nothing logged yet today. Meals, sessions, Gameplan blocks and check-ins show up here as they happen.</p>'}`;
}
{
  const base = RENDER.home;
  RENDER.home = (el) => {
    // Give people who customized Home the new card once, right after "Up next" (they can remove it in Customize).
    const P = aos().profile;
    if (Array.isArray(P?.widgets) && P.widgets.length && !P.widgets.includes('apps') && !aos().evOffered) { const i = P.widgets.indexOf('upnext'); P.widgets.splice(i >= 0 ? i + 1 : 1, 0, 'apps'); aos().evOffered = true; persist('aos'); }
    base(el);
    const s = $('[data-widget="apps"]', el);
    if (s) { try { homeApps(s); } catch (e) { console.error(e); s.innerHTML = '<p class="muted small">Could not load activity.</p>'; } }
  };
}
