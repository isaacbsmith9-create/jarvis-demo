/* ==================== Spot Map: your workout flow ====================
   Whatever spots you tap, the session runs in your order:
   floaters → mid catch & shoot → one-dribble pulls → contested mid → C&S 3s + relocations
   → tough mid off the dribble → finisher (hardest off the catch) → off-the-dribble 3s → free throws. */
var FLOW_PHASES = ['', 'Floaters', 'Mid-range catch & shoot', 'One-dribble pull-ups', 'Contested mid-range', 'Catch & shoot 3s + relocations', 'Tough mid-range off the dribble', 'Finisher: hardest off the catch', 'Off-the-dribble 3s', 'Free throws'];
var FLOW_HARD_CATCH = ['pindown', 'flare', 'trans-catch', 'dho', 'pop', 'curl', 'closeout'];
function flowPhase(zone, t) {
  var x = SHOT_LIB[t] || {}, fam = x.fam, w = shotWhere(zone);
  if (w === 'ft' || t === 'ft' || t === 'tired-ft') return 9;
  if (fam === 'touch' || t === 'float-drop' || w === 'float' || w === 'rim') return 1;
  if (w === 'mid') {
    if (t === 'contested-mid' || t === 'closeout') return 4;
    if (t === 'catch' || t === 'cut' || t === 'reloc') return 2;
    if (t === 'move' || t === 'one-dribble') return 3;
    if (FLOW_HARD_CATCH.indexOf(t) >= 0 || fam === 'catch') return 7;
    return 6;
  }
  if (w === '3') {
    if (t === 'catch' || t === 'reloc') return 5;
    if (FLOW_HARD_CATCH.indexOf(t) >= 0 || fam === 'catch') return 7;
    return 8;
  }
  return 6;
}
function flowSort(steps) { return steps.map(function (s, i) { return [s, i]; }).sort(function (a, b) { return flowPhase(a[0][0], a[0][1]) - flowPhase(b[0][0], b[0][1]) || a[1] - b[1]; }).map(function (x) { return x[0]; }); }
function flowOn() { return spState().order !== 'spot'; }
(function () {
  var _sps = spSteps;
  spSteps = function (plan) { var st = _sps(plan); return flowOn() ? flowSort(st) : st; };
  /* saved routines started from Shot Lab run in the same order */
  var _start = ACT['shot-start'];
  ACT['shot-start'] = function (el) { _start(el); var r = S.shotRun; if (r && String(r.preset).indexOf('sp-') === 0 && flowOn() && r.steps.length) { r.steps = flowSort(r.steps); r.idx = 0; save(); render(); } };
  ACT['sp-order'] = function (el) { spState().order = el.dataset.v; save(); render(); };
  /* step list grouped by phase, with an order switch */
  var _vs = viewSpots;
  viewSpots = function () {
    return wkDom(_vs(), function (root) {
      var list = root.querySelector('.sp-list'); if (!list) return;
      var steps = spSteps(spState().plan), on = flowOn(), html = '', last = -1;
      steps.forEach(function (s, i) { var ph = flowPhase(s[0], s[1]); if (on && ph !== last) { html += '<div class="flow-h"><span>' + ph + '</span>' + esc(FLOW_PHASES[ph]) + '</div>'; last = ph; } html += '<button class="sp-li" data-a="sp-spot" data-id="' + s[4] + '"><span>' + esc(s[3]) + '</span><em>' + s[2] + ' ' + esc(SP_SHORT[s[1]] || s[1]) + '</em></button>'; });
      list.innerHTML = html; list.classList.toggle('flow', on);
      var sw = document.createElement('div'); sw.className = 'flow-sw';
      sw.innerHTML = '<span class="tiny muted">Order</span><div class="seg sm"><button class="' + (on ? 'on' : '') + '" data-a="sp-order" data-v="flow">My workout flow</button><button class="' + (on ? '' : 'on') + '" data-a="sp-order" data-v="spot">By spot</button></div>';
      list.parentNode.insertBefore(sw, list);
    });
  };
  /* tracker: show which phase you're in */
  var _tr = shotTracker;
  shotTracker = function (r) { var h = _tr(r), st = r.steps[r.idx]; if (!st || !flowOn()) return h; var ph = flowPhase(st[0], st[1]); return h.replace('<div class="kick">Spot ' + (r.idx + 1) + ' of ' + r.steps.length + '</div>', '<div class="kick">Spot ' + (r.idx + 1) + ' of ' + r.steps.length + ' · ' + esc(FLOW_PHASES[ph]) + '</div>'); };
  render();
})();
