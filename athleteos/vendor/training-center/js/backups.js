/* ==================== Backups: see and restore saved copies (Profile) ==================== */
var BK = { list: null, loading: false };
function bkSummary(st) {
  var n = function (a) { return Array.isArray(a) ? a.length : 0; }, wk = 0;
  if (st.myweek && st.myweek.weeks) Object.keys(st.myweek.weeks).forEach(function (k) { (st.myweek.weeks[k] || []).forEach(function (d) { wk += n(d); }); });
  var parts = [[n(st.plan), 'calendar item'], [wk, 'week block'], [n(st.sessions), 'session'], [(st.workouts || []).filter(function (w) { return !w.template; }).length, 'saved workout'], [n(st.games), 'game']].filter(function (x) { return x[0]; }).map(function (x) { return x[0] + ' ' + x[1] + (x[0] === 1 ? '' : 's'); });
  return parts.length ? parts.join(' · ') : 'Empty';
}
async function bkLoad() {
  if (BK.loading) return; BK.loading = true; var out = [];
  try { var l = JSON.parse(localStorage.getItem(KEY + '-backup') || 'null'); if (l && l.state) out.push({ key: 'local', label: 'This device (before it was replaced)', at: l.at, state: l.state }); } catch (e) { /* none */ }
  if (UI.dbNs && UI.uid) {
    var tags = ['replaced-device', 'replaced-account']; for (var i = 0; i < 14; i++) tags.push('day-' + dayStamp(Date.now() - i * 864e5));
    await Promise.all(tags.map(function (t) { return UI.dbNs.doc('data/users/' + UI.uid + '/backup-' + t).get().then(function (b) { var v = snapData(b); if (v && v.state) out.push({ key: t, label: t.indexOf('day-') === 0 ? 'Daily backup' : t === 'replaced-device' ? 'Device copy that was replaced' : 'Account copy that was replaced', at: v.savedAt, state: v.state }); }).catch(function () {}); }));
  }
  out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); }); BK.list = out; BK.loading = false; if ((location.hash || '') === '#profile') render();
}
function bkHTML() {
  if (!BK.list) { setTimeout(bkLoad, 0); return '<section class="panel" style="margin-top:14px" id="bk"><div class="phead"><div><h3>Backups</h3><div class="sub">Loading your saved copies…</div></div></div></section>'; }
  return '<section class="panel" style="margin-top:14px" id="bk"><div class="phead"><div><h3>Backups</h3><div class="sub">The app keeps a daily copy in your account, plus any copy it ever replaces. Restoring one replaces what you have now (and backs that up first).</div></div><button class="btn sm g" data-a="bk-refresh">' + ic('repeat', 14) + ' Refresh</button></div>' +
    (BK.list.length ? '<div class="list">' + BK.list.map(function (b, i) { return '<div class="li"><div class="main"><b>' + esc(b.label) + '</b><div class="tiny">' + (b.at ? esc(new Date(b.at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + ' · ' : '') + esc(bkSummary(b.state)) + '</div></div><button class="btn sm" data-a="bk-restore" data-i="' + i + '"' + (stateScore(b.state) ? '' : ' disabled') + '>Restore</button></div>'; }).join('') + '</div>'
      : '<div class="empty"><b>No backups yet</b>They start being made automatically from now on.</div>') + '</section>';
}
ACT['bk-refresh'] = function () { BK.list = null; render(); };
ACT['bk-restore'] = function (el) {
  var b = BK.list && BK.list[+el.dataset.i]; if (!b) return; var k = 'bk-' + el.dataset.i;
  if (UI.armed !== k) { UI.armed = k; toast('Tap Restore again to bring back: ' + bkSummary(b.state), 'warn'); return; } UI.armed = null;
  localBackup(S); writeBackup('replaced-device', S);
  S = normalize(JSON.parse(JSON.stringify(b.state))); UI.ready = true; save(); BK.list = null; render(); toast('Restored. What you had before is saved as a backup too.');
};
(function () {
  var _vp = viewProfile; viewProfile = function () { return _vp() + bkHTML(); };
  render();
})();
