// ===================== Home that follows your day =====================
// 1. "Do first": what still needs you today (check-ins, planning the day, practice, breakfast, night routine) sits at
//    the top of Home and disappears as soon as it is done.
// 2. Up next reads the Athlete Calendar AND your Gameplan blocks: what you are doing now and what is next.
// 3. A week calendar on Home: events, Gameplan blocks and logged training per day, plus today's timeline.
const tdItems = (date) => {
  const its = itemsOn(date), out = [];
  for (const x of its) if (x.time) out.push({ st: toMinT(x.time), mins: x.mins || 30, title: x.title, color: evType(x.type)[2], src: 'Calendar', done: isChecked(date, x.key), key: x.key, type: x.type, end: x.end });
  for (const b of gpBlocks(date, its)) out.push({ st: b.st, mins: b.mins, title: b.title, color: gpType(b.type)[1], src: 'Gameplan', done: !!b.done, type: b.type });
  return out.sort((a, b) => a.st - b.st);
};
const tdClock = (m) => fmtClock(`${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

// ---------- Up next (calendar + Gameplan) ----------
homeUpNext = function (el) {
  const t = todayIso(), now = nowM(), its = tdItems(t);
  const cur = its.find((x) => x.st <= now && now < x.st + x.mins && !x.done), rest = its.filter((x) => x.st > now && !x.done);
  let next = rest[0], nd = t;
  if (!next) for (let i = 1; i <= 7 && !next; i++) { const d = shiftIso(t, i), n = tdItems(d)[0] || itemsOn(d)[0]; if (n) { next = n.st != null ? n : { title: n.title, color: evType(n.type)[2], src: 'Calendar' }; nd = d; } }
  const row = (x, label) => `<div class="un-row" style="--c:${x.color}"><i></i><div style="min-width:0"><span class="tiny muted">${label}</span><b>${esc(x.title)}</b></div><span class="tag">${x.src}</span></div>`;
  el.innerHTML = `<div class="card-head"><div><h3>Up next</h3><span class="sub">Your calendar and Gameplan blocks</span></div><div class="row" style="gap:6px"><a class="btn sm" data-ml href="gameplan.html">Gameplan</a><button type="button" class="btn sm" data-go="train-plan">Calendar</button></div></div>
    ${cur ? row(cur, `NOW · until ${tdClock(cur.st + cur.mins)}`) : ''}
    ${next ? row(next, nd === t ? `NEXT · ${tdClock(next.st)} · in ${fmtDur(next.st - now)}` : `${esc(fmtDL(nd)).toUpperCase()}${next.st != null ? ' · ' + tdClock(next.st) : ''}`) : ''}
    ${nd === t && rest.length > 1 ? `<div class="list" style="margin-top:6px">${rest.slice(1, 5).map((x) => `<div class="li"><span class="small"><i class="dot" style="background:${x.color};margin-right:6px"></i>${esc(x.title)}</span><span class="tiny muted">${tdClock(x.st)}</span></div>`).join('')}</div>` : ''}
    ${!cur && !next ? emptyState('Nothing blocked off', 'Plan your day in Gameplan or add events to your calendar, and they show up here.', 'calendar', '<div class="row" style="justify-content:center"><a class="btn sm primary" data-ml href="gameplan.html">Plan my day</a><button type="button" class="btn sm" data-act="event">＋ Event</button></div>') : ''}`;
};

// ---------- Week calendar on Home ----------
WIDGETS.splice(1, 0, ['calendar', 'Week calendar']);
DEFAULT_W.splice(DEFAULT_W.indexOf('charts') + 1 || 1, 0, 'calendar');
function homeWeekCal(el) {
  el.classList.add('span2');
  const t = todayIso(), days = Array.from({ length: 7 }, (_, i) => shiftIso(t, i)), now = nowM();
  const its = tdItems(t), H0 = 6 * 60, H1 = 24 * 60, pos = (m) => clamp(((m - H0) / (H1 - H0)) * 100, 0, 100);
  el.innerHTML = `<div class="card-head"><div><h3>Your week</h3><span class="sub">Calendar events, Gameplan blocks and training</span></div><button type="button" class="btn sm" data-go="train-plan">Open calendar</button></div>
    <div class="tl-strip" aria-label="Today's timeline">${its.map((x) => `<i style="left:${pos(x.st)}%;width:${Math.max(1.2, pos(x.st + x.mins) - pos(x.st))}%;background:${x.color}" title="${esc(x.title)} · ${tdClock(x.st)}"></i>`).join('')}${now >= H0 ? `<b style="left:${pos(now)}%"></b>` : ''}</div>
    <div class="tl-axis tiny muted"><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>
    <div class="wkc">${days.map((d) => {
      const ev = itemsOn(d), gp = gpBlocks(d, ev), tr = trainingOf(d), dt = parseIso(d);
      return `<button type="button" class="wkc-d ${d === t ? 'today' : ''}" data-wkc="${d}"><span class="tiny muted">${DOW[dt.getDay()]}</span><b>${dt.getDate()}</b>
        <span class="wkc-ev">${ev.slice(0, 3).map((x) => `<i style="background:${evType(x.type)[2]}" title="${esc(x.title)}"></i>`).join('')}${ev.length > 3 ? `<em>+${ev.length - 3}</em>` : ''}</span>
        <span class="tiny wkc-l">${ev[0] ? esc(ev[0].title) : gp.length ? `${gp.length} block${gp.length > 1 ? 's' : ''}` : '—'}</span>
        ${gp.length ? `<span class="wkc-gp" title="${gp.length} Gameplan blocks">${gp.length}</span>` : ''}${tr.mins ? `<span class="wkc-tr">✓ ${tr.mins}m</span>` : ''}</button>`;
    }).join('')}</div>`;
}
document.addEventListener('click', (e) => { const d = e.target.closest('[data-wkc]'); if (!d) return; setUi('calView', 'day'); setUi('calDay', d.dataset.wkc); go('train', 'plan'); });

// ---------- Do first ----------
function doFirst() {
  const t = todayIso(), h = new Date().getHours(), out = [], dd = dayDoc(t) || {}, its = itemsOn(t);
  if (recoveryInputs(t).sleepH == null && !dd.feel) out.push({ id: 'checkin', ic: 'moon', title: 'Morning check-in', why: 'Sleep, energy and soreness set your readiness and recovery for today.', btn: `<button type="button" class="btn sm primary" data-act="checkin">Check in</button>` });
  if (!mind().checks?.[t]) out.push({ id: 'mind', ic: 'brain', title: 'Mental check-in', why: 'Confidence, focus and stress in 30 seconds.', btn: `<button type="button" class="btn sm" data-go="mind-checkin">Check in</button>` });
  if (!gpBlocks(t, its).length && h < 21) out.push({ id: 'plan', ic: 'calendar', title: 'Block out your day', why: 'Say or type your day in Gameplan and it shows up here and in your calendar.', btn: `<a class="btn sm" data-ml href="gameplan.html">Plan my day</a>` });
  for (const x of its.filter((x) => (x.type === 'practice' || x.type === 'game') && x.time && !isChecked(t, x.key))) {
    const end = x.end ? toMinT(x.end) : toMinT(x.time) + (x.mins || 120);
    if (nowM() >= end) out.push({ id: 'p-' + x.key, ic: 'ball', title: `How did ${x.type === 'game' ? 'the game' : 'practice'} go?`, why: `${esc(x.title)} ended at ${tdClock(end)}. Mark it done so it counts in your load.`, btn: `<label class="check df-chk"><input type="checkbox" data-chk="${t}|${esc(x.key)}"> Done</label>` });
  }
  if (h >= 9 && h < 12 && !(dd.breakfast || []).length) out.push({ id: 'bf', ic: 'fork', title: 'Log breakfast', why: 'Fuel for practice starts in the morning.', btn: `<a class="btn sm" data-ml href="macrolens.html">MacroLens</a>` });
  if (h >= 20 && !doc('gp-d-' + t)?.night?.completedAt) out.push({ id: 'night', ic: 'moon', title: 'Night routine', why: 'Wind down, pick tomorrow\'s Top 3, lights out on time.', btn: `<a class="btn sm" data-ml href="gameplan.html#night">Start</a>` });
  return out;
}
function doFirstHtml() {
  const xs = doFirst(); if (!xs.length) return '';
  const h = new Date().getHours(), greet = h < 12 ? 'Start your day' : h < 18 ? 'Still to do today' : 'Before bed';
  return `<section class="card df" data-df><div class="card-head"><div><h3>${greet}</h3><span class="sub">${xs.length} thing${xs.length > 1 ? 's' : ''} left · each one disappears when it's done</span></div></div>
    <div class="df-list">${xs.map((x) => `<div class="df-i" data-dfi="${x.id}"><span class="df-ic">${ICONS[x.ic] || ICONS.spark}</span><div style="min-width:0"><b>${x.title}</b><span class="small muted">${x.why}</span></div>${x.btn}</div>`).join('')}</div></section>`;
}
{
  const base = RENDER.home;
  RENDER.home = (el) => {
    base(el);
    const hero = $('.hero', el), html = doFirstHtml();
    if (html) (hero || el.firstElementChild)?.insertAdjacentHTML(hero ? 'afterend' : 'beforebegin', html);
    const s = $('[data-widget="calendar"]', el); if (s) { try { homeWeekCal(s); } catch (e) { console.error(e); } }
  };
}
// A checked practice in Do first refreshes Home so the item leaves.
document.addEventListener('change', (e) => { if (e.target.closest('.df [data-chk]') && state.view === 'home') setTimeout(refresh, 50); });
