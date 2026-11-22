'use strict';
// ===================== Flashcards (spaced repetition), quizzes and practice tests =====================
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cardLevel = (c) => (!c.reps && !c.lapses ? ['New', 'var(--muted)'] : (c.lapses || 0) >= 2 || (c.ease || 2.5) < 2.1 ? ['Hard', 'var(--bad)'] : (c.interval || 0) >= 6 ? ['Mastered', 'var(--good)'] : ['Learning', 'var(--warn)']);
function newDeck(classId = '', after) {
  modal({ title: 'New deck', icon: 'layers', body: `<div class="fgrid"><label class="f full">Deck name<input type="text" id="nd-n" placeholder="e.g. Unit 3 vocab" autofocus></label><label class="f full">Class<select id="nd-c">${classOptions(classId)}</select></label></div>`,
    foot: `<button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-ok>Create</button>`,
    onMount: (r, close) => { $('[data-x2]', r).onclick = close; $('[data-ok]', r).onclick = () => { const n = $('#nd-n', r).value.trim(); if (!n) return toast('Name the deck'); const d = { id: uid('k'), name: n, classId: $('#nd-c', r).value, createdAt: Date.now() }; upsert('decks', d); close(); after ? after(d) : go('study', 'cards', d.id); }; $('#nd-n', r).onkeydown = (e) => e.key === 'Enter' && $('[data-ok]', r).click(); } });
}
function reviewPairs(pairs, title, classId) {
  const rows = pairs.map((p) => ({ ...p, keep: true }));
  modal({ title: `${rows.length} card${rows.length === 1 ? '' : 's'} found`, icon: 'layers', wide: true,
    body: `<p class="small muted" style="margin:0">Found with simple patterns (shown on each row). Edit or untick before saving.</p><label class="f" style="max-width:340px">Add to deck<select id="rp-d"><option value="">New deck: ${esc(title)}</option>${S.decks.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label><div class="stack" style="gap:8px" id="rp">${rows.map((x, i) => `<div class="review-row" data-i="${i}"><input type="checkbox" checked data-k="keep" aria-label="Keep"><div class="stack" style="gap:6px"><input type="text" data-k="term" value="${esc(x.term)}" aria-label="Front"><textarea data-k="def" rows="2" style="min-height:0" aria-label="Back">${esc(x.def)}</textarea><span class="tiny dim">${esc(x.how)}</span></div></div>`).join('')}</div>`,
    foot: `<button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-ok>${icon('check', 15)} Save cards</button>`,
    onMount: (r, close) => {
      $('#rp', r).addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (row) rows[+row.dataset.i][e.target.dataset.k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; });
      $('#rp', r).addEventListener('change', (e) => { const row = e.target.closest('[data-i]'); if (row && e.target.type === 'checkbox') rows[+row.dataset.i].keep = e.target.checked; });
      $('[data-x2]', r).onclick = close;
      $('[data-ok]', r).onclick = () => { let did = $('#rp-d', r).value; if (!did) { const d = { id: uid('k'), name: title || 'New deck', classId, createdAt: Date.now() }; S.decks.push(d); did = d.id; }
        const have = new Set(S.cards.filter((c) => c.deckId === did).map((c) => c.front.toLowerCase())); let n = 0;
        for (const x of rows) if (x.keep && x.term.trim() && x.def.trim() && !have.has(x.term.trim().toLowerCase())) { S.cards.push({ id: uid('f'), deckId: did, front: x.term.trim(), back: x.def.trim(), createdAt: Date.now() }); n++; }
        save('decks', 'cards'); close(); toast(`Saved ${n} card${n === 1 ? '' : 's'}`); go('study', 'cards', did); };
    } });
}

// ---------- decks ----------
function cardsView(id) {
  const d = id && byId('decks', id);
  if (d) return deckDetail(d);
  const decks = [...S.decks].sort((a, b) => cardsDue(b.id).length - cardsDue(a.id).length);
  const due = cardsDue().length, total = S.cards.length, mastered = S.cards.filter((c) => (c.interval || 0) >= 6).length;
  return { actions: `<button class="btn primary sm" id="dk-new">${icon('plus', 15)} New deck</button>`,
    html: `<div class="kpis">${kpi('layers', 'Cards', total, `${S.decks.length} decks`)}${kpi('alarm-clock', 'Due today', due, due ? 'review to keep them fresh' : 'all caught up', due ? 'var(--warn)' : 'var(--good)')}${kpi('award', 'Mastered', total ? Math.round((mastered / total) * 100) + '%' : '—', `${mastered} cards at 6+ day intervals`, 'var(--good)')}${kpi('flame', 'Reviewed today', S.cards.filter((c) => c.last === today()).length, 'cards')}</div>
      ${due ? `<div class="brief"><span class="bi">${icon('repeat', 18)}</span><div class="grow"><b>${due} card${due === 1 ? ' is' : 's are'} due across your decks</b><div class="small muted">Spaced repetition shows each card again right before you're likely to forget it.</div></div><button class="btn primary" id="dk-all">Review all</button></div>` : ''}
      ${decks.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${decks.map((x) => { const cs = S.cards.filter((c) => c.deckId === x.id), m = deckMastery(x.id), du = cardsDue(x.id).length; return `<a class="class-card" style="--c:${clsColor(x.classId)};text-decoration:none;color:inherit" href="#study/cards/${x.id}"><div class="cc-top"><span class="cc-icon">${icon('layers', 19)}</span><span class="ring-sm">${ring(m * 100, Math.round(m * 100) + '%', '', 54, clsColor(x.classId), 6)}</span></div><div style="position:relative"><h3>${esc(x.name)}</h3><div class="small muted">${esc(clsName(x.classId))}</div></div><div class="between small"><span class="muted">${cs.length} cards</span>${du ? `<span class="badge warn">${du} due</span>` : '<span class="badge good">Up to date</span>'}</div></a>`; }).join('')}</div>`
        : `<div class="card">${emptyState('layers', 'No flashcards yet', 'Create a deck, or turn a note or study guide into cards automatically.', `<div class="row"><button class="btn primary" onclick="newDeck()">${icon('plus', 15)} New deck</button><a class="btn" href="#study/workspace">${icon('notebook-pen', 15)} From a note</a></div>`)}</div>`}`,
    mount(root) { $('#dk-new').onclick = () => newDeck(); $('#dk-all', root)?.addEventListener('click', () => studyCards(cardsDue(), 'All due cards')); } };
}
function deckDetail(d) {
  const cs = S.cards.filter((c) => c.deckId === d.id), due = cardsDue(d.id), lv = {}; cs.forEach((c) => { const [l] = cardLevel(c); lv[l] = (lv[l] || 0) + 1; });
  const colors = { New: 'var(--muted)', Learning: 'var(--warn)', Hard: 'var(--bad)', Mastered: 'var(--good)' };
  return { sub: `<a href="#study/cards" style="color:var(--muted);text-decoration:none">Flashcards</a> / ${esc(d.name)}`,
    actions: `<button class="btn ghost sm" id="dd-del" aria-label="Delete deck">${icon('trash-2', 15)}</button><button class="btn sm" id="dd-quiz" ${cs.length < 2 ? 'disabled' : ''}>${icon('circle-help', 15)}<span class="hide-sm">Quiz</span></button><button class="btn primary sm" id="dd-study" ${cs.length ? '' : 'disabled'}>${icon('play', 15)} Study ${due.length ? `(${due.length})` : ''}</button>`,
    html: `<div class="grid g-12"><div class="card s-4"><div class="row" style="gap:16px">${donut(Object.entries(lv).map(([k, v]) => ({ label: k, value: v, color: colors[k] })), cs.length, 'cards', 128)}<div class="stack" style="gap:6px">${['New', 'Learning', 'Hard', 'Mastered'].map((k) => `<span class="row small"><i class="dot-c" style="--c:${colors[k]}"></i>${k}<b class="num" style="margin-left:auto">${lv[k] || 0}</b></span>`).join('')}</div></div>
        <div class="stack" style="gap:8px;margin-top:16px"><button class="btn block primary" id="dd-due" ${due.length ? '' : 'disabled'}>${icon('repeat', 15)} Review ${due.length} due</button><button class="btn block" id="dd-cram" ${cs.length ? '' : 'disabled'}>${icon('shuffle', 15)} Study all (cram)</button><button class="btn block" id="dd-weak" ${cs.some((c) => cardLevel(c)[0] === 'Hard') ? '' : 'disabled'}>${icon('target', 15)} Only hard cards</button></div>
        <div class="card-h" style="margin:18px 0 8px"><h3>Deck</h3></div><div class="fgrid"><label class="f full">Name<input type="text" id="dd-n" value="${esc(d.name)}"></label><label class="f full">Class<select id="dd-c">${classOptions(d.classId)}</select></label><label class="f full">Topic (for mastery)<select id="dd-t"><option value="">Not linked</option>${topicsOf(d.classId).map((t) => `<option value="${t.id}"${d.topicId === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label></div></div>
      <div class="card s-8"><div class="card-h"><h3>Cards</h3><span class="end row"><button class="btn sm" id="dd-bulk">${icon('list', 14)} Paste many</button></span></div>
        <form id="dd-add" class="row wrap" style="gap:8px;margin-bottom:12px"><input type="text" id="dd-f" placeholder="Front (term or question)" style="flex:1;min-width:160px" aria-label="Front"><input type="text" id="dd-b" placeholder="Back (definition or answer)" style="flex:2;min-width:200px" aria-label="Back"><button class="btn primary" type="submit">${icon('plus', 15)} Add</button></form>
        ${cs.length ? `<div class="list">${cs.map((c) => { const [l, col] = cardLevel(c); return `<div class="li" data-card="${c.id}"><span class="grow"><span class="t">${esc(c.front)}</span><div class="s">${esc(c.back)}</div></span><span class="badge" style="color:${col}">${l}</span><span class="tiny muted" style="white-space:nowrap">${c.due ? (c.due <= today() ? 'due' : relDay(c.due)) : 'new'}</span><button class="icon-btn" style="width:32px;height:32px" data-edc="${c.id}" aria-label="Edit card">${icon('pencil', 14)}</button><button class="icon-btn" style="width:32px;height:32px" data-rmc="${c.id}" aria-label="Delete card">${icon('trash-2', 14)}</button></div>`; }).join('')}</div>` : emptyState('layers', 'Empty deck', 'Add cards above, or paste a list of "term: definition" lines.')}</div></div>`,
    mount(root) {
      $('#dd-add', root).onsubmit = (e) => { e.preventDefault(); const f = $('#dd-f', root).value.trim(), b = $('#dd-b', root).value.trim(); if (!f || !b) return toast('Fill in both sides'); if (cs.some((c) => c.front.toLowerCase() === f.toLowerCase()) && !confirm('A card with this front exists. Add anyway?')) return; upsert('cards', { id: uid('f'), deckId: d.id, front: f, back: b, createdAt: Date.now() }); render(); setTimeout(() => $('#dd-f')?.focus(), 50); };
      $('#dd-n', root).onchange = (e) => { if (e.target.value.trim()) { d.name = e.target.value.trim(); save('decks'); } };
      $('#dd-c', root).onchange = (e) => { d.classId = e.target.value; delete d.topicId; save('decks'); };
      $('#dd-t', root).onchange = (e) => { if (e.target.value) d.topicId = e.target.value; else delete d.topicId; save('decks'); toast('Topic link saved'); };
      $('#dd-study').onclick = () => studyCards(due.length ? due : cs, d.name);
      $('#dd-due', root).onclick = () => studyCards(due, d.name); $('#dd-cram', root).onclick = () => studyCards(shuffle(cs), d.name + ' (all)');
      $('#dd-weak', root).onclick = () => studyCards(cs.filter((c) => cardLevel(c)[0] === 'Hard'), d.name + ' (hard)');
      $('#dd-quiz').onclick = () => runQuiz(makeQuestions(cs, Math.min(10, cs.length), 'mixed'), { title: 'Quiz: ' + d.name, classId: d.classId, deckIds: [d.id], kind: 'quiz' });
      $('#dd-bulk', root).onclick = () => { const close = modal({ title: 'Paste cards', icon: 'list', body: `<p class="small muted" style="margin:0">One per line: <code>term: definition</code>, <code>term - definition</code> or <code>term = definition</code>.</p><textarea id="bk" rows="10"></textarea>`, foot: `<button class="btn primary" data-ok>Find cards</button>`, onMount: (r, c) => { $('[data-ok]', r).onclick = () => { const p = extractPairs($('#bk', r).value); if (!p.length) return toast('No pairs found'); c(); reviewPairs(p, d.name, d.classId); setTimeout(() => { const s = $('#rp-d'); if (s) s.value = d.id; }, 30); }; } }); };
      $('#dd-del').onclick = async () => { if (await confirmBox(`Delete "${d.name}" and its ${cs.length} cards?`)) { S.cards = S.cards.filter((c) => c.deckId !== d.id); remove('decks', d.id); save('cards'); go('study', 'cards'); } };
      root.addEventListener('click', async (e) => {
        const rm = e.target.closest('[data-rmc]'); if (rm) { const c = byId('cards', rm.dataset.rmc); remove('cards', c.id); toast('Card deleted', { label: 'Undo', fn: () => upsert('cards', c) }); return; }
        const ed = e.target.closest('[data-edc]'); if (ed) { const c = byId('cards', ed.dataset.edc); modal({ title: 'Edit card', icon: 'pencil', body: `<label class="f">Front<input type="text" id="ec-f" value="${esc(c.front)}"></label><label class="f">Back<textarea id="ec-b" rows="4">${esc(c.back)}</textarea></label><label class="f">Topic<select id="ec-t"><option value="">Same as deck</option>${topicsOf(byId('decks', c.deckId)?.classId).map((t) => `<option value="${t.id}"${c.topicId === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><label class="row small"><input type="checkbox" id="ec-r"> Reset progress (treat as new)</label>`, foot: `<button class="btn primary" data-ok>Save</button>`, onMount: (r, close) => { $('[data-ok]', r).onclick = () => { c.front = $('#ec-f', r).value.trim() || c.front; c.back = $('#ec-b', r).value.trim() || c.back; if ($('#ec-t', r).value) c.topicId = $('#ec-t', r).value; else delete c.topicId; if ($('#ec-r', r).checked) for (const k of ['ease', 'reps', 'interval', 'due', 'lapses', 'known', 'last']) delete c[k]; save('cards'); close(); }; } }); }
      });
    } };
}
function studyCards(list, title) {
  if (!list.length) return toast('No cards to study');
  const queue = [...list], again = new Set(); let i = 0, flipped = false, right = 0, seen = 0;
  const preview = (c, q) => { const t = { ...c }; reviewCard(t, q); return t.interval ? (t.interval === 1 ? '1 day' : t.interval < 30 ? t.interval + ' days' : Math.round(t.interval / 30) + ' mo') : 'again today'; };
  const close = modal({ title, icon: 'layers', wide: true, body: '<div id="sc"></div>', onClose: () => { document.removeEventListener('keydown', keys); if (seen) toast(`Reviewed ${seen} card${seen === 1 ? '' : 's'} · ${right} known`); render(); },
    onMount: (r) => draw(r) });
  function draw(r = document) {
    const el = $('#sc', r); if (!el) return;
    if (i >= queue.length) { el.innerHTML = `<div class="empty" style="padding:30px">${ring(seen ? (right / seen) * 100 : 0, seen ? Math.round((right / seen) * 100) + '%' : '—', 'known', 130, 'var(--good)')}<b style="font-size:18px">Session done</b><span>${seen} reviews · ${right} known · ${again.size} to see again soon</span><div class="row"><button class="btn" id="sc-x">Close</button>${again.size ? `<button class="btn primary" id="sc-again">${icon('repeat', 15)} Review missed (${again.size})</button>` : ''}</div></div>`; $('#sc-x', el).onclick = close; $('#sc-again', el)?.addEventListener('click', () => { queue.push(...S.cards.filter((c) => again.has(c.id))); again.clear(); draw(); }); return; }
    const c = queue[i], dk = byId('decks', c.deckId), [lvl, col] = cardLevel(c);
    el.innerHTML = `<div class="between small" style="margin-bottom:10px"><span class="muted">${i + 1} of ${queue.length}</span><span class="badge" style="color:${col}">${lvl}</span></div><div class="bar" style="margin-bottom:14px"><i style="width:${(i / queue.length) * 100}%"></i></div>
      <div class="flip${flipped ? ' on' : ''}" id="sc-card" style="--c:${clsColor(dk?.classId)}" role="button" tabindex="0" aria-label="Flip card"><div class="inner"><div class="face front"><small>${esc(dk?.name || 'Card')}</small><div style="font:600 22px/1.4 var(--f-display)">${esc(c.front)}</div></div><div class="face back"><small>Answer</small><div>${esc(c.back)}</div></div></div></div>
      <div style="margin-top:14px">${flipped ? `<div class="rate">${[[0, 'Still learning', 'var(--bad)'], [1, 'Hard', 'var(--warn)'], [2, 'Know it', 'var(--good)'], [3, 'Easy', 'var(--accent)']].map(([q, l, cc]) => `<button data-q="${q}" style="color:${cc}">${l}<small>${preview(c, q)}</small></button>`).join('')}</div><p class="tiny dim" style="text-align:center;margin:8px 0 0">Keys: 1-4 to rate</p>` : `<button class="btn primary block" id="sc-flip">${icon('refresh-cw', 16)} Show answer</button><p class="tiny dim" style="text-align:center;margin:8px 0 0">Tap the card or press Space</p>`}</div>`;
    $('#sc-card', el).onclick = flip; $('#sc-flip', el)?.addEventListener('click', flip);
    $$('[data-q]', el).forEach((b) => (b.onclick = () => rate(+b.dataset.q)));
  }
  function flip() { flipped = !flipped; draw(); }
  function rate(q) { const c = queue[i]; reviewCard(c, q); seen++; if (q >= 2) right++; else again.add(c.id); if (q === 0) queue.push(c); save('cards'); i++; flipped = false; draw(); }
  function keys(e) { if (!$('#sc')) return; if (e.key === ' ' && !e.target.matches('input,textarea,button')) { e.preventDefault(); flip(); } if (flipped && ['1', '2', '3', '4'].includes(e.key)) rate(+e.key - 1); }
  document.addEventListener('keydown', keys);
}

// ---------- question generation (from your cards; rule-based) ----------
const norm = (s) => String(s).toLowerCase().replace(/\b(the|a|an)\b/g, '').replace(/[^a-z0-9]/g, '');
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }
function closeEnough(ans, key) { const a = norm(ans), k = norm(key); if (!a) return false; if (a === k) return true; return lev(a, k) <= Math.max(1, Math.floor(k.length * 0.2)); }
const QTYPES = { mc: 'Multiple choice', tf: 'True / false', short: 'Short answer', match: 'Matching' };
function makeQuestions(cards, n, difficulty = 'mixed', types = null) {
  const pool = cards.filter((c) => c.front && c.back); if (!pool.length) return [];
  types = types || (difficulty === 'easy' ? ['mc', 'tf'] : difficulty === 'hard' ? ['short', 'mc', 'match', 'short'] : ['mc', 'tf', 'short', 'mc', 'match']);
  let order = difficulty === 'hard' ? [...pool].sort((a, b) => (b.lapses || 0) - (a.lapses || 0) || (a.ease || 2.5) - (b.ease || 2.5)) : shuffle(pool);
  const qs = [], others = (c) => shuffle(pool.filter((x) => x.id !== c.id && norm(x.front) !== norm(c.front)));
  let k = 0;
  while (qs.length < n && order.length) {
    let t = types[k++ % types.length]; const c = order.shift();
    if ((t === 'mc' || t === 'match') && pool.length < 4) t = pool.length >= 2 ? 'tf' : 'short';
    if (t === 'tf' && pool.length < 2) t = 'short';
    if (t === 'mc') { const rev = c.back.length < 110 && Math.random() < 0.35; const ds = others(c).slice(0, 3); const opts = shuffle([c, ...ds]);
      qs.push(rev ? { type: 'mc', prompt: `What does “${c.front}” mean?`, options: opts.map((x) => x.back), answer: opts.indexOf(c), cardIds: [c.id], explain: `${c.front}: ${c.back}` } : { type: 'mc', prompt: 'Which term matches this?', sub: c.back, options: opts.map((x) => x.front), answer: opts.indexOf(c), cardIds: [c.id], explain: `${c.front}: ${c.back}` }); }
    else if (t === 'tf') { const truth = Math.random() < 0.5, o = others(c)[0]; qs.push({ type: 'tf', prompt: 'True or false?', sub: `${c.front} — ${truth ? c.back : o.back}`, answer: truth, cardIds: [c.id], explain: truth ? `True. ${c.front}: ${c.back}` : `False. ${c.front}: ${c.back}. (That description belongs to ${o.front}.)` }); }
    else if (t === 'short') qs.push({ type: 'short', prompt: 'Type the term:', sub: c.back, answer: c.front, cardIds: [c.id], explain: `${c.front}: ${c.back}` });
    else { const set = [c, ...others(c).filter((x) => !qs.some((q) => q.cardIds.includes(x.id))).slice(0, 3)]; if (set.length < 4) { order.unshift(c); types = types.filter((x) => x !== 'match'); if (!types.length) types = ['short']; continue; } order = order.filter((x) => !set.includes(x)); const defs = shuffle(set);
      qs.push({ type: 'match', prompt: 'Match each term to its meaning', terms: set.map((x) => x.front), defs: defs.map((x) => x.back), answer: set.map((x) => defs.indexOf(x)), cardIds: set.map((x) => x.id), explain: set.map((x) => `${x.front}: ${x.back}`).join('\n') }); }
  }
  return qs;
}
function grade(q, a) {
  if (a == null) return 0;
  if (q.type === 'mc') return a === q.answer ? 1 : 0;
  if (q.type === 'tf') return a === q.answer ? 1 : 0;
  if (q.type === 'short') return closeEnough(a, q.answer) ? 1 : 0;
  if (q.type === 'match') return q.answer.filter((x, i) => a[i] === x).length / q.answer.length;
  return 0;
}
/** opts: {title, classId, deckIds, kind: 'quiz'|'test', exam: bool, timeLimit: minutes} */
function runQuiz(qs, opts) {
  if (!qs.length) return toast('Not enough cards to build questions');
  const ans = qs.map((q) => (q.type === 'match' ? q.terms.map(() => null) : null)), checked = qs.map(() => false);
  let i = 0, done = false, t0 = Date.now(), timer = null;
  const endAt = opts.timeLimit ? t0 + opts.timeLimit * 6e4 : null;
  const close = modal({ title: opts.title, icon: opts.kind === 'test' ? 'clipboard-list' : 'circle-help', wide: true, headEnd: `<span class="badge accent num" id="qz-clock"></span>`, body: '<div id="qz"></div>',
    onMount: (r) => { draw(r); tick(); timer = setInterval(tick, 1000); }, onClose: () => clearInterval(timer) });
  function tick() { const el = $('#qz-clock'); if (!el) return; const s = endAt ? Math.max(0, Math.round((endAt - Date.now()) / 1000)) : Math.round((Date.now() - t0) / 1000); el.textContent = `${endAt ? '' : ''}${Math.floor(s / 60)}:${pad(s % 60)}${endAt ? ' left' : ''}`; if (endAt && s <= 0 && !done) { toast("Time's up"); finish(); } }
  function qHTML(q, k, show) {
    const a = ans[k];
    const mark = (ok) => (show ? (ok ? ' right' : '') : '');
    if (q.type === 'mc') return q.options.map((o, j) => `<button type="button" class="q-opt${a === j ? ' sel' : ''}${show && j === q.answer ? ' right' : ''}${show && a === j && j !== q.answer ? ' wrong' : ''}" data-o="${j}" ${show ? 'disabled' : ''}><span class="k">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('');
    if (q.type === 'tf') return `<div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">${[true, false].map((v) => `<button type="button" class="q-opt${a === v ? ' sel' : ''}${show && v === q.answer ? ' right' : ''}${show && a === v && v !== q.answer ? ' wrong' : ''}" data-tf="${v}" ${show ? 'disabled' : ''} style="justify-content:center"><b>${v ? 'True' : 'False'}</b></button>`).join('')}</div>`;
    if (q.type === 'short') return `<input type="text" id="qz-in" value="${esc(a || '')}" placeholder="Your answer" ${show ? 'disabled' : ''} autocomplete="off" aria-label="Your answer">${show ? `<div class="alert ${grade(q, a) ? 'good' : 'bad'}" style="margin-top:8px"><span class="ai">${icon(grade(q, a) ? 'circle-check' : 'circle-x', 15)}</span><span>Answer: <b>${esc(q.answer)}</b>${grade(q, a) && norm(a) !== norm(q.answer) ? ' (close enough — check spelling)' : ''}</span></div>` : '<p class="tiny dim" style="margin:6px 0 0">Small spelling mistakes are accepted.</p>'}`;
    return `<div class="stack" style="gap:8px">${q.terms.map((t, j) => `<div class="row wrap" style="gap:8px;padding:8px;border:1px solid ${show ? (a[j] === q.answer[j] ? 'var(--good)' : 'var(--bad)') : 'var(--line)'};border-radius:12px"><b style="flex:1;min-width:120px">${esc(t)}</b><select data-m="${j}" style="flex:2;min-width:180px;width:auto" ${show ? 'disabled' : ''} aria-label="Meaning for ${esc(t)}"><option value="">Choose…</option>${q.defs.map((d, x) => `<option value="${x}"${a[j] === x ? ' selected' : ''}>${esc(d.length > 90 ? d.slice(0, 88) + '…' : d)}</option>`).join('')}</select></div>`).join('')}</div>${show ? `<p class="small muted" style="white-space:pre-wrap;margin:8px 0 0">${esc(q.explain)}</p>` : ''}`;
    void mark;
  }
  function draw(r = document) {
    const el = $('#qz', r); if (!el || done) return;
    const q = qs[i], show = !opts.exam && checked[i];
    el.innerHTML = `<div class="between small" style="margin-bottom:8px"><span class="muted">Question ${i + 1} of ${qs.length} · ${QTYPES[q.type]}</span>${opts.exam ? `<span class="muted">${ans.filter((a) => a != null && (!Array.isArray(a) || a.some((x) => x != null))).length} answered</span>` : `<span class="muted">${checked.filter(Boolean).length} checked</span>`}</div>
      <div class="bar" style="margin-bottom:16px"><i style="width:${((i + 1) / qs.length) * 100}%"></i></div>
      <h3 style="font-size:18px;margin-bottom:6px">${esc(q.prompt)}</h3>${q.sub ? `<div class="card flat raised" style="padding:14px;margin-bottom:12px;font-size:15.5px">${esc(q.sub)}</div>` : ''}
      <div class="stack" style="gap:8px">${qHTML(q, i, show)}</div>
      ${show && q.type !== 'short' && q.type !== 'match' ? `<div class="alert ${grade(q, ans[i]) ? 'good' : 'bad'}" style="margin-top:12px"><span class="ai">${icon(grade(q, ans[i]) ? 'circle-check' : 'circle-x', 15)}</span><span>${grade(q, ans[i]) ? 'Correct.' : 'Not quite.'} ${esc(q.explain)}</span></div>` : ''}
      ${opts.exam ? `<div class="row wrap" style="gap:4px;margin-top:16px">${qs.map((_, j) => `<button type="button" class="chip${j === i ? ' on' : ''}" data-j="${j}" style="min-width:34px;justify-content:center;${ans[j] != null && (!Array.isArray(ans[j]) || ans[j].every((x) => x != null)) ? 'border-color:var(--good)' : ''}">${j + 1}</button>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:16px"><button class="btn ghost" id="qz-prev" ${i ? '' : 'disabled'}>${icon('chevron-left', 16)} Back</button><span class="grow"></span>
        ${opts.exam ? `${i < qs.length - 1 ? `<button class="btn" id="qz-next">Next ${icon('chevron-right', 16)}</button>` : ''}<button class="btn primary" id="qz-submit">${icon('flag', 15)} Submit test</button>`
          : show ? (i < qs.length - 1 ? `<button class="btn primary" id="qz-next">Next ${icon('chevron-right', 16)}</button>` : `<button class="btn primary" id="qz-submit">${icon('flag', 15)} See results</button>`) : `<button class="btn primary" id="qz-check">Check</button>`}</div>`;
    $$('[data-o]', el).forEach((b) => (b.onclick = () => { ans[i] = +b.dataset.o; draw(); }));
    $$('[data-tf]', el).forEach((b) => (b.onclick = () => { ans[i] = b.dataset.tf === 'true'; draw(); }));
    $$('[data-m]', el).forEach((s) => (s.onchange = () => { ans[i][+s.dataset.m] = s.value === '' ? null : +s.value; }));
    $$('[data-j]', el).forEach((b) => (b.onclick = () => { i = +b.dataset.j; draw(); }));
    const inp = $('#qz-in', el); if (inp) { inp.oninput = () => (ans[i] = inp.value); inp.onkeydown = (e) => { if (e.key === 'Enter') ($('#qz-check', el) || $('#qz-next', el) || $('#qz-submit', el))?.click(); }; if (!show) setTimeout(() => inp.focus(), 20); }
    $('#qz-prev', el).onclick = () => { i--; draw(); };
    $('#qz-next', el)?.addEventListener('click', () => { i++; draw(); });
    $('#qz-check', el)?.addEventListener('click', () => { if (ans[i] == null || ans[i] === '') return toast('Pick or type an answer first'); checked[i] = true; draw(); });
    $('#qz-submit', el)?.addEventListener('click', async () => { const blank = ans.filter((a) => a == null || a === '' || (Array.isArray(a) && a.some((x) => x == null))).length; if (opts.exam && blank && !(await confirmBox(`${blank} question${blank === 1 ? ' is' : 's are'} unanswered. Submit anyway?`, 'Submit', false))) return; finish(); });
  }
  function finish() {
    if (done) return; done = true; clearInterval(timer);
    const scores = qs.map((q, k) => grade(q, ans[k])), correct = round(sum(scores), 2), total = qs.length, pct = (correct / total) * 100, mins = Math.max(1, Math.round((Date.now() - t0) / 6e4));
    const missed = qs.flatMap((q, k) => (scores[k] < 1 ? q.cardIds : [])).filter((id) => !String(id).startsWith('tmp'));
    for (const id of missed) { const c = byId('cards', id); if (c) { c.due = today(); c.known = false; } }
    const res = { id: uid('r'), title: opts.title.replace(/^(Quiz|Test): /, ''), classId: opts.classId || '', deckIds: opts.deckIds || [], kind: opts.kind || 'quiz', exam: !!opts.exam, correct, total, mins, at: Date.now(), byType: Object.fromEntries(Object.keys(QTYPES).map((t) => [t, [sum(scores.filter((_, k) => qs[k].type === t)), qs.filter((q) => q.type === t).length]]).filter(([, v]) => v[1])) };
    res.cardResults = qs.flatMap((q, k) => q.type === 'match' ? q.cardIds.map((id, j) => ({ id, s: ans[k] && ans[k][j] === q.answer[j] ? 1 : 0 })) : q.cardIds.map((id) => ({ id, s: scores[k] }))).filter((x) => !String(x.id).startsWith('tmp'));
    S.results.push(res); save('results', 'cards');
    const el = $('#qz'); if (!el) return;
    el.innerHTML = `<div class="row wrap" style="gap:20px;justify-content:center;margin-bottom:12px">${ring(pct, Math.round(pct) + '%', `${correct}/${total}`, 140, gradeColor(pct))}<div class="stack" style="gap:6px"><b style="font:700 20px var(--f-display)">${pct >= 90 ? 'Excellent' : pct >= 75 ? 'Solid work' : pct >= 60 ? 'Getting there' : 'Keep practicing'}</b><span class="small muted">${fmtMins(mins)} · ${opts.exam ? 'exam mode' : 'practice mode'}</span>${Object.entries(res.byType).map(([t, [c, n]]) => `<span class="small">${QTYPES[t]}: <b>${round(c, 1)}/${n}</b></span>`).join('')}${missed.length ? `<span class="small warn">${missed.length} missed card${missed.length === 1 ? '' : 's'} moved to today's review</span>` : ''}</div></div>
      <h3 style="margin:8px 0">Review</h3><div class="stack" style="gap:10px">${qs.map((q, k) => `<div class="card flat raised" style="padding:12px"><div class="between small"><b>${k + 1}. ${esc(q.prompt)}</b><span class="badge ${scores[k] === 1 ? 'good' : scores[k] > 0 ? 'warn' : 'bad'}">${scores[k] === 1 ? 'Correct' : scores[k] > 0 ? Math.round(scores[k] * 100) + '%' : 'Wrong'}</span></div>${q.sub ? `<div class="small" style="margin:6px 0">${esc(q.sub)}</div>` : ''}<div class="small muted" style="white-space:pre-wrap">Your answer: ${esc(showAns(q, ans[k]))}\n${esc(q.explain)}</div></div>`).join('')}</div>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="qz-close">Close</button><button class="btn primary" id="qz-retry">${icon('rotate-ccw', 15)} New questions</button></div>`;
    $('#qz-close', el).onclick = () => { close(); render(); };
    $('#qz-retry', el).onclick = () => { close(); const cards = S.cards.filter((c) => qs.some((q) => q.cardIds.includes(c.id))); runQuiz(makeQuestions(cards.length >= 2 ? cards : qs.flatMap((q) => q.cardIds.map((id) => byId('cards', id))).filter(Boolean), qs.length, opts.difficulty || 'mixed'), opts); };
  }
  function showAns(q, a) { if (a == null || a === '') return '(blank)'; if (q.type === 'mc') return q.options[a]; if (q.type === 'tf') return a ? 'True' : 'False'; if (q.type === 'match') return q.terms.map((t, j) => `${t} → ${a[j] == null ? '—' : q.defs[a[j]].slice(0, 50)}`).join('; '); return a; }
}

// ---------- quiz + test tabs ----------
function deckChips(id) { return S.decks.length ? `<div class="chips" id="${id}">${S.decks.map((d) => `<button type="button" class="chip" data-d="${d.id}"><i class="dot-c" style="--c:${clsColor(d.classId)}"></i>${esc(d.name)} <span class="muted">${S.cards.filter((c) => c.deckId === d.id).length}</span></button>`).join('')}</div>` : `<p class="small muted" style="margin:0">No flashcard decks yet. Questions are built from your cards. <a href="#study/cards">Create a deck</a> or turn a note into cards.</p>`; }
const pickedCards = (root, id) => { const ids = $$(`#${id} .chip.on`, root).map((b) => b.dataset.d); return { ids, cards: S.cards.filter((c) => ids.includes(c.deckId)) }; };
function resultsTable(kind) {
  const rs = S.results.filter((r) => r.kind === kind).sort((a, b) => b.at - a.at);
  if (!rs.length) return `<p class="small muted" style="margin:0">No ${kind === 'test' ? 'practice tests' : 'quizzes'} taken yet.</p>`;
  const series = [...rs].reverse().slice(-20);
  return lineChart([{ name: 'Score', color: 'var(--accent)', points: series.map((r, i) => ({ i, y: Math.round((r.correct / r.total) * 100), label: r.title })) }], { labels: series.map((r) => fmtDate(isoOf(new Date(r.at)))), min: 0, max: 100, h: 170, fmt: (v) => v + '%' }) +
    `<div class="list" style="margin-top:10px">${rs.slice(0, 10).map((r) => `<div class="li"><span class="cbar" style="--c:${clsColor(r.classId)}"></span><span class="grow"><span class="t">${esc(r.title)}</span><div class="s">${fmtDate(isoOf(new Date(r.at)))} · ${r.total} questions · ${fmtMins(r.mins)}${r.exam ? ' · exam mode' : ''}</div></span><b class="num" style="color:${gradeColor((r.correct / r.total) * 100)}">${Math.round((r.correct / r.total) * 100)}%</b></div>`).join('')}</div>`;
}
function quizView() {
  return { html: `<div class="grid g-12"><div class="card s-6"><div class="card-h"><h3>Quick quiz</h3></div><div class="stack">
    <div><div class="small" style="font-weight:600;color:var(--muted);margin-bottom:6px">Decks</div>${deckChips('qz-d')}</div>
    <div><div class="small" style="font-weight:600;color:var(--muted);margin-bottom:6px">Question types</div><div class="chips" id="qz-t">${Object.entries(QTYPES).map(([k, l]) => `<button type="button" class="chip on" data-t="${k}">${l}</button>`).join('')}</div></div>
    <label class="f" style="max-width:200px">Questions<input type="number" id="qz-n" value="10" min="1" max="50"></label>
    <button class="btn primary" id="qz-go" style="justify-self:start">${icon('play', 15)} Start quiz</button><p class="tiny dim" style="margin:0">Practice mode: you see the answer and explanation after each question. Questions are built from your cards with fixed templates.</p></div></div>
    <div class="card s-6"><div class="card-h"><h3>Quiz history</h3></div>${resultsTable('quiz')}</div></div>`,
    mount(root) {
      $('#qz-d', root)?.addEventListener('click', (e) => e.target.closest('.chip')?.classList.toggle('on'));
      $('#qz-t', root).onclick = (e) => e.target.closest('.chip')?.classList.toggle('on');
      $('#qz-go', root).onclick = () => { const { ids, cards } = pickedCards(root, 'qz-d'); if (cards.length < 2) return toast('Pick decks with at least 2 cards'); const types = $$('#qz-t .chip.on', root).map((b) => b.dataset.t); if (!types.length) return toast('Pick at least one question type'); const n = clamp(Number($('#qz-n', root).value) || 10, 1, 50); const d = byId('decks', ids[0]);
        runQuiz(makeQuestions(cards, n, 'mixed', types), { title: 'Quiz: ' + (ids.length === 1 ? d.name : `${ids.length} decks`), classId: d.classId, deckIds: ids, kind: 'quiz' }); };
    } };
}
function testView() {
  return { html: `<div class="grid g-12"><div class="card s-6"><div class="card-h"><h3>Practice test</h3></div><div class="stack">
    <div><div class="small" style="font-weight:600;color:var(--muted);margin-bottom:6px">Topics (decks)</div>${deckChips('pt-d')}</div>
    <div class="fgrid"><label class="f">Questions<input type="number" id="pt-n" value="20" min="1" max="100"></label><label class="f">Time limit (minutes, 0 = none)<input type="number" id="pt-t" value="20" min="0" max="240"></label></div>
    <div><div class="small" style="font-weight:600;color:var(--muted);margin-bottom:6px">Difficulty</div><div class="seg" id="pt-diff"><button class="" data-v="easy">Easy</button><button class="on" data-v="mixed">Mixed</button><button data-v="hard">Hard</button></div><p class="tiny dim" style="margin:6px 0 0">Easy: multiple choice and true/false. Hard: more typed answers and matching, and your most-missed cards first.</p></div>
    <label class="row small"><input type="checkbox" id="pt-exam" checked> Exam mode (no answers until you submit)</label>
    <button class="btn primary" id="pt-go" style="justify-self:start">${icon('play', 15)} Start test</button></div></div>
    <div class="card s-6"><div class="card-h"><h3>Test history</h3></div>${resultsTable('test')}</div></div>`,
    mount(root) {
      $('#pt-d', root)?.addEventListener('click', (e) => e.target.closest('.chip')?.classList.toggle('on'));
      $('#pt-diff', root).onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) $$('#pt-diff button', root).forEach((x) => x.classList.toggle('on', x === b)); };
      $('#pt-go', root).onclick = () => { const { ids, cards } = pickedCards(root, 'pt-d'); if (cards.length < 2) return toast('Pick decks with at least 2 cards'); const diff = $('#pt-diff .on', root).dataset.v, n = clamp(Number($('#pt-n', root).value) || 20, 1, 100), tl = clamp(Number($('#pt-t', root).value) || 0, 0, 240); const qs = makeQuestions(cards, n, diff); const d = byId('decks', ids[0]);
        if (qs.length < n) toast(`Only ${qs.length} questions could be made from ${cards.length} cards`);
        runQuiz(qs, { title: 'Test: ' + (ids.length === 1 ? d.name : `${ids.length} topics`), classId: d.classId, deckIds: ids, kind: 'test', exam: $('#pt-exam', root).checked, timeLimit: tl || null, difficulty: diff }); };
    } };
}
