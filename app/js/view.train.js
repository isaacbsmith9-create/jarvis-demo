// Train: ReadyUp check-in and readiness, training log, load, sleep, recovery routines. Reads/writes ru:*.
import { esc, todayIso, shiftIso, shortDate, relDay, fmtDur, fmtTime, toMin, clamp, haptic, $, $$, avg, r1 } from './util.js';
import * as ru from './ru.js';
import { on, sheet, sheetOf, toast, icon, chev, ring, bar, barChart, lineChart, confirmTap, profileBtn } from './ui.js';

const zoneCls = (z) => (z === 'go' ? 'good' : z === 'caution' ? 'warn' : 'bad');
function gauge(score, zone) {
  const R = 80, cx = 100, cy = 96, len = Math.PI * R, arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  return `<svg viewBox="0 0 200 112" style="width:210px;max-width:100%;margin:0 auto" role="img" aria-label="Readiness ${score} out of 100">
    <path d="${arc}" fill="none" stroke="var(--surface-3)" stroke-width="16" stroke-linecap="round"/>
    <path d="${arc}" fill="none" stroke="${ru.ZONE[zone].color}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(len * score) / 100} ${len}"/>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" style="font:700 48px var(--f-num);fill:var(--fg)">${score}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" style="font:600 11px var(--f-ui);fill:var(--muted);letter-spacing:.08em">READINESS</text></svg>`;
}

export function render() {
  const iso = todayIso(), s = ru.scoreFor(iso), today = ru.day(iso)?.sessions || [], y = ru.day(shiftIso(iso, -1))?.sessions || [];
  const lr = ru.loadRatio(iso), week = Array.from({ length: 7 }, (_, i) => shiftIso(iso, -i)), weekMins = week.reduce((a, d) => a + (ru.day(d)?.sessions || []).reduce((b, x) => b + (Number(x.mins) || 0), 0), 0);
  const weekSessions = week.reduce((a, d) => a + (ru.day(d)?.sessions || []).length, 0), st = ru.settings();
  return `
  <header class="lt"><div><div class="eyebrow">${s ? `Checked in · streak ${ru.streakDays()}` : 'Not checked in yet'}</div><h1>Train</h1></div><div class="actions">${profileBtn()}</div></header>

  ${s ? `<div class="card" style="text-align:center">
      ${gauge(s.total, s.zone)}
      <div class="row-g" style="justify-content:center;margin-top:4px"><span class="pill ${zoneCls(s.zone)}">${ru.ZONE[s.zone].label}</span><span class="b">${esc(ru.ZONE[s.zone].head)}</span></div>
      <div class="stack-sm" style="margin-top:16px;text-align:left">${[['Sleep', s.parts.sleep, 30, `${s.c.sleepH} h`], ['Soreness', s.parts.soreness, 20, ru.LABELS.soreness[s.c.soreness - 1]], ['Sleep quality', s.parts.quality, 15, ru.LABELS.quality[s.c.quality - 1]],
        ['Energy', s.parts.energy, 15, ru.LABELS.energy[s.c.energy - 1]], ['Stress', s.parts.stress, 10, ru.LABELS.stress[s.c.stress - 1]], ['Training load', s.parts.load, 10, s.lr ? `${s.lr.ratio}x normal` : 'building baseline']]
        .map(([n, v, max, note]) => { const p = v / max; return `<div><div class="row-sb sm"><span>${n} <span class="muted">· ${esc(note)}</span></span><span class="num muted">${v}/${max}</span></div><div style="margin-top:4px">${bar(p, p >= 0.7 ? 'var(--good)' : p >= 0.45 ? 'var(--warn)' : 'var(--bad)')}</div></div>`; }).join('')}</div>
      <button class="btn block" style="margin-top:16px" data-act="qaCheckin">Edit check-in</button>
    </div>
    ${s.c.pain ? `<div class="note bad" style="margin-top:12px"><b>Pain is not soreness.</b> You said something hurts${s.c.painWhere ? ` (${esc(s.c.painWhere)})` : ''}. Tell your athletic trainer or coach before practice and don't play through sharp or joint pain.</div>` : ''}
    <div class="sh"><h2>Today's plan</h2></div>
    <div class="list">${ru.planFor(s).map((x) => `<div class="li" style="align-items:flex-start"><span class="dot" style="--c:${x.cls === 'good' ? 'var(--good)' : x.cls === 'warn' ? 'var(--warn)' : x.cls === 'bad' ? 'var(--bad)' : 'var(--faint)'};margin-top:7px"></span><span class="tx"><div class="t1" style="font-weight:600">${esc(x.t)}</div><div class="t2" style="color:var(--fg-2)">${esc(x.p)}</div></span></div>`).join('')}
      <div class="li"><span class="ic" style="--ic:var(--c-lift)">${icon('moon')}</span><span class="tx"><div class="t1">Lights out by ${fmtTime(ru.bedtimeFor(s.zone))}</div><div class="t2">${st.goal} h before your ${fmtTime(st.wake)} alarm${s.zone === 'rest' ? ', 30 min early for recovery' : ''}</div></span></div></div>`
  : `<div class="card" style="text-align:center;padding:24px 16px">
      <div style="width:64px;height:64px;border-radius:20px;margin:0 auto 12px;display:grid;place-items:center;background:var(--bad-soft);color:var(--fat)">${icon('heart')}</div>
      <h3 style="font-size:20px">How ready are you?</h3><p class="sm muted" style="margin:6px 0 16px">Sleep, soreness, energy and stress give you a 0-100 readiness score and a plan for today.</p>
      <button class="btn primary block" data-act="qaCheckin">Start check-in</button></div>`}

  <div class="sh"><h2>Training log</h2><button class="link" data-act="qaWorkout">Log session</button></div>
  <div class="list">
    ${today.length ? today.map((x, i) => sessionRow(x, i, iso)).join('') : `<div class="li"><span class="tx"><div class="t1 muted">Nothing logged today</div><div class="t2">Log practice, lifts and games so your load stays accurate.</div></span></div>`}
    ${y.length ? `<div class="li" style="min-height:34px;background:var(--surface-2)"><span class="label">Yesterday</span></div>${y.map((x, i) => sessionRow(x, i, shiftIso(iso, -1))).join('')}` : ''}
  </div>

  <div class="grid3" style="margin-top:12px">
    <div class="stat" style="background:var(--surface)"><b>${fmtDur(weekMins)}</b><span>7 days</span></div>
    <div class="stat" style="background:var(--surface)"><b>${weekSessions}</b><span>sessions</span></div>
    <div class="stat" style="background:var(--surface)"><b style="color:${lr ? (lr.ratio > 1.5 ? 'var(--bad)' : lr.ratio > 1.3 ? 'var(--warn)' : 'var(--good)') : 'var(--fg)'}">${lr ? lr.ratio + 'x' : '–'}</b><span>load ratio</span></div>
  </div>

  <div class="card" style="margin-top:12px"><div class="card-head"><div><h3>Training load</h3><div class="sub">minutes × effort, last 14 days</div></div></div><div class="chart" id="c-load"></div>
    <p class="xs muted" style="margin:8px 0 0">${lr ? `This week averages ${lr.acute}/day vs your 4-week ${lr.chronic}/day. ${lr.ratio > 1.5 ? 'Spike: ease off extras.' : lr.ratio < 0.8 ? 'Lighter than normal.' : 'On track.'}` : 'Load ratio appears after 14 days of check-ins or sessions.'}</p></div>
  <div class="card"><div class="card-head"><div><h3>Readiness</h3><div class="sub">last 14 days</div></div></div><div class="chart" id="c-ready"></div></div>
  <div class="card"><div class="card-head"><div><h3>Sleep</h3><div class="sub">goal ${st.goal} h</div></div><button class="btn ghost sm" data-act="sleepSettings">Settings</button></div><div class="chart" id="c-sleep"></div></div>

  <div class="sh"><h2>Recovery</h2></div>
  <div class="list">${ru.ROUTINES.map((r, i) => `<button type="button" class="li" data-act="routine" data-i="${i}"><span class="ic" style="--ic:${['var(--accent)', 'var(--c-practice)', 'var(--water)', 'var(--c-lift)', 'var(--c-game)'][i]}">${icon(['heart', 'train', 'bolt', 'moon', 'star'][i])}</span><span class="tx"><div class="t1">${r.name}</div><div class="t2">${r.mins} min · ${esc(r.when)}</div></span>${chev}</button>`).join('')}</div>
  `;
}
function sessionRow(x, i, iso) {
  return `<button type="button" class="li" data-act="editSession" data-iso="${iso}" data-i="${i}"><span class="ic" style="--ic:${x.type === 'Game' ? 'var(--c-game)' : x.type === 'Lifting' ? 'var(--c-lift)' : 'var(--c-practice)'}">${icon(x.type === 'Lifting' ? 'train' : x.type === 'Game' ? 'star' : 'bolt')}</span>
    <span class="tx"><div class="t1">${esc(x.type)}</div><div class="t2">${fmtDur(x.mins)} · effort ${x.rpe}/10 · load ${Math.round(x.mins * x.rpe)}</div></span>${chev}</button>`;
}
export function mount(root) {
  const days = Array.from({ length: 14 }, (_, i) => shiftIso(todayIso(), i - 13));
  barChart(root.querySelector('#c-load'), days, days.map((d) => ru.dayLoad(d) || null), { color: 'var(--c-practice)', name: 'Load' });
  const scores = days.map((d) => ru.scoreFor(d));
  lineChart(root.querySelector('#c-ready'), days, [{ name: 'Readiness', values: scores.map((s) => s?.total ?? null), color: 'var(--good)' }], { min: 0, max: 100, ref: 75, refName: 'Go zone', empty: 'Check in a few mornings to see your trend.' });
  lineChart(root.querySelector('#c-sleep'), days, [{ name: 'Sleep', values: days.map((d) => ru.day(d)?.checkin?.sleepH ?? null), color: 'var(--c-lift)' }], { min: 4, max: 11, unit: ' h', fmt: (v) => r1(v), ref: Number(ru.settings().goal) || 9, refName: 'Goal', empty: 'Check in a few mornings to see your sleep.' });
}

// ===================== check-in =====================
export function openCheckin() {
  const iso = todayIso(), c = ru.day(iso)?.checkin, st = ru.settings();
  const draft = c ? { ...c, areas: [...(c.areas || [])] } : { bed: '22:30', wake: st.wake || '06:45', quality: 0, soreness: 0, energy: 0, stress: 0, areas: [], pain: false, painWhere: '', rhr: '' };
  sheet({ title: 'Morning check-in', right: { label: 'Save', act: 'ciSave' }, data: { draft }, body: (api) => {
    const d = api.data.draft, h = ru.sleepHours(d.bed, d.wake), goal = Number(st.goal) || 9;
    const yS = ru.day(shiftIso(iso, -1))?.sessions || [];
    return `<div class="card"><h3>Sleep</h3>
      <div class="fields2" style="margin-top:10px"><label class="field"><span>Lights out</span><input class="input" type="time" value="${d.bed}" data-input="ciTime" data-k="bed"></label><label class="field"><span>Woke up</span><input class="input" type="time" value="${d.wake}" data-input="ciTime" data-k="wake"></label></div>
      <div class="sm" style="margin-top:10px" id="ci-hours">${h == null ? '' : `That's <b>${h} hours</b> (goal ${goal}).${h < goal - 1 ? ' Short night.' : h >= goal ? ' Nice.' : ''}`}</div></div>
      ${['quality', 'soreness', 'energy', 'stress'].map((k) => `<div class="card"><div class="row-sb"><h3>${{ quality: 'Sleep quality', soreness: 'Soreness', energy: 'Energy', stress: 'Stress' }[k]}</h3><span class="sm ${d[k] ? 'b' : 'muted'}">${d[k] ? ru.LABELS[k][d[k] - 1] : `1 ${ru.LABELS[k][0].toLowerCase()} · 5 ${ru.LABELS[k][4].toLowerCase()}`}</span></div>
        <div class="scale5" style="margin-top:10px">${[1, 2, 3, 4, 5].map((v) => `<button type="button" class="${d[k] === v ? 'on' : ''}" data-act="ciScale" data-k="${k}" data-v="${v}" aria-label="${k} ${v}: ${ru.LABELS[k][v - 1]}">${v}</button>`).join('')}</div>
        ${k === 'soreness' && d.soreness >= 2 ? `<div class="label" style="margin:12px 0 8px">Where?</div><div class="wrap-chips">${ru.AREAS.map((a) => `<button type="button" class="chip${d.areas.includes(a) ? ' on' : ''}" data-act="ciArea" data-a="${a}">${a}</button>`).join('')}</div>` : ''}</div>`).join('')}
      <div class="card"><label class="row-sb"><span><span class="b">Something hurts</span><div class="sm muted">Sharp or joint pain, not just sore</div></span><span class="switch"><input type="checkbox" ${d.pain ? 'checked' : ''} data-change="ciPain"><span></span></span></label>
        ${d.pain ? `<input class="input" style="margin-top:10px" placeholder="Where? e.g. right knee" maxlength="80" value="${esc(d.painWhere || '')}" data-input="ciPainWhere">` : ''}
        <label class="field" style="margin-top:12px"><span>Resting heart rate (optional)</span><input class="input" inputmode="numeric" placeholder="bpm" value="${d.rhr || ''}" data-input="ciRhr"></label></div>
      <div class="card"><div class="row-sb"><div><h3>Yesterday's training</h3><div class="sub">${yS.length ? yS.map((x) => `${x.type} ${fmtDur(x.mins)}`).join(' · ') : 'Nothing logged. Leave empty for a rest day.'}</div></div><button class="btn sm tinted" data-act="ciYesterday">Add</button></div></div>
      <button class="btn primary block" data-act="ciSave" style="margin-top:4px">Get my score</button>`;
  } });
}
on({
  ciTime(el) { const s = sheetOf(el), d = s.data.draft; d[el.dataset.k] = el.value; const h = ru.sleepHours(d.bed, d.wake), goal = Number(ru.settings().goal) || 9; $('#ci-hours', s.el).innerHTML = h == null ? '' : `That's <b>${h} hours</b> (goal ${goal}).${h < goal - 1 ? ' Short night.' : h >= goal ? ' Nice.' : ''}`; },
  ciScale(el) { const s = sheetOf(el), d = s.data.draft, k = el.dataset.k; d[k] = Number(el.dataset.v); if (k === 'soreness' && d.soreness < 2) d.areas = []; haptic(); const y = s.body.scrollTop; s.refresh(); s.body.scrollTop = y; },
  ciArea(el) { const s = sheetOf(el), d = s.data.draft, a = el.dataset.a; d.areas = d.areas.includes(a) ? d.areas.filter((x) => x !== a) : [...d.areas, a]; el.classList.toggle('on'); },
  ciPain(el) { const s = sheetOf(el); s.data.draft.pain = el.checked; const y = s.body.scrollTop; s.refresh(); s.body.scrollTop = y; },
  ciPainWhere(el) { sheetOf(el).data.draft.painWhere = el.value; },
  ciRhr(el) { sheetOf(el).data.draft.rhr = el.value; },
  ciYesterday() { openSession({ iso: shiftIso(todayIso(), -1) }); },
  ciSave(el) {
    const s = sheetOf(el), d = s.data.draft, missing = ['quality', 'soreness', 'energy', 'stress'].filter((k) => !d[k]);
    if (missing.length) return toast(`Tap a number for ${missing.join(', ')}`);
    const h = ru.sleepHours(d.bed, d.wake); if (h == null) return toast('Enter when you slept and woke up'); if (h > 16) return toast('More than 16 hours of sleep? Check the times.');
    ru.saveDay(todayIso(), (x) => { x.checkin = { bed: d.bed, wake: d.wake, sleepH: h, quality: d.quality, soreness: d.soreness, energy: d.energy, stress: d.stress, areas: d.areas, pain: !!d.pain, painWhere: String(d.painWhere || '').trim().slice(0, 80), rhr: Number(d.rhr) || null, at: Date.now() }; });
    s.close(); haptic(15);
    const sc = ru.scoreFor(todayIso()); toast(`Readiness ${sc.total}: ${ru.ZONE[sc.zone].head}`);
    if (!location.hash.startsWith('#train')) location.hash = '#train';
  },
});

// ===================== sessions =====================
export function openSession({ iso = todayIso(), i = null } = {}) {
  const ex = i != null ? ru.day(iso)?.sessions?.[i] : null;
  const draft = ex ? { ...ex } : { type: 'Practice', mins: 120, rpe: 6 };
  sheet({ title: ex ? 'Edit session' : `Log session · ${relDay(iso)}`, right: { label: 'Save', act: 'sesSave' }, data: { draft, iso, i }, body: (api) => {
    const d = api.data.draft;
    return `<div class="label" style="margin:4px 4px 8px">Type</div><div class="wrap-chips">${ru.TYPES.map((t) => `<button type="button" class="chip${d.type === t ? ' on' : ''}" data-act="sesType" data-t="${t}">${t}</button>`).join('')}</div>
      <div class="card" style="margin-top:16px"><div class="row-sb"><h3>Minutes</h3><div class="stepper"><button type="button" data-act="sesMins" data-d="-15" aria-label="Less">−</button><input class="num" inputmode="numeric" value="${d.mins}" data-input="sesMinsIn" aria-label="Minutes"><button type="button" data-act="sesMins" data-d="15" aria-label="More">+</button></div></div>
        <div class="wrap-chips" style="margin-top:12px">${[30, 45, 60, 90, 120, 150].map((m) => `<button type="button" class="chip${d.mins === m ? ' on' : ''}" data-act="sesMinsSet" data-m="${m}">${fmtDur(m)}</button>`).join('')}</div></div>
      <div class="card"><div class="row-sb"><h3>Effort</h3><span class="sm b">${d.rpe}/10 · ${d.rpe <= 3 ? 'easy' : d.rpe <= 6 ? 'moderate' : d.rpe <= 8 ? 'hard' : 'max'}</span></div>
        <div class="scale10" style="margin-top:10px">${Array.from({ length: 10 }, (_, k) => `<button type="button" class="${d.rpe === k + 1 ? 'on' : ''}" data-act="sesRpe" data-v="${k + 1}">${k + 1}</button>`).join('')}</div>
        <p class="xs muted" style="margin:8px 0 0">Load = minutes × effort = <b class="num">${Math.round(d.mins * d.rpe)}</b></p></div>
      <div class="stack-sm" style="margin-top:8px"><button class="btn primary block" data-act="sesSave">Save</button>${ex ? '<button class="btn danger block" data-act="sesDelete">Delete</button>' : ''}</div>`;
  } });
}
const refreshKeep = (s) => { const y = s.body.scrollTop; s.refresh(); s.body.scrollTop = y; };
on({
  editSession(el) { openSession({ iso: el.dataset.iso, i: Number(el.dataset.i) }); },
  sesType(el) { const s = sheetOf(el); s.data.draft.type = el.dataset.t; refreshKeep(s); },
  sesMins(el) { const s = sheetOf(el), d = s.data.draft; d.mins = clamp(d.mins + Number(el.dataset.d), 5, 400); refreshKeep(s); },
  sesMinsSet(el) { const s = sheetOf(el); s.data.draft.mins = Number(el.dataset.m); refreshKeep(s); },
  sesMinsIn(el) { const v = Number(el.value); if (v > 0) sheetOf(el).data.draft.mins = clamp(v, 1, 400); },
  sesRpe(el) { const s = sheetOf(el); s.data.draft.rpe = Number(el.dataset.v); haptic(); refreshKeep(s); },
  sesSave(el) {
    const s = sheetOf(el), { draft, iso, i } = s.data;
    ru.saveDay(iso, (d) => { const x = { type: draft.type, mins: Number(draft.mins) || 0, rpe: Number(draft.rpe) || 5 }; if (i != null) d.sessions[i] = x; else d.sessions.push(x); });
    s.close(); haptic(12); toast(`${draft.type} · ${fmtDur(draft.mins)} logged`);
    $$('dialog.sheet').forEach((dl) => { if (dl !== s.el && dl._sheet?.data?.draft?.bed) refreshKeep(dl._sheet); });
  },
  sesDelete(el) { if (!confirmTap(el)) return; const s = sheetOf(el), { iso, i } = s.data; ru.saveDay(iso, (d) => { d.sessions.splice(i, 1); }); s.close(); toast('Session deleted'); },
  sleepSettings() {
    const st = ru.settings();
    sheet({ title: 'Sleep settings', right: { label: 'Save', act: 'sleepSave' }, body: `<div class="stack"><label class="field"><span>School-day wake time</span><input class="input" type="time" id="ss-wake" value="${st.wake}"></label>
      <label class="field"><span>Sleep goal</span><select class="input" id="ss-goal">${[7, 7.5, 8, 8.5, 9, 9.5, 10].map((g) => `<option value="${g}"${Number(st.goal) === g ? ' selected' : ''}>${g} hours</option>`).join('')}</select></label>
      <p class="sm muted" style="margin:0">Teens need 8-10 hours. Athletes recover best near the top of that range.</p><button class="btn primary block" data-act="sleepSave">Save</button></div>` });
  },
  sleepSave(el) { const s = sheetOf(el), wake = $('#ss-wake', s.el).value, goal = Number($('#ss-goal', s.el).value); ru.saveCore((c) => { c.settings.wake = wake || '06:45'; c.settings.goal = goal; }); s.close(); toast('Saved'); },
  routine(el) { openRoutine(Number(el.dataset.i)); },
});

// ===================== routine player =====================
let play = null;
function openRoutine(i) {
  const r = ru.ROUTINES[i];
  play = { r, i: 0, left: r.steps[0][1], paused: false, timer: null, done: {} };
  const s = sheet({ title: r.name, left: { label: 'Close', close: true }, body: playerBody, onClose: () => { clearInterval(play?.timer); try { play?.lock?.release(); } catch {} play = null; } });
  try { navigator.wakeLock?.request('screen').then((l) => { if (play) play.lock = l; }).catch(() => {}); } catch {}
  play.sheet = s; startStep();
}
function playerBody() {
  if (!play) return '';
  const { r } = play;
  if (r.check) return `<p class="sm muted" style="margin:0 4px 12px">${esc(r.when)}</p><div class="list">${r.steps.map(([n, , cue], k) => `<div class="li" style="align-items:flex-start"><button type="button" class="check${play.done[k] ? ' on' : ''}" data-act="plCheck" data-k="${k}" aria-label="${esc(n)}">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'}</button><span class="tx"><div class="t1">${esc(n)}</div><div class="t2">${esc(cue)}</div></span></div>`).join('')}</div>
    <button class="btn primary block" style="margin-top:16px" data-close>Done</button>`;
  const [name, secs, cue] = r.steps[play.i], pct = 1 - play.left / secs;
  return `<div style="text-align:center;padding:8px 0 4px"><div class="sm muted">Step ${play.i + 1} of ${r.steps.length}</div>
    <h3 style="font-size:24px;margin:6px 0 4px">${esc(name)}</h3><p class="sm" style="color:var(--fg-2);margin:0 auto;max-width:320px;min-height:40px">${esc(cue)}</p>
    <div style="display:grid;place-items:center;margin:18px 0">${r.breath ? breathBall() : ring({ pct, size: 180, stroke: 12, color: 'var(--accent)', center: `<b style="font-size:44px">${Math.floor(play.left / 60)}:${String(play.left % 60).padStart(2, '0')}</b><span>${play.paused ? 'paused' : 'left'}</span>` })}</div>
    <div class="grid2"><button class="btn" data-act="plPause">${play.paused ? 'Resume' : 'Pause'}</button><button class="btn primary" data-act="plNext">${play.i === r.steps.length - 1 ? 'Finish' : 'Next'}</button></div>
    <div style="margin-top:14px">${bar((play.i + pct) / r.steps.length)}</div></div>`;
}
function breathBall() {
  const el = play.r.steps[0][1] - play.left, phase = Math.floor(el / 4) % 4;
  // One continuous 16 s CSS cycle; the negative delay keeps it in sync across re-renders.
  return `<div style="width:180px;height:180px;display:grid;place-items:center"><div class="breath" style="animation-delay:-${el}s;animation-play-state:${play.paused ? 'paused' : 'running'}"></div><b style="position:absolute;font-size:20px">${['Breathe in', 'Hold', 'Breathe out', 'Hold'][phase]}</b></div><div class="num muted">${Math.floor(play.left / 60)}:${String(play.left % 60).padStart(2, '0')}</div>`;
}
function startStep() {
  clearInterval(play.timer); if (play.r.check) return;
  play.left = play.r.steps[play.i][1]; play.paused = false; play.sheet.refresh();
  play.timer = setInterval(() => { if (!play || play.paused) return; play.left--; if (play.left <= 0) { haptic(30); return nextStep(); } play.sheet.refresh(); }, 1000);
}
function nextStep() { if (play.i < play.r.steps.length - 1) { play.i++; startStep(); } else { const n = play.r.name; play.sheet.close(); toast(`${n} done. Nice work.`); } }
on({
  plPause() { if (!play) return; play.paused = !play.paused; play.sheet.refresh(); },
  plNext() { if (play) nextStep(); },
  plCheck(el) { if (!play) return; const k = Number(el.dataset.k); play.done[k] = !play.done[k]; haptic(); play.sheet.refresh(); },
});
