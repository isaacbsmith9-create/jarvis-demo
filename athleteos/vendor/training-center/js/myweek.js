/* ==================== My Week: you plan it, the app runs it ====================
   Replaces the auto-coach. Drag workout types onto days (or tap a type, then tap + on a day).
   Each block starts the right tool: Spot Map, Workout Builder in a mode, a saved workout,
   a Shot Lab routine, or logs a program session. */
var WT = {
  'spot-feel': { n: 'Feel-good shooting', g: 'Shooting', c: '#ff913d', ic: 'crosshair', m: 30, spot: 'feel' },
  rhythm: { n: 'Rhythm shooting (light)', g: 'Shooting', c: '#7fb0d6', ic: 'repeat', m: 30, mode: 'rhythm', focus: ['Shooting'] },
  'spot-movement': { n: 'Movement 3s', g: 'Shooting', c: '#ffa55c', ic: 'crosshair', m: 30, spot: 'movement' },
  'spot-create': { n: 'Shot creation', g: 'Shooting', c: '#ff7a59', ic: 'zap', m: 30, spot: 'create' },
  'spot-transition': { n: 'Transition shooting', g: 'Shooting', c: '#ffb86b', ic: 'fast-forward', m: 20, spot: 'transition' },
  game: { n: 'Game-like (CLA)', g: 'Skill & CLA', c: '#ff5d5d', ic: 'flame', m: 45, mode: 'game', focus: ['Shooting', 'Finishing'], hard: 1 },
  'cla-finish': { n: 'CLA finishing (glass)', g: 'Skill & CLA', c: '#e5606e', ic: 'circle-dot', m: 15, mode: 'game', focus: ['Finishing'], hard: 1 },
  skill: { n: 'Skill work', g: 'Skill & CLA', c: '#c8a46b', ic: 'target', m: 30, mode: 'skill', focus: ['Finishing', 'Ball Handling'] },
  handle: { n: 'Ball handling', g: 'Skill & CLA', c: '#a8b4c0', ic: 'activity', m: 15, mode: 'skill', focus: ['Ball Handling'] },
  creative: { n: 'Creative', g: 'Skill & CLA', c: '#e08aa0', ic: 'sparkles', m: 20, mode: 'creative', focus: ['Finishing', 'Ball Handling'] },
  strength: { n: 'Strength / lift', g: 'Body', c: '#55c98b', ic: 'dumbbell', m: 45, mode: 'strength', focus: ['Conditioning', 'Footwork'] },
  practice: { n: 'Team practice', g: 'Team', c: '#ffd166', ic: 'shield', m: 150, hard: 1 },
  'game-day': { n: 'Game', g: 'Team', c: '#ffe08a', ic: 'trophy', m: 90, hard: 1 },
  film: { n: 'Film', g: 'Body', c: '#7fc4cf', ic: 'clapperboard', m: 20, href: '#film' },
  rest: { n: 'Rest / recovery', g: 'Body', c: '#8f8d93', ic: 'heart-pulse', m: 0 },
};
var WT_GROUPS = ['Shooting', 'Skill & CLA', 'Team', 'Body', 'Yours'];
var WK_MINS = [0, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180];
var WK = { off: 0, pick: null, pickDay: null, active: null };
function myWeek() {
  if (!S.myweek || typeof S.myweek !== 'object') S.myweek = { weeks: {}, def: null };
  if (!S.myweek.weeks) S.myweek.weeks = {};
  return S.myweek;
}
/* everything you can drop on a day: built-in types + your saved workouts, Spot Map routines, outside programs */
function wtInfo(k) {
  if (WT[k]) return WT[k];
  var id = k.slice(2), x;
  if (k.indexOf('w:') === 0 && (x = S.workouts.find(function (w) { return w.id === id; }))) { var base = x.wt && WT[x.wt]; return { n: x.name, g: 'Yours', c: base ? base.c : '#e9d98d', ic: base ? base.ic : 'dumbbell', m: x.minutes || 30, workout: id, hard: base ? base.hard : 0 }; }
  if (k.indexOf('r:') === 0 && (x = (S.shotPlans || []).find(function (r) { return r.id === id; }))) return { n: x.name, g: 'Yours', c: '#ffc48a', ic: 'crosshair', m: Math.max(10, Math.round(sum(x.steps, function (s) { return s[2]; }) / 2.6 / 5) * 5), routine: id };
  if (k.indexOf('p:') === 0 && (x = weekState().programs.find(function (p) { return p.id === id; }))) return { n: x.name, g: 'Yours', c: '#7dd3a8', ic: 'book-open', m: 45, program: id };
  return { n: 'Removed item', g: 'Yours', c: '#666', ic: 'x', m: 0, gone: 1 };
}
function wtYours() {
  return S.workouts.filter(function (w) { return w.writer; }).concat(S.workouts.filter(function (w) { return w.custom && !w.coach && !w.writer; }).slice(-6)).map(function (w) { return 'w:' + w.id; })
    .concat((S.shotPlans || []).map(function (r) { return 'r:' + r.id; }))
    .concat(weekState().programs.map(function (p) { return 'p:' + p.id; }));
}
function wkStart(off) { return addDays(weekStart(today()), 7 * (off || 0)); }
function wkDays(ws, create) {
  var mw = myWeek(), d = mw.weeks[ws];
  if (!d && create) {
    d = [[], [], [], [], [], [], []];
    if (mw.def && ws >= weekStart(today())) d = mw.def.map(function (day) { return day.map(function (b) { return { id: uid(), k: b.k, mins: b.mins, done: false }; }); });
    mw.weeks[ws] = d;
  }
  return d || [[], [], [], [], [], [], []];
}
function wkFind(id) { var mw = myWeek(), r = null; Object.keys(mw.weeks).some(function (ws) { return mw.weeks[ws].some(function (day, di) { var i = day.findIndex(function (b) { return b.id === id; }); if (i >= 0) { r = { ws: ws, di: di, i: i, b: day[i] }; return true; } return false; }); }); return r; }
function wkStats(ws) {
  var d = wkDays(ws), out = { n: 0, done: 0, mins: 0, doneMins: 0, g: {}, warn: [] };
  d.forEach(function (day, di) {
    var hard = 0, lab = fmtDay(addDays(ws, di), { weekday: 'short' });
    day.forEach(function (b) { var t = wtInfo(b.k); if (b.k === 'rest') return; out.n++; out.mins += b.mins; out.g[t.g] = (out.g[t.g] || 0) + b.mins; if (b.done) { out.done++; out.doneMins += b.mins; } if (t.hard) hard++; });
    if (hard >= 3) out.warn.push([lab, 'bad', hard + ' hard sessions. Your rule: never 3 hard. Make one of them light (rhythm, feel-good shooting or a quick handle).']);
    var next = d[di + 1] || (wkDays(addDays(ws, 7))[0] || []);
    if (next.some(function (b) { return b.k === 'game-day'; }) && day.some(function (b) { return b.k === 'game' || b.k === 'cla-finish'; })) out.warn.push([lab, 'warn', 'Hard CLA work the day before a game. Rhythm or feel-good shooting fits better here.']);
    if (day.length > 4) out.warn.push([lab, 'warn', day.length + ' blocks. A lot for one day; keep the extras short.']);
  });
  return out;
}
var WT_GC = { Shooting: '#ff913d', 'Skill & CLA': '#ff5d5d', Team: '#ffd166', Body: '#55c98b', Yours: '#e9d98d' };
function wkBlock(b, ws, compact) {
  var t = wtInfo(b.k), can = !t.gone && b.k !== 'rest' && b.k !== 'practice' && b.k !== 'game-day';
  return '<div class="wk-b' + (b.done ? ' done' : '') + '" draggable="true" data-bid="' + b.id + '" style="--c:' + t.c + '"><div class="wk-bt"><span class="wk-bi">' + ic(t.ic, 14) + '</span><b>' + esc(t.n) + '</b></div>' +
    '<div class="wk-bm">' + (b.k === 'rest' ? '<span class="tiny muted">Off</span>' : '<select data-c="wk-mins" data-bid="' + b.id + '" aria-label="Minutes for ' + esc(t.n) + '">' + WK_MINS.concat(WK_MINS.indexOf(b.mins) < 0 ? [b.mins] : []).sort(function (x, y) { return x - y; }).map(function (m) { return '<option value="' + m + '"' + (m === b.mins ? ' selected' : '') + '>' + m + 'm</option>'; }).join('') + '</select>') +
    '<span class="grow"></span>' + (can && !b.done ? '<button class="wk-ib go" data-a="wk-start" data-bid="' + b.id + '" title="Start" aria-label="Start ' + esc(t.n) + '">' + ic('play', 13) + '</button>' : '') +
    '<button class="wk-ib' + (b.done ? ' on' : '') + '" data-a="wk-done" data-bid="' + b.id + '" title="' + (b.done ? 'Mark not done' : 'Mark done') + '" aria-label="Done">' + ic('check', 13) + '</button>' +
    (compact ? '' : '<button class="wk-ib rm" data-a="wk-rm" data-bid="' + b.id + '" title="Remove" aria-label="Remove">' + ic('x', 13) + '</button>') + '</div></div>';
}
function wkPalette() {
  var keys = Object.keys(WT).concat(wtYours());
  return '<section class="panel wk-pal' + (WK.pickDay != null ? ' picking' : '') + '"><div class="phead"><div><h3>Workout types</h3><div class="sub">' + (WK.pickDay != null ? '<b class="acc">Adding to ' + esc(fmtDay(addDays(wkStart(WK.off), WK.pickDay), { weekday: 'long' })) + ':</b> tap a type' : 'Drag onto a day. On your phone: tap a type, then tap + on a day.') + '</div></div>' + (WK.pick || WK.pickDay != null ? '<button class="btn sm g" data-a="wk-cancel">Cancel</button>' : '') + '</div>' +
    WT_GROUPS.map(function (g) { var ks = keys.filter(function (k) { return wtInfo(k).g === g; }); if (!ks.length) return '';
      return '<div class="wk-pg"><span class="kick">' + esc(g) + '</span><div class="wk-tiles">' + ks.map(function (k) { var t = wtInfo(k); return '<div class="wk-tile' + (WK.pick === k ? ' on' : '') + '" role="button" tabindex="0" aria-pressed="' + (WK.pick === k) + '" draggable="true" data-a="wk-tile" data-k="' + esc(k) + '" style="--c:' + t.c + '"><span class="wk-bi">' + ic(t.ic, 14) + '</span>' + esc(t.n) + '</div>'; }).join('') + '</div></div>'; }).join('') +
    (wtYours().length ? '' : '<p class="tiny muted" style="margin:8px 0 0">Saved workouts, Spot Map routines and programs you follow (like BAM) show up here under “Yours”.</p>') + '</section>';
}
function viewMyWeek() {
  var ws = wkStart(WK.off), d = wkDays(ws, true), st = wkStats(ws), t = today();
  var range = fmtDay(ws, { month: 'short', day: 'numeric' }) + ' – ' + fmtDay(addDays(ws, 6), { month: 'short', day: 'numeric' });
  var empty = d.every(function (x) { return !x.length; });
  return pageHead('Plan', 'My Week', '<div class="seg"><button data-a="wk-off" data-v="-1" aria-label="Previous week">' + ic('chevron-left', 16) + '</button><button class="' + (WK.off === 0 ? 'on' : '') + '" data-a="wk-off" data-v="0">This week</button><button data-a="wk-off" data-v="1" aria-label="Next week">' + ic('chevron-right', 16) + '</button></div>') +
    '<section class="panel wk-sum"><div class="wk-sl"><div class="kick">' + esc(range) + '</div><h2>' + st.done + ' of ' + st.n + ' done</h2><p class="small ink2">' + fmtMin(st.doneMins) + ' of ' + fmtMin(st.mins) + ' planned' + (WK.off === 0 ? '' : '') + '</p>' +
    (st.mins ? '<div class="stackbar big">' + WT_GROUPS.filter(function (g) { return st.g[g]; }).map(function (g) { return '<i style="flex:' + st.g[g] + ';background:' + WT_GC[g] + '" title="' + esc(g) + ': ' + st.g[g] + ' min"></i>'; }).join('') + '</div><div class="wk-leg">' + WT_GROUPS.filter(function (g) { return st.g[g]; }).map(function (g) { return '<span><i style="background:' + WT_GC[g] + '"></i>' + esc(g) + ' ' + fmtMin(st.g[g]) + '</span>'; }).join('') + '</div>' : '') + '</div>' +
    '<div class="wk-acts">' + (empty ? '<button class="btn sm p" data-a="wk-sample">' + ic('sparkles', 14) + ' Sample week</button>' + (myWeek().def ? '<button class="btn sm" data-a="wk-usedef">Use my default week</button>' : '') : '') +
    '<button class="btn sm g" data-a="wk-copy">' + ic('repeat', 14) + ' Copy last week</button>' + (!empty ? '<button class="btn sm g" data-a="wk-savedef">' + ic('star', 14) + ' Save as my default</button><button class="btn sm g" data-a="wk-clear">' + ic('x', 14) + ' Clear</button>' : '') + '</div></section>' +
    (st.warn.length ? '<div class="wk-warn">' + st.warn.map(function (w) { return '<div class="wk-w ' + w[1] + '"><b>' + esc(w[0]) + '</b> ' + esc(w[2]) + '</div>'; }).join('') + '</div>' : '') +
    '<div class="wk-grid">' + d.map(function (day, i) { var dk = addDays(ws, i), mins = sum(day, function (b) { return b.mins; });
      return '<div class="wk-day' + (dk === t ? ' today' : '') + (WK.pickDay === i ? ' tgt' : '') + '" data-day="' + i + '"><div class="wk-dh"><b>' + esc(fmtDay(dk, { weekday: 'short' })) + '</b><span>' + esc(fmtDay(dk, { month: 'numeric', day: 'numeric' })) + '</span>' + (mins ? '<em>' + fmtMin(mins) + '</em>' : '') + '</div>' +
        '<div class="wk-bs">' + day.map(function (b) { return wkBlock(b, ws); }).join('') + '</div>' +
        '<button class="wk-add' + (WK.pick ? ' hot' : '') + '" data-a="wk-addto" data-day="' + i + '">' + ic('plus', 14) + (WK.pick ? ' Add ' + esc(wtInfo(WK.pick).n) : ' Add') + '</button></div>'; }).join('') + '</div>' +
    wkPalette();
}
/* ---- actions ---- */
function wkAdd(di, k, before) {
  var ws = wkStart(WK.off), d = wkDays(ws, true), t = wtInfo(k), b = { id: uid(), k: k, mins: t.m, done: false };
  var arr = d[di], j = before ? arr.findIndex(function (x) { return x.id === before; }) : -1; if (j >= 0) arr.splice(j, 0, b); else arr.push(b);
  save(); return b;
}
function wkMove(id, di, before) {
  var f = wkFind(id); if (!f || before === id) return; var d = myWeek().weeks[f.ws]; d[f.di].splice(f.i, 1);
  var tgt = wkDays(wkStart(WK.off), true)[di], j = before ? tgt.findIndex(function (x) { return x.id === before; }) : -1; if (j >= 0) tgt.splice(j, 0, f.b); else tgt.push(f.b); save();
}
ACT['wk-off'] = function (el) { var v = +el.dataset.v; WK.off = v === 0 ? 0 : WK.off + v; WK.pickDay = null; render(); };
ACT['wk-tile'] = function (el) {
  var k = el.dataset.k;
  if (WK.pickDay != null) { var di = WK.pickDay; WK.pickDay = null; wkAdd(di, k); render(); toast('Added ' + wtInfo(k).n); return; }
  WK.pick = WK.pick === k ? null : k; render(); if (WK.pick) toast('Now tap + on a day');
};
ACT['wk-addto'] = function (el) {
  var di = +el.dataset.day;
  if (WK.pick) { wkAdd(di, WK.pick); render(); return; }
  WK.pickDay = WK.pickDay === di ? null : di; render(); var p = $('.wk-pal'); if (p && WK.pickDay != null && p.getBoundingClientRect().top > innerHeight - 120) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
ACT['wk-cancel'] = function () { WK.pick = null; WK.pickDay = null; render(); };
ACT['wk-rm'] = function (el) { var f = wkFind(el.dataset.bid); if (!f) return; myWeek().weeks[f.ws][f.di].splice(f.i, 1); save(); render(); };
ACT['wk-done'] = function (el) { var f = wkFind(el.dataset.bid); if (!f) return; f.b.done = !f.b.done; save(); render(); if (f.b.done) toast('Nice. ' + wtInfo(f.b.k).n + ' done'); };
CHG['wk-mins'] = function (el) { var f = wkFind(el.dataset.bid); if (!f) return; f.b.mins = +el.value; save(); render(); };
ACT['wk-sample'] = function () {
  var B = function (k, m) { return { id: uid(), k: k, mins: m == null ? WT[k].m : m, done: false }; };
  myWeek().weeks[wkStart(WK.off)] = [
    [B('rhythm'), B('practice'), B('cla-finish')], [B('spot-feel'), B('practice'), B('handle')], [B('rhythm'), B('practice'), B('cla-finish')], [B('spot-feel'), B('practice'), B('creative')],
    [B('rhythm', 20), B('game-day')], [B('game', 45), B('spot-create')], [B('rest'), B('film')]];
  save(); render(); toast('Sample week loaded. Drag things around to match your real schedule.');
};
ACT['wk-copy'] = function () {
  var prev = myWeek().weeks[addDays(wkStart(WK.off), -7)];
  if (!prev || prev.every(function (x) { return !x.length; })) { toast('Nothing planned last week to copy', 'warn'); return; }
  var cur = wkDays(wkStart(WK.off), true); if (!cur.every(function (x) { return !x.length; }) && UI.armed !== 'wk-copy') { UI.armed = 'wk-copy'; toast('Tap again to replace this week with last week', 'warn'); return; } UI.armed = null;
  myWeek().weeks[wkStart(WK.off)] = prev.map(function (day) { return day.map(function (b) { return { id: uid(), k: b.k, mins: b.mins, done: false }; }); }); save(); render(); toast('Copied last week');
};
ACT['wk-savedef'] = function () { myWeek().def = wkDays(wkStart(WK.off)).map(function (day) { return day.map(function (b) { return { k: b.k, mins: b.mins }; }); }); save(); render(); toast('Saved. New weeks start from this one.'); };
ACT['wk-usedef'] = function () { var mw = myWeek(); if (!mw.def) return; mw.weeks[wkStart(WK.off)] = mw.def.map(function (day) { return day.map(function (b) { return { id: uid(), k: b.k, mins: b.mins, done: false }; }); }); save(); render(); };
ACT['wk-clear'] = function () { if (UI.armed !== 'wk-clear') { UI.armed = 'wk-clear'; toast('Tap Clear again to empty this week', 'warn'); return; } UI.armed = null; myWeek().weeks[wkStart(WK.off)] = [[], [], [], [], [], [], []]; save(); render(); };
/* start a block with the right tool */
ACT['wk-start'] = function (el) {
  var f = wkFind(el.dataset.bid); if (!f) return; var t = wtInfo(f.b.k), mins = f.b.mins || t.m || 30; WK.active = { id: f.b.id, date: addDays(f.ws, f.di) };
  if (t.spot) { var st = spState(); st.mins = Math.max(5, mins); var pr = SP_PRESETS.filter(function (x) { return x.id === t.spot; })[0] || SP_PRESETS[0]; st.lastFill = pr.id; st.plan = spFill(pr.w, Math.max(5, Math.floor((st.mins * spPresetRate(pr.w)) / 5) * 5), (st.seed || 0) + Math.floor(keyDate(addDays(f.ws, f.di)) / 864e5)); var fs = spSteps(st.plan)[0]; if (fs) st.sel = fs[4]; save(); location.hash = '#spots'; return; }
  if (t.mode) { var o = bState().opts; o.mode = t.mode; o.focus = t.focus.slice(); o.mins = B_TIMES.reduce(function (a, x) { return Math.abs(x - mins) < Math.abs(a - mins) ? x : a; }, 30); o.intensity = t.mode === 'game' ? 'game' : 'skill'; bState().draft = genWorkout(o, uid()); if (f.b.k === 'cla-finish') bState().draft.name = mins + '-Min CLA Finishing'; save(); location.hash = '#builder'; return; }
  if (t.workout) { ACT['start-template']({ dataset: { id: t.workout } }); return; }
  if (t.routine) { ACT['shot-start']({ dataset: { id: t.routine } }); return; }
  if (t.program) { ACT['ext-log']({ dataset: { id: t.program } }); return; }
  if (t.href) { location.hash = t.href; return; }
};
/* finishing any session marks the block you started as done */
(function () {
  var _commit = commitSession;
  commitSession = function (s) { var r = _commit.apply(this, arguments); try { if (WK.active && s) { var f = wkFind(WK.active.id); if (f) { f.b.done = true; save(); } WK.active = null; } } catch (e) { /* never block a save */ } return r; };
})();
/* drag and drop */
(function () {
  var drag = null;
  document.addEventListener('dragstart', function (e) { var el = e.target.closest && e.target.closest('[data-bid].wk-b, .wk-tile'); if (!el) return; drag = el.classList.contains('wk-tile') ? { k: el.dataset.k } : { id: el.dataset.bid }; try { e.dataTransfer.setData('text/plain', drag.k || drag.id); e.dataTransfer.effectAllowed = 'copyMove'; } catch (x) { /* ok */ } el.classList.add('dragging'); });
  document.addEventListener('dragend', function () { drag = null; $$('.wk-day.over').forEach(function (d) { d.classList.remove('over'); }); $$('.dragging').forEach(function (d) { d.classList.remove('dragging'); }); });
  document.addEventListener('dragover', function (e) { var day = drag && e.target.closest && e.target.closest('.wk-day'); if (!day) return; e.preventDefault(); $$('.wk-day.over').forEach(function (d) { if (d !== day) d.classList.remove('over'); }); day.classList.add('over'); });
  document.addEventListener('drop', function (e) { var day = drag && e.target.closest && e.target.closest('.wk-day'); if (!day) return; e.preventDefault(); var bef = e.target.closest('.wk-b'), di = +day.dataset.day, before = bef ? bef.dataset.bid : null;
    if (drag.k) wkAdd(di, drag.k, before); else wkMove(drag.id, di, before); drag = null; WK.pick = null; render(); });
})();
document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('wk-tile')) { e.preventDefault(); e.target.click(); } });
/* ---- Home: today + this week ---- */
function wkTodayCard() {
  var t = today(), ws = weekStart(t), d = wkDays(ws, true), di = d.length ? Math.round((keyDate(t) - keyDate(ws)) / 864e5) : 0, day = d[di] || [];
  var left = day.filter(function (b) { return !b.done && b.k !== 'rest'; }), mins = sum(day, function (b) { return b.mins; });
  if (!day.length) return '<div class="today-card"><div class="kick">Today</div><h2>Nothing planned</h2><p style="color:#d0cdc8;margin:6px 0 0" class="small">Plan your week once and every day shows up here with a start button.</p><div class="btns" style="margin-top:12px"><a class="btn p" href="#week">' + ic('calendar-days', 16) + ' Plan my week</a><a class="btn" href="#spots">' + ic('crosshair', 16) + ' Spot Map</a></div></div>';
  return '<div class="today-card"><div class="kick">Today · ' + fmtMin(mins) + ' planned</div><h2>' + (left.length ? esc(wtInfo(left[0].k).n) + (left.length > 1 ? ' + ' + (left.length - 1) + ' more' : '') : day.every(function (b) { return b.k === 'rest'; }) ? 'Rest day' : 'All done today') + '</h2><div class="tc-list">' +
    day.map(function (b) { return wkBlock(b, ws, true); }).join('') + '</div><a class="tiny tc-link" href="#week">Edit my week ' + ic('arrow-right', 12) + '</a></div>';
}
function wkMiniHTML() {
  var t = today(), ws = weekStart(t), d = wkDays(ws), st = wkStats(ws);
  return '<section class="panel wk-mini"><div class="phead"><div><h3>My week</h3><div class="sub">' + st.done + ' of ' + st.n + ' done · ' + fmtMin(st.doneMins) + ' of ' + fmtMin(st.mins) + '</div></div><a class="btn sm" href="#week">Plan ' + ic('arrow-right', 14) + '</a></div><div class="wk-mg">' +
    d.map(function (day, i) { var dk = addDays(ws, i); return '<a href="#week" class="wk-md' + (dk === t ? ' today' : '') + '"><b>' + esc(fmtDay(dk, { weekday: 'narrow' })) + '</b>' + (day.length ? day.map(function (b) { var x = wtInfo(b.k); return '<i class="' + (b.done ? 'done' : '') + '" style="--c:' + x.c + '" title="' + esc(x.n) + '"></i>'; }).join('') : '<i class="none"></i>') + '</a>'; }).join('') + '</div></section>';
}
function wkDom(html, fn) { var tp = document.createElement('template'); tp.innerHTML = html; fn(tp.content); var dv = document.createElement('div'); dv.appendChild(tp.content); return dv.innerHTML; }
/* the auto-coach is gone: tidy leftover wording on other pages */
function wkScrub(root) {
  var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = []; while ((n = tw.nextNode())) list.push(n);
  list.forEach(function (t) { var v = t.nodeValue; if (!/coach/i.test(v)) return;
    v = v.replace(/Your coach shortens today’s session when readiness is low/, 'Check in before you train').replace(/coach sessions/gi, 'planned sessions').replace(/, ratings and coach plan/, ' and your stats');
    if (/coach/i.test(v)) v = (v.match(/[^.!?]+[.!?]*\s*/g) || []).filter(function (x) { return !/\bcoach/i.test(x); }).join('');
    t.nodeValue = v; });
}
function wkSection(root, title) { return Array.prototype.slice.call(root.querySelectorAll('section.panel')).filter(function (s) { var h = s.querySelector('.phead h3'); return h && h.textContent.trim() === title; })[0]; }
(function () {
  autoWeek = function () {};
  /* one-time cleanup: drop the auto-coach's future unfinished sessions (finished history stays) */
  var mw = myWeek();
  if (!mw.migrated) {
    var t = today(); S.plan = S.plan.filter(function (p) { return !(p.coach && p.status !== 'done' && p.date >= t); });
    S.workouts = S.workouts.filter(function (w) { return !w.coach || S.plan.some(function (p) { return p.workoutId === w.id; }) || S.sessions.some(function (s) { return s.workoutId === w.id; }); });
    mw.migrated = Date.now(); save();
  }
  var _rv = routeView; routeView = function (r) { if (r === 'week' || r === 'coach' || r === 'coach-setup') return viewMyWeek(); return _rv(r); };
  Object.assign(TAB_OF, { week: 'coach', coach: 'coach' });
  var _home = viewHomePro;
  viewHomePro = function () {
    return wkDom(_home(), function (root) {
      var tc = root.querySelector('.today-card'); if (tc) { var x = document.createElement('div'); x.innerHTML = wkTodayCard(); tc.replaceWith(x.firstElementChild); }
      var hs = root.querySelector('.hstats a.hs[href="#coach"]'); if (hs) { var st = wkStats(weekStart(today())); var y = document.createElement('div'); y.innerHTML = '<a href="#week" class="hs"><div class="hs-ovr">' + st.done + '<small>/' + st.n + '</small></div><span>This week</span><em>sessions done</em></a>'; hs.replaceWith(y.firstElementChild); }
      root.querySelectorAll('.daywin').forEach(function (s) { s.remove(); });
      var yw = wkSection(root, 'Your week'), mini = document.createElement('div'); mini.innerHTML = wkMiniHTML();
      if (yw) yw.replaceWith(mini.firstElementChild); else { var hero = root.querySelector('.home-hero2'); var q = root.querySelector('.quick'); var anchor = q || hero; if (anchor) anchor.after(mini.firstElementChild); }
      wkScrub(root);
    });
  };
  var _prog = viewProgram;
  viewProgram = function () { return wkDom(_prog(), function (root) {
    var s = wkSection(root, 'Daily windows'); if (s) s.remove();
    var mw = wkSection(root, 'My week'); if (mw) { var x = document.createElement('div'); x.innerHTML = '<a class="build-banner" href="#week" style="margin-top:14px"><span class="bb-ic">' + ic('calendar-days', 26) + '</span><span class="grow"><b>My Week</b><small>Drag your workout types onto days. Each block has a start button.</small></span>' + ic('arrow-right', 20) + '</a>'; mw.replaceWith(x.firstElementChild); }
    root.querySelectorAll('[data-a="coach-build"],.loadm').forEach(function (e) { e.remove(); });
    root.querySelectorAll('[data-c="coach-pick"]').forEach(function (e) { (e.closest('label') || e).remove(); });
    var yw = wkSection(root, 'Your workouts'); if (yw) { var sub = yw.querySelector('.phead .sub'); if (sub) sub.textContent = 'Your saved workouts show up in My Week under “Yours”, so you can drop them on any day.'; }
    wkScrub(root); }); };
  var _shots2 = viewShots; viewShots = function () { return wkDom(_shots2(), wkScrub); };
  var _vb = viewBuilder;
  viewBuilder = function () { return wkDom(_vb(), function (root) { root.querySelectorAll('[data-a="b-opt"][data-k="focus"][data-v="coach"]').forEach(function (e) { e.remove(); }); }); };
  var o = bState().opts; if (o.focus && o.focus.indexOf('coach') >= 0) { o.focus = o.focus.filter(function (f) { return f !== 'coach'; }); if (!o.focus.length) o.focus = ['Shooting']; }
  var _more = viewMore;
  viewMore = function () { return _more().replace('<a href="#coach"><span>' + ic('target', 22) + '</span><b>Coach</b><small>Ratings, focus and weekly plan</small></a>', '<a href="#week"><span>' + ic('calendar-days', 22) + '</span><b>My Week</b><small>Plan your days, start each session</small></a>'); };
  var sc = $('.side a[data-r="coach"]'); if (sc) { sc.setAttribute('href', '#week'); sc.dataset.r = 'week'; sc.innerHTML = '<i>' + ic('calendar-days', 20) + '</i>My Week'; }
  var tb = $('.tabbar a[data-tab="coach"]'); if (tb) { tb.setAttribute('href', '#week'); tb.innerHTML = '<span class="ic"></span><i>' + ic('calendar-days', 22) + '</i>Week'; }
  if ((location.hash || '').replace('#', '') === 'coach-setup') location.hash = '#week';
  render();
})();
