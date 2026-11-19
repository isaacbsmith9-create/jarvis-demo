// ===================== COURTSIDE LOOK: Home structure =====================
// Visual only: nothing is removed. Home gets a scoreboard header (readiness, training, protein, sleep, streak),
// jump chips, and section labels that group the cards (Today / Numbers / Progress) in whatever order you chose.
const LOOK_GROUPS = {
  today: ['command', 'upnext', 'today', 'status', 'mind', 'checklist', 'rec', 'fuel', 'calendar', 'school'],
  numbers: ['charts', 'radar', 'heat', 'mix', 'compare', 'load', 'score', 'preview', 'week'],
  progress: ['timeline', 'goals', 'prs', 'ach'],
};
const LOOK_LABEL = { today: ['Today', 'what needs you now'], numbers: ['Numbers', 'charts and trends'], progress: ['Progress', 'records, goals and milestones'] };
const groupOf = (k) => Object.keys(LOOK_GROUPS).find((g) => LOOK_GROUPS[g].includes(k)) || 'today';
function lookScore() {
  const t = todayIso(), rd = readiness(t)?.score ?? null, tr = trainingOf(t), tt = totalsOf(t), tg = targets(t), sl = recoveryInputs(t).sleepH, st = streaks();
  const act = lastNDays(28).filter(isActive), typ = act.length ? Math.round(mean(act.map((d) => trainingOf(d).mins))) : 60;
  const cell = (label, v, max, color, center, sub) => `<div class="sb-cell">${ring(v ?? 0, max, { size: 58, stroke: 6, color: v == null ? 'var(--oth)' : color, center: `<b class="sb-n">${center}</b>` })}<span class="sb-l">${label}</span><span class="sb-s">${sub}</span></div>`;
  return `<div class="sb" aria-label="Today at a glance">
    ${cell('Readiness', rd, 100, rd == null ? 'var(--oth)' : rd >= 65 ? 'var(--good)' : rd >= 45 ? 'var(--warn)' : 'var(--danger)', rd ?? '—', rd == null ? 'check in' : rd >= 65 ? 'ready' : rd >= 45 ? 'steady' : 'go light')}
    ${cell('Training', tr.mins || null, typ, 'var(--accent)', tr.mins ? tr.mins : '0', tr.mins ? `of ~${typ} min` : 'none yet')}
    ${cell('Protein', hasFood(t) ? tt.protein : null, tg.protein, 'var(--protein)', hasFood(t) ? Math.round((tt.protein / (tg.protein || 1)) * 100) + '%' : '—', hasFood(t) ? `${Math.round(tt.protein)} / ${tg.protein} g` : 'log meals')}
    ${cell('Sleep', sl, 8, '#8b5cff', sl ?? '—', sl == null ? 'not logged' : sl >= 8 ? 'h · on target' : 'h · under 8')}
  </div>
  <div class="sb-streak" aria-label="Training streak">
    <span class="sb-fire" aria-hidden="true">${ICONS.bolt}</span>
    <div class="sb-st"><b class="sb-big">${st.current}</b><span>day streak<br><small>best ${st.longest}</small></span></div>
    <div class="sb-days" title="Last 14 days">${lastNDays(14).map((d) => `<i class="${isActive(d) ? 'on' : ''}${d === t ? ' now' : ''}" title="${d}"></i>`).join('')}</div>
  </div>`;
}
{
  const base = RENDER.home;
  RENDER.home = (el) => {
    base(el);
    const hero = $('.hero', el);
    if (hero) {
      hero.classList.add('look-hero');
      try { $('.d2-mode', hero)?.insertAdjacentHTML('beforebegin', lookScore()); } catch (e) { console.error(e); }
    }
    // Section labels between card groups, in the user's own order
    const grid = $('.widgets', el); if (!grid) return;
    let last = null; const seen = [];
    for (const s of [...grid.querySelectorAll(':scope > [data-widget]')]) {
      const g = groupOf(s.dataset.widget); s.dataset.group = g;
      if (g !== last && !seen.includes(g)) { const [h, sub] = LOOK_LABEL[g]; s.insertAdjacentHTML('beforebegin', `<div class="sec-label span2" id="sec-${g}"><h2>${h}</h2><span>${sub}</span></div>`); seen.push(g); }
      last = g;
    }
    if (hero && seen.length > 1) $('.sb-streak', hero)?.insertAdjacentHTML('afterend', `<nav class="jump" aria-label="Jump to section">${seen.map((g) => `<button type="button" data-jump="sec-${g}">${LOOK_LABEL[g][0]}</button>`).join('')}</nav>`);
  };
}
document.addEventListener('click', (e) => { const j = e.target.closest('[data-jump]'); if (j) document.getElementById(j.dataset.jump)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
