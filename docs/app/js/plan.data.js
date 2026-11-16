// Weekboard (wb:) and Gameplan (gp:) data, same shapes as the original apps.
import { rd, mut, keys } from './store.js';
import { todayIso, shiftIso, mondayOf, weekdayNum, toMin, toHHMM, uid, isoDate, nowMin, clamp } from './util.js';

// ===================== Weekboard =====================
export const WB_TYPES = {
  homework: { label: 'Homework', color: 'var(--c-homework)' }, study: { label: 'Study', color: 'var(--c-study)' },
  practice: { label: 'Practice', color: 'var(--c-practice)' }, game: { label: 'Game', color: 'var(--c-game)' },
  lift: { label: 'Lift', color: 'var(--c-lift)' }, work: { label: 'Work', color: 'var(--c-work)' },
  personal: { label: 'Personal', color: 'var(--c-personal)' }, other: { label: 'Other', color: 'var(--c-other)' },
};
const WB_CORE = () => ({ settings: { school: '15:15', bed: '22:30', wkstart: '09:00', max: 120 }, rules: [], tray: [] });
export const wbCore = () => { const c = rd('wb:core') || WB_CORE(); c.rules ||= []; c.tray ||= []; c.settings = { ...WB_CORE().settings, ...(c.settings || {}) }; return c; };
export const saveWbCore = (fn) => mut('wb:core', (c) => { c.rules ||= []; c.tray ||= []; c.settings ||= WB_CORE().settings; fn(c); }, WB_CORE);
export const wbWeek = (mon) => rd('wb:w-' + mon) || { items: [], done: {}, skip: {} };
export const saveWbWeek = (mon, fn) => mut('wb:w-' + mon, (w) => { w.items ||= []; w.done ||= {}; w.skip ||= {}; fn(w); }, () => ({ items: [], done: {}, skip: {} }));

export function itemsOn(date) {
  const w = wbWeek(mondayOf(date)), wd = weekdayNum(date);
  const reps = wbCore().rules.filter((r) => (r.days || []).includes(wd) && !w.skip?.[`${r.id}|${date}`])
    .map((r) => ({ id: `${r.id}|${date}`, rule: r.id, title: r.title, type: r.type, date, start: r.start, mins: Number(r.mins) || 60, done: !!w.done?.[`${r.id}|${date}`] }));
  const own = (w.items || []).filter((i) => i.date === date).map((i) => ({ ...i, mins: Number(i.mins) || 60 }));
  return [...reps, ...own].sort((a, b) => (a.start == null) - (b.start == null) || (a.start ? toMin(a.start) - toMin(b.start) : 0) || String(a.title).localeCompare(b.title));
}
export function conflicts(list) {
  const timed = list.filter((i) => i.start), bad = new Set();
  for (let a = 0; a < timed.length; a++) for (let b = a + 1; b < timed.length; b++) {
    const A = timed[a], B = timed[b], as = toMin(A.start), bs = toMin(B.start);
    if (as < bs + B.mins && bs < as + A.mins) { bad.add(A.id); bad.add(B.id); }
  }
  return bad;
}
export function toggleWb(id, date) {
  const mon = mondayOf(date);
  if (id.includes('|')) saveWbWeek(mon, (w) => { w.done[id] = !w.done[id]; if (!w.done[id]) delete w.done[id]; });
  else saveWbWeek(mon, (w) => { const it = w.items.find((x) => x.id === id); if (it) it.done = !it.done; });
}
export function addWbItem(it) { saveWbWeek(mondayOf(it.date), (w) => { w.items.push({ id: uid(), done: false, ...it }); }); }
export function findWbItem(id, date) {
  if (id.includes('|')) { const [rid] = id.split('|'); const r = wbCore().rules.find((x) => x.id === rid); return r ? { kind: 'rep', rule: r, date } : null; }
  const t = wbCore().tray.find((x) => x.id === id); if (t) return { kind: 'tray', item: t };
  for (const k of keys().filter((k) => k.startsWith('wb:w-'))) { const it = rd(k)?.items?.find((x) => x.id === id); if (it) return { kind: 'item', item: it, mon: k.slice(5) }; }
  return null;
}
export function updateWbItem(id, patch) {
  const f = findWbItem(id); if (!f) return;
  if (f.kind === 'tray') return saveWbCore((c) => { Object.assign(c.tray.find((x) => x.id === id), patch); });
  if (f.kind !== 'item') return;
  const newDate = patch.date || f.item.date;
  if (mondayOf(newDate) !== f.mon) { saveWbWeek(f.mon, (w) => { w.items = w.items.filter((x) => x.id !== id); }); saveWbWeek(mondayOf(newDate), (w) => { w.items.push({ ...f.item, ...patch }); }); }
  else saveWbWeek(f.mon, (w) => { Object.assign(w.items.find((x) => x.id === id), patch); });
}
export function removeWbItem(id, date) {
  if (id.includes('|')) return saveWbWeek(mondayOf(date), (w) => { w.skip[id] = true; });
  const f = findWbItem(id); if (!f) return;
  if (f.kind === 'tray') saveWbCore((c) => { c.tray = c.tray.filter((x) => x.id !== id); });
  else saveWbWeek(f.mon, (w) => { w.items = w.items.filter((x) => x.id !== id); });
}
/** Greedy homework fitter from Weekboard: earliest due first, into the earliest free gap before it's due, within daily windows and cap. */
export function autoFit(fromMon) {
  const st = wbCore().settings, tray = wbCore().tray.filter((t) => t.mins > 0);
  if (!tray.length) return { placed: 0, stuck: 0 };
  const startDay = todayIso() > fromMon ? todayIso() : fromMon, horizon = Array.from({ length: 14 }, (_, i) => shiftIso(startDay, i));
  const busy = {}, hw = {};
  const blocksFor = (d) => busy[d] ??= itemsOn(d).filter((i) => i.start).map((i) => [toMin(i.start), toMin(i.start) + i.mins + (['practice', 'game', 'lift'].includes(i.type) ? 15 : 5)]);
  const hwFor = (d) => hw[d] ??= itemsOn(d).filter((i) => ['homework', 'study'].includes(i.type)).reduce((a, i) => a + i.mins, 0);
  const placed = [], stuck = [];
  for (const t of tray.slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.mins - a.mins)) {
    let done = false;
    for (const d of horizon) {
      if (t.due && d >= t.due) break;
      let open = weekdayNum(d) >= 5 ? toMin(st.wkstart) : toMin(st.school) + 15; const close = toMin(st.bed) - 30;
      if (d === todayIso()) open = Math.max(open, Math.ceil((nowMin() + 10) / 15) * 15);
      if (hwFor(d) + t.mins > Number(st.max)) continue;
      let cursor = open;
      for (const [s, e] of [...blocksFor(d).slice().sort((a, b) => a[0] - b[0]), [close, close]]) {
        const start = Math.ceil(cursor / 15) * 15;
        if (start + t.mins <= Math.min(s, close)) {
          addWbItemRaw({ id: t.id, title: t.title, type: t.type, date: d, start: toHHMM(start), mins: t.mins, due: t.due || null, done: false });
          blocksFor(d).push([start, start + t.mins + 5]); hw[d] = hwFor(d) + t.mins; placed.push(t); done = true; break;
        }
        cursor = Math.max(cursor, e);
      }
      if (done) break;
    }
    if (!done) stuck.push(t);
  }
  saveWbCore((c) => { c.tray = c.tray.filter((t) => !placed.some((p) => p.id === t.id)); });
  return { placed: placed.length, stuck: stuck.length };
}
function addWbItemRaw(it) { saveWbWeek(mondayOf(it.date), (w) => { w.items.push(it); }); }

// ===================== Gameplan =====================
export const QUADS = [
  { id: 'do', u: true, i: true, name: 'Do now', sub: 'Urgent + important', c: 'var(--bad)' },
  { id: 'plan', u: false, i: true, name: 'Schedule', sub: 'Important, not urgent', c: 'var(--accent)' },
  { id: 'quick', u: true, i: false, name: 'Quick hits', sub: 'Urgent, not important', c: 'var(--warn)' },
  { id: 'drop', u: false, i: false, name: 'Drop it', sub: 'Neither', c: 'var(--muted)' },
];
export const quadOf = (t) => QUADS.find((q) => q.u === !!t.u && q.i === !!t.i);
export const CATS = [
  { id: 'school', name: 'School', c: 'var(--c-school)' }, { id: 'homework', name: 'Homework', c: 'var(--c-homework)' }, { id: 'practice', name: 'Practice', c: 'var(--c-practice)' },
  { id: 'training', name: 'Training', c: 'var(--c-lift)' }, { id: 'work', name: 'Work', c: 'var(--c-work)' }, { id: 'gaming', name: 'Gaming', c: 'var(--c-game)' },
  { id: 'phone', name: 'Phone / social', c: 'var(--c-phone)' }, { id: 'people', name: 'Family / friends', c: 'var(--c-people)' }, { id: 'other', name: 'Other', c: 'var(--c-other)' },
];
export const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];
export const BTYPES = [{ id: 'train', name: 'Train' }, { id: 'school', name: 'School' }, { id: 'focus', name: 'Focus' }, { id: 'life', name: 'Life' }];
const DEFAULT_STEPS = [
  { id: 'bag', label: 'Pack bag and lay out clothes' }, { id: 'plan', label: "Plan tomorrow's Top 3" }, { id: 'charge', label: 'Phone on the charger, outside the room' },
  { id: 'shower', label: 'Shower' }, { id: 'stretch', label: 'Stretch 5 min' }, { id: 'read', label: 'Read 10 min' }, { id: 'lights', label: 'Lights out' },
];
const GP_CORE = () => ({ tasks: [], routine: { steps: DEFAULT_STEPS.map((s) => ({ ...s })), bed: '22:30', wake: '06:45', wind: 45 }, running: null, settings: { phoneGoal: 120 } });
export const gpCore = () => { const c = rd('gp:core') || GP_CORE(); c.tasks ||= []; c.routine ||= GP_CORE().routine; c.settings ||= { phoneGoal: 120 }; return c; };
export const saveGpCore = (fn) => mut('gp:core', (c) => { c.tasks ||= []; c.routine ||= GP_CORE().routine; c.settings ||= { phoneGoal: 120 }; fn(c); }, GP_CORE);
export const gpDay = (iso) => rd('gp:d-' + iso);
export const saveGpDay = (iso, fn) => mut('gp:d-' + iso, (d) => { d.blocks ||= []; d.entries ||= []; d.night ||= { done: {}, completedAt: null }; d.night.done ||= {}; fn(d); }, () => ({ blocks: [], entries: [], night: { done: {}, completedAt: null } }));

export const topFor = (iso) => gpCore().tasks.filter((t) => t.top === iso);
export const nightDate = () => { const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1); return isoDate(d); };
export function nightState(iso) {
  const steps = gpCore().routine.steps || [], n = gpDay(iso)?.night?.done || {};
  return { done: steps.filter((s) => n[s.id] || (s.id === 'plan' && topFor(shiftIso(iso, 1)).length)).length, total: steps.length };
}
export function minsBy(iso) {
  const out = {}; for (const e of gpDay(iso)?.entries || []) out[e.cat] = (out[e.cat] || 0) + (Number(e.mins) || 0);
  const r = gpCore().running; if (r && isoDate(new Date(r.start)) === iso) out[r.cat] = (out[r.cat] || 0) + (Date.now() - r.start) / 60000;
  return out;
}
/** Today's agenda: Gameplan blocks plus Weekboard timed items. */
export function agenda(iso) {
  const blocks = (gpDay(iso)?.blocks || []).map((b) => ({ ...b, src: 'gp' }));
  const wb = itemsOn(iso).filter((i) => i.start).map((i) => ({ ...i, src: 'wb' }));
  return [...blocks, ...wb].sort((a, b) => toMin(a.start) - toMin(b.start));
}
export function dayScore(iso) {
  const tops = topFor(iso), topPts = tops.length ? Math.round(40 * tops.filter((t) => t.done).length / Math.max(3, tops.length)) : 0;
  const ns = nightState(iso), nightPts = ns.total ? Math.round(20 * ns.done / ns.total) : 0;
  const blocks = agenda(iso), blockPts = blocks.length ? Math.round(20 * blocks.filter((b) => b.done).length / blocks.length) : 0;
  const goal = gpCore().settings.phoneGoal || 120, phone = minsBy(iso).phone || 0;
  const phonePts = Math.round(20 * clamp(1 - (phone - goal) / goal));
  return { total: topPts + nightPts + blockPts + phonePts, topPts, nightPts, blockPts, phonePts, phone, goal, tops, blocks };
}
export function addTask(title, u, i, top = null, due = '') { const t = { id: uid(), title: title.trim(), u, i, due, done: false, top, created: Date.now() }; saveGpCore((c) => { c.tasks.push(t); }); return t; }
export function toggleTask(id) { let done = false; saveGpCore((c) => { const t = c.tasks.find((x) => x.id === id); if (!t) return; t.done = done = !t.done; t.doneAt = t.done ? Date.now() : null; }); return done; }
export function startTimer(cat) { stopTimer(); saveGpCore((c) => { c.running = { cat, start: Date.now() }; }); }
export function stopTimer() {
  const r = gpCore().running; if (!r) return null;
  const mins = Math.round((Date.now() - r.start) / 60000);
  saveGpCore((c) => { c.running = null; });
  if (mins >= 1) { const iso = isoDate(new Date(r.start)); saveGpDay(iso, (d) => { d.entries.push({ id: uid(), cat: r.cat, start: r.start, mins }); }); }
  return { cat: r.cat, mins };
}
