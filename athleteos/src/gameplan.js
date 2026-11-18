// ===================== GAMEPLAN (bundled page, same database) =====================
// Gameplan runs as gameplan.html in this artifact and saves each day as doc "gp-d-YYYY-MM-DD" ({ blocks: [{ id, title,
// start 'HH:MM', mins, type, done }] }). Athlete OS only reads those blocks; editing happens in Gameplan.
// Gameplan already shows Athlete OS calendar events on its own schedule (read-only), and never saves them as blocks.
const GP_TYPES = { school: ['School', '#64748b'], practice: ['Practice / game', '#e8590c'], train: ['Workout', '#7c3aed'], focus: ['Homework', '#d99a0b'], meal: ['Meal', '#16a34a'], work: ['Business', '#0d9488'], life: ['Life', '#db2777'], free: ['Free time', '#0ea5e9'], sleep: ['Sleep', '#475569'] };
const gpType = (t) => GP_TYPES[t] || GP_TYPES.life;
const normT = (s) => String(s || '').trim().toLowerCase();
/** Gameplan blocks for a date, sorted, minus any that repeat a calendar item (same start time and title). */
function gpBlocks(date, its = itemsOn(date)) {
  const d = doc('gp-d-' + date), list = Array.isArray(d?.blocks) ? d.blocks : [];
  return list.filter((b) => b && /^\d{1,2}:\d{2}$/.test(b.start || '') && b.title)
    .filter((b) => !its.some((x) => x.time && toMinT(x.time) === toMinT(b.start) && normT(x.title) === normT(b.title)))
    .map((b) => { const mins = Math.max(5, Number(b.mins) || 60); return { ...b, mins, st: toMinT(b.start), end: addMin(b.start, mins) }; })
    .sort((a, b) => a.st - b.st);
}
const gpState = (date, b) => { if (date !== todayIso()) return ''; const n = nowM(); return b.st <= n && n < b.st + b.mins ? 'now' : b.st + b.mins <= n ? 'past' : ''; };
function gpListHtml(date, blocks) {
  return `<div class="list">${blocks.map((b) => { const [l, c] = gpType(b.type), s = gpState(date, b);
    return `<div class="li gp-li ${s ? 'gp-' + s : ''}"><div class="row" style="flex-wrap:nowrap;min-width:0"><span class="dot" style="background:${c}"></span><div style="min-width:0"><div class="t" style="${b.done ? 'text-decoration:line-through;opacity:.6' : ''}">${s === 'now' ? '<span class="gp-tag">Now</span>' : ''}${esc(b.title)}</div><div class="s">${esc(l)} · ${fmtDur(b.mins)} · until ${fmtClock(b.end)}</div></div></div><span class="v small">${fmtClock(b.start)}</span></div>`; }).join('')}</div>`;
}
/** The Gameplan part of a day: header with the link, then the blocks. */
function gpSection(date, its) {
  const gp = gpBlocks(date, its);
  return `<div class="gp-head"><span class="tiny muted">FROM GAMEPLAN${gp.length ? ` · ${gp.length} block${gp.length > 1 ? 's' : ''}` : ''}</span><a class="chip" data-ml href="gameplan.html">${gp.length ? 'Edit in Gameplan' : 'Plan this day in Gameplan'} ›</a></div>${gp.length ? gpListHtml(date, gp) : ''}`;
}
