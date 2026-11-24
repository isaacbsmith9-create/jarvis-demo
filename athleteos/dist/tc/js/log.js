/* ==================== Log a workout you already did ====================
   For sessions outside the app: rows of shots (type + spot + shots, makes optional),
   date, minutes, feel, notes. With makes: counts in your % and shot chart.
   Without makes: counts as volume only, so your % stays honest. */
var LOG_QUICK = [
  ['Catch & shoot 3s', 'catch', 'Wing 3'], ['Mid catch & shoot', 'catch', 'Midrange'], ['Pull-ups', 'move', 'Midrange'], ['Off-the-dribble 3s', 'move', 'Wing 3'],
  ['Floaters', 'float', 'Floater'], ['Ball-screen pull-ups', 'pnr-pull', 'Midrange'], ['Finishes', 'layup', 'Rim'], ['Free throws', 'ft', 'Free throw'], ['Mixed shots', 'catch', ''],
];
var LOG_ZONES = [['', 'Mixed spots'], ['Corner 3', 'Corner 3'], ['Wing 3', 'Wing 3'], ['Top 3', 'Top 3'], ['Midrange', 'Mid-range'], ['Floater', 'Floaters'], ['Rim', 'At the rim'], ['Free throw', 'Free throws']];
function logDraft() {
  if (!UI.logDraft) UI.logDraft = { date: today(), mins: 45, rpe: 5, notes: '', rows: [], markWeek: true };
  return UI.logDraft;
}
function logShotsWeek() {
  var ws = weekStart(today()), n = 0;
  S.sessions.forEach(function (s) { if (s.date < ws) return; s.items.forEach(function (i) { if (String(i.drillId).indexOf('shot-') !== 0 && i.metric !== 'makes') return; if (i.metric === 'makes') i.sets.forEach(function (x) { n += x.att || 0; }); else n += i.reps || 0; }); });
  return n;
}
function logWeekBlock() {
  var t = today(), d = wkDays(weekStart(t)), di = Math.round((keyDate(t) - keyDate(weekStart(t))) / 864e5);
  return (d[di] || []).filter(function (b) { var x = wtInfo(b.k); return !b.done && (x.g === 'Shooting' || x.spot || b.k === 'rhythm' || x.routine); })[0] || null;
}
function viewLog() {
  var d = logDraft(), tot = sum(d.rows, function (r) { return +r.shots || 0; }), wb = d.date === today() ? logWeekBlock() : null;
  var typeOpts = Object.keys(SHOT_LIB).map(function (k) { return [k, SHOT_LIB[k].n]; });
  return pageHead('Shot Lab', 'Log a workout', '<span class="tag">' + logShotsWeek() + ' shots this week</span>') +
    '<section class="panel"><p class="small ink2" style="margin:0 0 12px">Did a workout that wasn’t in the app? Log it here. Enter makes if you counted them (they go into your shooting %). Leave makes blank and the shots still count as volume.</p>' +
    '<div class="grid g3"><div class="fld"><label class="f" for="lg-date">Date</label><input type="date" id="lg-date" value="' + esc(d.date) + '" max="' + today() + '" data-c="lg" data-k="date"></div>' +
    '<div class="fld"><label class="f" for="lg-min">Minutes</label><input type="number" id="lg-min" min="5" max="300" value="' + d.mins + '" data-c="lg" data-k="mins"></div>' +
    '<div class="fld"><label class="f" for="lg-rpe">How hard (1–10)</label><input type="number" id="lg-rpe" min="1" max="10" value="' + d.rpe + '" data-c="lg" data-k="rpe"></div></div></section>' +
    '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>What you shot</h3><div class="sub">Tap to add a row, then put in your numbers</div></div></div>' +
    '<div class="chips">' + LOG_QUICK.map(function (q, i) { return '<button class="chip" data-a="lg-quick" data-i="' + i + '">' + ic('plus', 13) + ' ' + esc(q[0]) + '</button>'; }).join('') + '</div>' +
    (d.rows.length ? '<div class="lg-rows">' + d.rows.map(function (r, i) {
      return '<div class="lg-row"><div class="lg-top"><b>' + esc(r.label) + '</b><button class="wk-ib" data-a="lg-rm" data-i="' + i + '" aria-label="Remove">' + ic('x', 13) + '</button></div>' +
        '<div class="lg-fields"><label class="wr-num"><span>Shots</span><input type="number" min="0" max="2000" value="' + (r.shots || '') + '" data-c="lg-row" data-i="' + i + '" data-k="shots" placeholder="250"></label>' +
        '<label class="wr-num"><span>Makes (optional)</span><input type="number" min="0" max="2000" value="' + (r.made === '' || r.made == null ? '' : r.made) + '" data-c="lg-row" data-i="' + i + '" data-k="made" placeholder="—"></label>' +
        '<label class="lg-sel"><span>Shot</span><select data-c="lg-row" data-i="' + i + '" data-k="type">' + typeOpts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === r.type ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="lg-sel"><span>Where</span><select data-c="lg-row" data-i="' + i + '" data-k="zone">' + LOG_ZONES.map(function (z) { return '<option value="' + z[0] + '"' + (z[0] === (r.zone || '') ? ' selected' : '') + '>' + z[1] + '</option>'; }).join('') + '</select></label></div>' +
        (r.made !== '' && r.made != null && +r.shots ? '<div class="tiny" style="margin-top:4px">' + Math.round(+r.made / +r.shots * 100) + '% · counts in your shooting stats</div>' : '<div class="tiny" style="margin-top:4px">No makes entered · counts as volume only</div>') + '</div>';
    }).join('') + '</div>' : '<div class="empty" style="margin-top:12px"><b>Nothing added yet</b>Tap “Catch & shoot 3s” or “Mixed shots” above, then enter 250.</div>') + '</section>' +
    '<section class="panel" style="margin-top:14px"><div class="fld"><label class="f" for="lg-notes">Notes (optional)</label><textarea id="lg-notes" data-c="lg" data-k="notes" rows="2" placeholder="e.g. simple catch and shoot, felt good, legs tired at the end">' + esc(d.notes) + '</textarea></div>' +
    (wb ? '<label class="check" style="margin-top:10px"><input type="checkbox" data-c="lg" data-k="markWeek"' + (d.markWeek ? ' checked' : '') + '> Mark “' + esc(wtInfo(wb.k).n) + '” done in My Week</label>' : '') +
    '<div class="btns" style="margin-top:12px"><button class="btn p" data-a="lg-save"' + (tot ? '' : ' disabled') + '>' + ic('check', 16) + ' Save' + (tot ? ' · ' + tot + ' shots' : '') + '</button>' + (d.rows.length ? '<button class="btn g" data-a="lg-clear">Clear</button>' : '') + '</div></section>';
}
ACT['lg-quick'] = function (el) { var q = LOG_QUICK[+el.dataset.i]; logDraft().rows.push({ label: q[0], type: q[1], zone: q[2], shots: '', made: '' }); render(); setTimeout(function () { var ins = $$('.lg-row input[data-k="shots"]'); if (ins.length) ins[ins.length - 1].focus(); }, 30); };
ACT['lg-rm'] = function (el) { logDraft().rows.splice(+el.dataset.i, 1); render(); };
ACT['lg-clear'] = function () { UI.logDraft = null; render(); };
CHG['lg'] = function (el) { var d = logDraft(), k = el.dataset.k; if (k === 'markWeek') d.markWeek = el.checked; else if (k === 'mins' || k === 'rpe') d[k] = Math.max(k === 'rpe' ? 1 : 1, Math.min(k === 'rpe' ? 10 : 300, Math.round(+el.value || 0))); else if (k === 'date') { if (/^\d{4}-\d\d-\d\d$/.test(el.value) && el.value <= today()) d.date = el.value; } else d[k] = el.value; render(); };
CHG['lg-row'] = function (el) {
  var r = logDraft().rows[+el.dataset.i], k = el.dataset.k; if (!r) return;
  if (k === 'shots' || k === 'made') { var v = el.value === '' ? '' : Math.max(0, Math.min(2000, Math.round(+el.value))); r[k] = v; if (k === 'made' && v !== '' && +r.shots && v > +r.shots) { r.made = +r.shots; toast('Makes can’t be more than shots', 'warn'); } }
  else { r[k] = el.value; if (k === 'type' && SHOT_LIB[el.value]) r.label = SHOT_LIB[el.value].n; }
  render();
};
ACT['lg-save'] = function () {
  var d = logDraft(), rows = d.rows.filter(function (r) { return +r.shots > 0; }); if (!rows.length) { toast('Enter how many shots', 'warn'); return; }
  var end = d.date === today() ? Date.now() : keyDate(d.date).getTime() + 18 * 3600e3;
  var items = rows.map(function (r) {
    var x = SHOT_LIB[r.type] || {}, cat = x.fam === 'touch' ? 'Finishing' : 'Shooting', counted = r.made !== '' && r.made != null;
    return counted ? { drillId: 'shot-' + r.type, name: r.label, category: cat, metric: 'makes', sets: [{ att: +r.shots, made: +r.made, zone: r.zone || null, type: r.type }], status: 'done', reps: 0, goodReps: 0, seconds: 0 }
      : { drillId: 'shot-' + r.type, name: r.label + ' (no makes counted)', category: cat, metric: 'reps', sets: [], status: 'done', reps: +r.shots, goodReps: 0, seconds: 0 };
  });
  var tot = sum(rows, function (r) { return +r.shots; });
  var session = { id: 's-' + uid(), date: d.date, endedAt: end, startedAt: end - d.mins * 60000, minutes: d.mins, workoutId: null, workoutName: 'Logged: ' + (rows.length === 1 ? rows[0].label : 'Shooting') + ' · ' + tot + ' shots', shotlab: rows.some(function (r) { return r.made !== '' && r.made != null; }), logged: true, items: items, completionPct: 100, rpe: d.rpe, planId: null, notes: d.notes, location: '' };
  if (typeof WK !== 'undefined') WK.active = null; if (typeof PG !== 'undefined') PG.active = null;
  commitSession(session);
  var wb = d.date === today() && d.markWeek ? logWeekBlock() : null; if (wb) { wb.done = true; session.weekLinked = true; } else logLinkWeek(session);
  UI.logDraft = null; save(); location.hash = '#shots'; render(); toast('Logged ' + tot + ' shots' + (wb ? ' and checked off ' + wtInfo(wb.k).n : '') + '. Nice work.');
};
/* ---------- logged workouts show up in the hub ---------- */
function logLinkWeek(s) {
  if (s.weekLinked) return false; var ws = weekStart(s.date), di = Math.round((keyDate(s.date) - keyDate(ws)) / 864e5), d = wkDays(ws, true);
  if (!d[di]) return false; d[di].push({ id: uid(), k: 'log:' + s.id, mins: s.minutes || 0, done: true }); s.weekLinked = true; return true;
}
function logBackfill() { var ch = false; S.sessions.forEach(function (s) { if (s.logged && !s.weekLinked && logLinkWeek(s)) ch = true; }); if (ch) save(); }
/* every shot you took in a range: counted makes + logged volume */
function shotVolume(from, to) {
  var att = 0, made = 0, vol = 0, n = 0;
  S.sessions.forEach(function (s) { if (s.date < from || s.date > to) return; var had = false;
    s.items.forEach(function (i) { var shot = String(i.drillId).indexOf('shot-') === 0; if (i.metric === 'makes') i.sets.forEach(function (x) { att += x.att || 0; made += x.made || 0; had = true; }); else if (shot) { vol += i.reps || 0; had = true; } });
    if (had) n++; });
  return { all: att + vol, att: att, made: made, vol: vol, n: n };
}
(function () {
  var _wi = wtInfo;
  wtInfo = function (k) { if (k.indexOf('log:') !== 0) return _wi(k); var s = S.sessions.find(function (x) { return x.id === k.slice(4); }); if (!s) return { n: 'Logged workout', g: 'Shooting', c: '#55c98b', ic: 'notebook-pen', m: 0, gone: 1 }; return { n: s.workoutName.replace(/^Logged: /, ''), g: 'Shooting', c: '#55c98b', ic: 'notebook-pen', m: s.minutes || 0, href: '#session-' + s.id, sub: 'Logged workout' }; };
  var _mw = viewMyWeek; viewMyWeek = function () { logBackfill(); return _mw(); };
  var _hp = viewHomePro;
  viewHomePro = function () { logBackfill(); return wkDom(_hp(), function (root) {
    var t = today(), v = shotVolume(addDays(t, -6), t), hs = root.querySelector('.hstats a.hs[href="#shots"]'); if (!hs || !v.all) return;
    hs.innerHTML = '<b class="num">' + v.all + '</b><span>shots, 7 days</span><em>' + (v.att ? Math.round(v.made / v.att * 100) + '% on ' + v.att + ' counted' : 'no makes counted') + '</em>';
  }); };
  var _vs = viewShots;
  viewShots = function () { var h = _vs(); if (shotRun()) return h; var t = today(), w = shotVolume(addDays(t, -6), t), mth = shotVolume(addDays(t, -29), t);
    var logs = S.sessions.filter(function (s) { return s.logged; }).slice(-5).reverse();
    if (!mth.all) return h;
    var panel = '<section class="panel lg-vol"><div class="phead"><div><h3>Your shot volume</h3><div class="sub">Every shot: tracked in the app and logged workouts</div></div><a class="btn sm" href="#log">' + ic('plus', 14) + ' Log a workout</a></div>' +
      '<div class="grid g3">' + kpi(w.all, 'Shots, 7 days', '', w.vol ? w.vol + ' logged without makes' : '') + kpi(mth.all, 'Shots, 30 days', '', mth.n + ' session' + (mth.n === 1 ? '' : 's')) + kpi(mth.att ? fmtPct(pct(mth.made, mth.att)) : '–', 'Make % (counted shots)', '', mth.att ? mth.made + ' of ' + mth.att : 'enter makes to see this') + '</div>' +
      (logs.length ? '<div class="list" style="margin-top:12px">' + logs.map(function (s) { var tot = sum(s.items, function (i) { return i.metric === 'makes' ? sum(i.sets, function (x) { return x.att || 0; }) : (i.reps || 0); }); return '<a class="tapwrap" href="#session-' + s.id + '"><div class="main"><b class="nm">' + esc(s.workoutName.replace(/^Logged: /, '')) + '</b><div class="tiny">' + esc(fmtDay(s.date)) + ' · ' + (s.minutes || 0) + ' min · logged</div></div><span class="num small">' + tot + ' shots</span></a>'; }).join('') + '</div>' : '') + '</section>';
    h = h.replace(/<div class="empty" style="margin-top:6px"><b>No shots tracked[\s\S]*?<\/div>/, '<div class="empty" style="margin-top:6px"><b>No makes counted in this range</b>Your logged shots are in “Your shot volume” above. Enter makes next time (or track in Shot Lab) to see your % and shot chart.</div>');
    var i = h.indexOf('<div class="row" style="margin:18px 0 10px">'); return i > 0 ? h.slice(0, i) + panel + h.slice(i) : h + panel; };
  var _rv = routeView; routeView = function (r) { if (r === 'log') return viewLog(); return _rv(r); };
  Object.assign(TAB_OF, { log: 'shots' });
  var _shots = viewShots; viewShots = function () { var h = _shots(); if (shotRun()) return h; return h.replace('<div class="presets">', '<div class="presets"><a class="preset sp-preset" href="#log"><b>' + ic('notebook-pen', 16) + ' Log a workout</b><span>Shot somewhere outside the app? Log what you did</span><em>Log it ' + ic('arrow-right', 14) + '</em></a>'); };
  var _home = viewHomePro; viewHomePro = function () { return _home().replace('<div class="quick">', '<div class="quick"><a class="qt" href="#log"><span>' + ic('notebook-pen', 22) + '</span><b>Log</b><small>A workout you did</small></a>'); };
  var _train = viewTrain; viewTrain = function () { return _train().replace('<div class="sp-tgrid">', '<div class="sp-tgrid"><a class="sp-tc" href="#log"><span class="sp-ti" style="--mc:#55c98b;background:#55c98b">' + ic('notebook-pen', 20) + '</span><b>Log a workout</b><small>Already trained? Log shots, makes and minutes</small></a>'); };
  render();
})();
