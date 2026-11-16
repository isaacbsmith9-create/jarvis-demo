// Today: everything that matters right now, from every app.
import { esc, todayIso, longDate, greeting, fmtNum, fmtDur, fmtTime, toMin, nowMin, clamp, shiftIso } from './util.js';
import * as ml from './ml.js';
import * as ru from './ru.js';
import * as pd from './plan.data.js';
import { dueWords, chDay, spanishGoal, spanishStreak, row } from './insights.js';
import { icon, chev, rings, ring, bar, checkSvg, profileBtn } from './ui.js';

export function render() {
  const iso = todayIso(), t = ml.targets(iso), tot = ml.totals(ml.entriesOf(iso)), water = ml.day(iso)?.water || 0;
  const rs = ru.scoreFor(iso), sessions = ru.day(iso)?.sessions || [];
  const ag = pd.agenda(iso), nm = nowMin();
  const cur = ag.find((b) => toMin(b.start) <= nm && nm < toMin(b.start) + b.mins);
  const upcoming = ag.filter((b) => toMin(b.start) > nm).slice(0, 3);
  const tops = pd.topFor(iso), ds = pd.dayScore(iso), r = row(iso);
  const running = pd.gpCore().running;
  const due = dueWords().length, chMins = Math.floor((chDay(iso)?.secs || 0) / 60), chGoal = spanishGoal();
  const night = pd.nightState(pd.nightDate()), evening = new Date().getHours() >= 18 || new Date().getHours() < 4;
  const calPct = t.calories ? tot.calories / t.calories : 0, pPct = t.protein ? tot.protein / t.protein : 0, wPct = t.waterOz ? water / t.waterOz : 0;
  const trainMins = sessions.reduce((a, s) => a + (Number(s.mins) || 0), 0);

  return `
  <header class="lt"><div><div class="eyebrow">${esc(longDate(iso))}</div><h1>${esc(greeting())}</h1></div><div class="actions">${profileBtn()}</div></header>

  <button type="button" class="card" data-act="go" data-href="#food" style="display:block;width:100%;text-align:left;border:0;color:inherit">
    <div class="hero">
      ${rings([{ pct: calPct, color: 'var(--cal)' }, { pct: pPct, color: 'var(--protein)' }, { pct: wPct, color: 'var(--water)' }], { size: 148, stroke: 15, label: `Calories ${Math.round(calPct * 100)}%, protein ${Math.round(pPct * 100)}%, water ${Math.round(wPct * 100)}%` })}
      <div class="legend3">
        <div class="lg"><i style="--c:var(--cal)"></i><span>Calories</span><b>${fmtNum(tot.calories)}<small> / ${fmtNum(t.calories)}</small></b></div>
        <div class="lg"><i style="--c:var(--protein)"></i><span>Protein</span><b>${Math.round(tot.protein)}<small> / ${t.protein} g</small></b></div>
        <div class="lg"><i style="--c:var(--water)"></i><span>Water</span><b>${water}<small> / ${t.waterOz} oz</small></b></div>
      </div>
    </div>
    <div class="sm muted" style="margin-top:12px">${foodLine(t, tot)}</div>
  </button>

  <div class="qa" style="margin-top:12px">
    <button type="button" data-act="qaFood" style="--c:var(--cal)"><span class="i">${icon('food')}</span>Food</button>
    <button type="button" data-act="todayWater" style="--c:var(--water)"><span class="i">${icon('water')}</span>+16 oz</button>
    <button type="button" data-act="qaWorkout" style="--c:var(--c-practice)"><span class="i">${icon('train')}</span>Workout</button>
    <button type="button" data-act="qaTask" style="--c:var(--warn)"><span class="i">${icon('task')}</span>Task</button>
  </div>

  ${readinessCard(rs)}

  ${running ? `<button type="button" class="card" data-act="go" data-href="#plan/time" style="display:flex;width:100%;align-items:center;gap:12px;border:0;text-align:left;color:inherit;margin-top:12px;background:color-mix(in srgb, ${pd.catOf(running.cat).c} 14%, var(--surface))">
    <span class="ic" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:${pd.catOf(running.cat).c};color:#fff">${icon('timer')}</span>
    <span class="grow"><div class="b">${esc(pd.catOf(running.cat).name)} timer</div><div class="sm muted">Tap to stop</div></span><span class="num b" style="font-size:20px" data-since="${running.start}">0:00:00</span></button>` : ''}

  <div class="sh"><h2>Up next</h2><button class="link" data-act="go" data-href="#plan">Plan</button></div>
  ${ag.length ? `<div class="list">
    ${cur ? agendaRow(cur, 'now') : ''}
    ${upcoming.map((b) => agendaRow(b, '')).join('')}
    ${!cur && !upcoming.length ? `<div class="li"><span class="tx"><div class="t1">Nothing else scheduled</div><div class="t2">${ag.filter((b) => b.done).length} of ${ag.length} done today</div></span></div>` : ''}
  </div>` : `<div class="card empty" style="padding:16px"><b>Nothing scheduled today</b>Add practice, homework or a workout to your week.<br><br><button class="btn tinted sm" data-act="qaWeek">Add to the week</button></div>`}

  <div class="sh"><h2>Top 3</h2><button class="link" data-act="pickTop" data-day="today">${tops.length ? 'Edit' : 'Pick'}</button></div>
  ${tops.length ? `<div class="list">${tops.map((x, i) => taskRow(x, i + 1)).join('')}</div>`
    : `<div class="card empty" style="padding:16px"><b>What makes today a win?</b>Pick 3 tasks and knock them out.<br><br><button class="btn tinted sm" data-act="pickTop" data-day="today">Pick today's 3</button></div>`}

  <div class="sh"><h2>Today</h2></div>
  <div class="grid2">
    ${tile('Training', trainMins ? fmtDur(trainMins) : '0m', sessions.length ? sessions.map((s) => s.type).join(', ') : 'Nothing logged', clamp(trainMins / 90), 'var(--c-practice)', '#train')}
    ${tile('Day score', `${ds.total}<small>/100</small>`, `Top 3 ${ds.topPts} · night ${ds.nightPts} · phone ${ds.phonePts}`, ds.total / 100, 'var(--accent)', '#plan')}
    ${tile('Spanish', `${chMins}<small>/${chGoal} min</small>`, due ? `${due} card${due === 1 ? '' : 's'} due` : `${spanishStreak()} day streak`, chMins / chGoal, 'var(--carbs)', '#more/spanish')}
    ${tile(evening ? 'Night routine' : 'Phone', evening ? `${night.done}<small>/${night.total}</small>` : fmtDur(r.by.phone || 0), evening ? 'Wind down and lock in tomorrow' : `goal ${fmtDur(r.phoneGoal)}`, evening ? (night.total ? night.done / night.total : 0) : (r.by.phone || 0) / r.phoneGoal, evening ? 'var(--c-lift)' : 'var(--c-phone)', evening ? '#plan/night' : '#plan/time')}
  </div>
  `;
}
function foodLine(t, tot) {
  const left = t.calories - tot.calories, pl = Math.round(t.protein - tot.protein);
  if (!tot.calories) return 'Nothing logged yet today. Tap + to log breakfast.';
  return `${left >= 0 ? `${fmtNum(left)} cal left` : `${fmtNum(-left)} cal over`} · ${pl > 0 ? `${pl} g protein to go` : 'protein goal hit'}`;
}
function readinessCard(rs) {
  if (!rs) return `<button type="button" class="card" data-act="qaCheckin" style="display:flex;width:100%;align-items:center;gap:14px;border:0;text-align:left;color:inherit;margin-top:12px">
    <span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:var(--bad-soft);color:var(--fat)">${icon('heart')}</span>
    <span class="grow"><div class="b" style="font-size:17px">Morning check-in</div><div class="sm muted">30 seconds: sleep, soreness, energy → readiness</div></span>${chev}</button>`;
  const z = ru.ZONE[rs.zone], plan = ru.planFor(rs)[0];
  return `<button type="button" class="card" data-act="go" data-href="#train" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;width:100%;border:0;text-align:left;color:inherit;margin-top:12px">
    ${ring({ pct: rs.total / 100, size: 64, stroke: 7, color: z.color, center: `<b style="font-size:20px">${rs.total}</b>`, label: `Readiness ${rs.total}` })}
    <span style="min-width:0"><div class="row-g" style="gap:8px"><span class="b" style="font-size:17px">Readiness</span><span class="pill ${rs.zone === 'go' ? 'good' : rs.zone === 'caution' ? 'warn' : 'bad'}">${z.label}</span></div>
    <div class="sm muted" style="margin-top:2px">${esc(plan.t)} · slept ${rs.c.sleepH} h</div></span></button>`;
}
export function agendaRow(b, state) {
  const st = toMin(b.start), en = st + b.mins, col = b.src === 'wb' ? pd.WB_TYPES[b.type]?.color || 'var(--c-other)' : 'var(--accent)';
  return `<div class="li${b.done ? ' done' : ''}" style="align-items:flex-start">
    <span style="width:4px;align-self:stretch;border-radius:4px;background:${col};flex:none"></span>
    <span class="tx"><div class="t1">${esc(b.title)}</div><div class="t2">${state === 'now' ? '<b style="color:var(--accent)">Now</b> · ' : ''}${fmtTime(st)} – ${fmtTime(en)} · ${fmtDur(b.mins)}</div></span>
    <button type="button" class="check${b.done ? ' on' : ''}" data-act="agendaCheck" data-src="${b.src}" data-id="${esc(b.id)}" aria-label="${b.done ? 'Mark not done' : 'Mark done'}">${checkSvg}</button></div>`;
}
export function taskRow(t, rank) {
  return `<div class="li${t.done ? ' done' : ''}">${rank ? `<span class="num muted b" style="width:16px;text-align:center">${rank}</span>` : ''}
    <button type="button" class="tx" data-act="taskOpen" data-id="${t.id}" style="border:0;background:none;padding:0;text-align:left;color:inherit"><div class="t1">${esc(t.title)}</div>${t.due ? `<div class="t2">Due ${esc(t.due === todayIso() ? 'today' : t.due)}</div>` : ''}</button>
    <button type="button" class="check${t.done ? ' on' : ''}" data-act="taskCheck" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${checkSvg}</button></div>`;
}
function tile(label, big, sub, pct, color, href) {
  return `<button type="button" class="card" data-act="go" data-href="${href}" style="border:0;text-align:left;color:inherit;display:grid;gap:4px;margin:0;padding:14px">
    <span class="xs b muted" style="text-transform:uppercase;letter-spacing:.05em">${label}</span><span class="big" style="font-size:26px">${big}</span>
    <span class="xs muted ellipsis">${esc(sub)}</span>${bar(pct, color)}</button>`;
}
import { on, toast } from './ui.js';
import { haptic } from './util.js';
on({
  todayWater() { const v = ml.addWater(todayIso(), 16); haptic(); toast(`${v} oz of water today`); },
  agendaCheck(el) {
    const iso = todayIso(); haptic();
    if (el.dataset.src === 'wb') pd.toggleWb(el.dataset.id, iso);
    else pd.saveGpDay(iso, (d) => { const b = d.blocks.find((x) => x.id === el.dataset.id); if (b) b.done = !b.done; });
  },
});
