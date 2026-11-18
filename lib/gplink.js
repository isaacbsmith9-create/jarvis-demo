// ===================== Gameplan link (shared by every app on this website) =====================
// One origin on github.io means every app reads the same localStorage. Gameplan owns tasks ("gp:core".tasks) and the
// schedule ("gp:d-YYYY-MM-DD".blocks + "gp:core".repeats). Any app can:
//   GPLINK.tasks()                  open tasks with their quadrant (do | plan | quick | drop)
//   GPLINK.toggle(id)               check a task off (or back on)
//   GPLINK.add(title, quad, opts)   add a task; opts: { top: 'YYYY-MM-DD', due, from: 'App name' }
//   GPLINK.schedule(iso)            that day's blocks, repeats included, sorted
//   GPLINK.setBlocks(src, from, to, blocks)  an app keeps its own blocks on the schedule (replaced each time)
//   GPLINK.push(item)               send a block to Gameplan's inbox: { kind: 'block', title, date, start, mins, type, from }
//   GPLINK.card(el, opts)           draws the standard Gameplan card into el (opts.app names the app)
// Gameplan picks up inbox items the next time it opens and says where they came from.
const GPLINK = (() => {
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const fmt = (m) => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60); return `${h % 12 || 12}:${pad(m % 60)}${h < 12 ? 'a' : 'p'}`; };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const QUADS = { do: ['Do now', '#d9483b', true, true], plan: ['Schedule', '#2f6fdd', false, true], quick: ['Quick hits', '#d99a0b', true, false], drop: ['Drop it', '#7b8494', false, false] };
  const quadOf = (t) => (t.u && t.i ? 'do' : !t.u && t.i ? 'plan' : t.u ? 'quick' : 'drop');
  const COLORS = { school: '#64748b', practice: '#e8590c', train: '#7c3aed', focus: '#d99a0b', meal: '#16a34a', work: '#0d9488', life: '#db2777', free: '#0ea5e9', sleep: '#475569' };
  const has = () => !!rd('gp:core');
  function tasks() { return (rd('gp:core')?.tasks || []).filter((t) => !t.done).map((t) => ({ ...t, quad: quadOf(t) })); }
  function toggle(id) { const c = rd('gp:core'); const t = c?.tasks?.find((x) => x.id === id); if (!t) return false; t.done = !t.done; t.doneAt = t.done ? Date.now() : null; return wr('gp:core', c); }
  function add(title, quad = 'do', o = {}) {
    title = String(title || '').trim().slice(0, 120); if (!title) return null;
    const c = rd('gp:core') || { tasks: [], routine: { steps: [], bed: '22:30', wake: '06:45', wind: 45 }, running: null, settings: { phoneGoal: 120 } };
    const [, , u, i] = QUADS[quad] || QUADS.do;
    const t = { id: uid(), title, u, i, due: o.due || '', done: false, top: o.top || null, created: Date.now(), from: o.from || '' };
    c.tasks = [...(c.tasks || []), t]; wr('gp:core', c); return t;
  }
  function repeatsOn(date, c) { const wd = new Date(date + 'T12:00:00').getDay(); return (c?.repeats || []).filter((r) => r.days?.includes(wd) && (!r.from || date >= r.from) && !(r.skip || []).includes(date)); }
  function schedule(date = today()) {
    const c = rd('gp:core'), d = rd('gp:d-' + date) || {};
    const reps = repeatsOn(date, c).map((r) => ({ id: 'r:' + r.id, title: r.title, start: r.start, mins: r.mins, type: r.type, done: !!d.rdone?.[r.id], repeat: true }));
    return [...(d.blocks || []), ...reps].filter((b) => b.start).sort((a, b) => toMin(a.start) - toMin(b.start));
  }
  /** An app keeps its own blocks on Gameplan's schedule: replaces every block tagged `src` from `from` to `to`
   *  (inclusive) with `blocks` ([{ date, title, start, mins, type, done, link }]). Other blocks are never touched. */
  function setBlocks(src, from, to, blocks) {
    const shift = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); };
    for (let d = from; d <= to; d = shift(d, 1)) {
      const k = 'gp:d-' + d, cur = rd(k), mine = blocks.filter((b) => b.date === d);
      if (!cur && !mine.length) continue;
      const doc = cur || { blocks: [], entries: [], night: { done: {}, completedAt: null } };
      const before = JSON.stringify(doc.blocks || []);
      doc.blocks = [...(doc.blocks || []).filter((b) => b.src !== src), ...mine.map(({ date, ...b }) => ({ id: src + '-' + d + '-' + uid(), done: false, ...b, src }))];
      const strip = (arr) => JSON.stringify(arr.map(({ id, ...b }) => b));
      if (strip(JSON.parse(before)) !== strip(doc.blocks)) wr(k, doc);
    }
  }
  function push(item) { const q = rd('gp:inbox') || []; q.push({ ...item, id: uid(), at: Date.now() }); return wr('gp:inbox', q.slice(-50)); }
  function nowNext(date = today()) {
    const items = schedule(date), n = new Date(), nm = n.getHours() * 60 + n.getMinutes();
    return { now: items.find((b) => toMin(b.start) <= nm && toMin(b.start) + b.mins > nm) || null, next: items.find((b) => toMin(b.start) > nm) || null, items };
  }
  const CSS = `.gpl{display:grid;gap:8px}.gpl-h{display:flex;justify-content:space-between;align-items:center;gap:8px}.gpl-h a{font-size:13px;font-weight:700;text-decoration:none;color:inherit;opacity:.75}
.gpl-sched{display:flex;flex-direction:column;gap:4px}.gpl-b{display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 8px;border-radius:10px;background:color-mix(in srgb,var(--c) 14%,transparent);border-left:3px solid var(--c)}.gpl-b b{font-weight:700}.gpl-b span{opacity:.7;margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}
.gpl-q{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--qc);margin-top:4px}.gpl-t{display:flex;align-items:center;gap:8px;font-size:14px;padding:4px 0}.gpl-t button{width:22px;height:22px;flex:none;border-radius:7px;border:2px solid var(--qc);background:none;cursor:pointer;padding:0;color:#fff;font-size:12px;font-weight:800}.gpl-t button.on{background:var(--qc)}.gpl-t span{min-width:0;overflow-wrap:anywhere}.gpl-t span.done{text-decoration:line-through;opacity:.5}.gpl-t small{opacity:.6;font-size:11px;margin-left:4px}
.gpl-add{display:flex;gap:6px;margin-top:4px}.gpl-add input{flex:1;min-width:0;font:inherit;font-size:14px;padding:8px 10px;border-radius:10px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit}.gpl-add select{font:inherit;font-size:13px;padding:6px;border-radius:10px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;max-width:110px}.gpl-add button{font:inherit;font-weight:700;font-size:13px;border-radius:10px;border:0;padding:8px 12px;cursor:pointer;background:#2f6fdd;color:#fff}
.gpl-e{font-size:13px;opacity:.7;margin:0}`;
  function card(el, opts = {}) {
    if (!el) return;
    if (!document.getElementById('gpl-css')) { const s = document.createElement('style'); s.id = 'gpl-css'; s.textContent = CSS; document.head.appendChild(s); }
    const href = opts.href || '../gameplan/';
    const draw = () => {
      if (!has() && !opts.always) { el.hidden = true; return; }
      el.hidden = false;
      const t = tasks(), td = today(), { now, next, items } = nowNext(), justDone = el._done || new Set();
      const show = (q, n) => t.filter((x) => x.quad === q).sort((a, b) => (b.top === td) - (a.top === td) || (a.due || '9').localeCompare(b.due || '9')).slice(0, n);
      const grp = (q, n) => { const list = show(q, n), more = t.filter((x) => x.quad === q).length - list.length; if (!list.length) return ''; const [name, col] = QUADS[q];
        return `<div class="gpl-q" style="--qc:${col}">${name}</div>` + list.map((x) => `<div class="gpl-t" style="--qc:${col}"><button type="button" data-gpl-done="${esc(x.id)}" aria-label="Done: ${esc(x.title)}"></button><span>${esc(x.title)}${x.top === td ? '<small>★ today</small>' : ''}${x.due ? `<small>${x.due < td ? 'late' : 'due ' + x.due.slice(5).replace('-', '/')}</small>` : ''}</span></div>`).join('') + (more > 0 ? `<div class="gpl-e">+${more} more in Gameplan</div>` : ''); };
      const sched = [now && ['Now', now], next && ['Next', next]].filter(Boolean);
      const left = items.filter((b) => toMin(b.start) + b.mins > new Date().getHours() * 60 + new Date().getMinutes()).length;
      el.innerHTML = `<div class="gpl"><div class="gpl-h"><h3 style="margin:0">${esc(opts.title || 'Gameplan')}</h3><a href="${href}#matrix">Open ›</a></div>
        ${sched.length ? `<div class="gpl-sched">${sched.map(([l, b]) => `<div class="gpl-b" style="--c:${COLORS[b.type] || '#db2777'}"><b>${l}</b>${esc(b.title)}<span>${fmt(toMin(b.start))}–${fmt(toMin(b.start) + b.mins)}</span></div>`).join('')}${left > sched.length ? `<a class="gpl-e" href="${href}#today" style="text-decoration:none;color:inherit">${left - sched.length} more on today's schedule ›</a>` : ''}</div>` : ''}
        ${grp('do', opts.n || 3) + grp('plan', opts.n || 3) + grp('quick', Math.max(2, (opts.n || 3) - 1)) || '<p class="gpl-e">No open tasks. Add one below and it lands in Gameplan.</p>'}
        <form class="gpl-add" data-gpl-form><input type="text" maxlength="120" placeholder="Add a task" aria-label="New task"><select aria-label="Where"><option value="do">Do now</option><option value="plan">Schedule</option><option value="quick">Quick hits</option><option value="drop">Drop it</option></select><button>Add</button></form></div>`;
    };
    if (!el._gpl) {
      el._gpl = true;
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-gpl-done]'); if (!b) return; b.classList.add('on'); b.textContent = '✓'; b.nextElementSibling?.classList.add('done'); setTimeout(() => { toggle(b.dataset.gplDone); draw(); opts.onChange?.(); }, 450); });
      el.addEventListener('submit', (e) => { const f = e.target.closest('[data-gpl-form]'); if (!f) return; e.preventDefault(); const v = f.querySelector('input').value.trim(); if (!v) return f.querySelector('input').focus(); add(v, f.querySelector('select').value, { from: opts.app || '' }); draw(); opts.onChange?.(); opts.toast?.(`Added to Gameplan · ${QUADS[f.querySelector('select').value][0]}`); });
      window.addEventListener('storage', (e) => { if (!e.key || e.key.startsWith('gp:')) draw(); });
    }
    draw();
  }
  return { has, tasks, toggle, add, schedule, setBlocks, push, nowNext, card, quadOf, QUADS, COLORS };
})();
