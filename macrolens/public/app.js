import { ACTIVITY, GOALS, computeTargets, scale, totals, streak, isoDate } from '/lib/nutrition.js';

// ---------- state (localStorage) ----------
const KEY = 'macrolens:v1';
const MEALS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['snacks', 'Snacks'],
];
const blank = () => ({ profile: null, targets: null, overrides: {}, diary: {}, water: {}, weights: [], recents: [], custom: [] });

let state = load();
let day = isoDate(new Date());
let aiEnabled = false;

function load() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return blank();
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast('Could not save — storage full?');
  }
}
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function targets() {
  const base = state.targets ?? { calories: 2400, protein: 150, carbs: 280, fat: 75, waterOz: 96 };
  const o = state.overrides ?? {};
  return { ...base, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v > 0)) };
}
function dayLog(date = day) {
  state.diary[date] ??= { breakfast: [], lunch: [], dinner: [], snacks: [] };
  return state.diary[date];
}
const allEntries = (date) => Object.values(state.diary[date] ?? {}).flat();
function defaultMeal() {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks';
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- render: today ----------
function renderDayHeader() {
  const today = isoDate(new Date());
  const d = new Date(day + 'T12:00:00');
  const diff = Math.round((new Date(today + 'T12:00:00') - d) / 864e5);
  $('#day-title').textContent = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long' });
  $('#day-sub').textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $('#next-day').disabled = diff <= 0;
  $('#next-day').style.opacity = diff <= 0 ? 0.3 : 1;
}

function renderToday() {
  renderDayHeader();
  const t = targets();
  const tot = totals(allEntries(day));
  const left = t.calories - tot.calories;

  const pct = Math.min(1, tot.calories / t.calories);
  const ring = $('#cal-ring');
  ring.style.strokeDashoffset = String(326.7 * (1 - pct));
  ring.classList.toggle('over', left < 0);
  $('#cal-left').textContent = Math.abs(left).toLocaleString();
  $('#cal-left-label').textContent = left < 0 ? 'kcal over' : 'kcal left';
  $('#eq-goal').textContent = t.calories.toLocaleString();
  $('#eq-food').textContent = tot.calories.toLocaleString();
  $('#eq-left').textContent = left.toLocaleString();

  $('#macro-bars').innerHTML = [
    ['Protein', tot.protein, t.protein, 'var(--protein)'],
    ['Carbs', tot.carbs, t.carbs, 'var(--carbs)'],
    ['Fat', tot.fat, t.fat, 'var(--fat)'],
  ]
    .map(
      ([name, have, goal, color]) => `
      <div class="macro">
        <small>${name}</small>
        <b>${Math.round(have)}</b><span class="muted small"> / ${goal}g</span>
        <div class="bar"><div class="bar-fill" style="width:${Math.min(100, (have / goal) * 100)}%;background:${color}"></div></div>
      </div>`,
    )
    .join('');

  const water = state.water[day] ?? 0;
  $('#water-text').textContent = `${water} / ${t.waterOz} oz`;
  $('#water-bar').style.width = `${Math.min(100, (water / t.waterOz) * 100)}%`;

  const log = dayLog();
  $('#meals').innerHTML = MEALS.map(([key, label]) => {
    const items = log[key];
    const kcal = totals(items).calories;
    return `
      <div class="card meal">
        <div class="meal-head"><strong>${label}</strong><span class="meal-kcal">${kcal} kcal</span></div>
        ${items
          .map((e, i) => {
            const n = scale(e, e.servings);
            const srv = e.servings === 1 ? e.serving : `${e.servings} × ${e.serving}`;
            return `<div class="entry" data-meal="${key}" data-idx="${i}">
              <div><div class="entry-name">${esc(e.name)}${e.source === 'AI scan' ? '<span class="badge">AI</span>' : ''}</div>
              <div class="entry-sub">${esc(srv)} · P ${n.protein} · C ${n.carbs} · F ${n.fat}</div></div>
              <div class="entry-kcal">${n.calories}</div></div>`;
          })
          .join('')}
        <button class="add-row" data-add="${key}">＋ Add food</button>
      </div>`;
  }).join('');
}

// ---------- render: progress ----------
function lastNDays(n) {
  const out = [];
  const d = new Date(isoDate(new Date()) + 'T12:00:00');
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(isoDate(x));
  }
  return out;
}

function renderProgress() {
  const t = targets();
  const days = lastNDays(7);
  const cals = days.map((d) => totals(allEntries(d)).calories);
  const logged = Object.keys(state.diary).filter((d) => allEntries(d).length > 0);
  const loggedWeek = days.filter((d) => allEntries(d).length > 0);
  const avg = loggedWeek.length ? Math.round(cals.filter((c, i) => allEntries(days[i]).length).reduce((a, b) => a + b, 0) / loggedWeek.length) : 0;

  $('#stats').innerHTML = `
    <div class="stat"><b>${streak(logged, isoDate(new Date()))}🔥</b><small>Day streak</small></div>
    <div class="stat"><b>${avg || '—'}</b><small>Avg kcal (7d)</small></div>
    <div class="stat"><b>${loggedWeek.length}/7</b><small>Days logged</small></div>`;

  // bar chart
  const W = 320, H = 150, pad = 22, bw = 28;
  const max = Math.max(t.calories * 1.25, ...cals, 1);
  const y = (v) => H - pad - (v / max) * (H - pad - 10);
  const bars = days
    .map((d, i) => {
      const x = pad + i * ((W - pad * 2) / 7) + 6;
      const c = cals[i];
      const color = c === 0 ? 'var(--card-2)' : c > t.calories * 1.08 ? 'var(--over)' : 'var(--accent)';
      const lbl = new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' });
      return `<rect x="${x}" y="${y(c)}" width="${bw}" height="${Math.max(2, H - pad - y(c))}" rx="5" fill="${color}"/>
        <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${lbl}</text>
        ${c ? `<text x="${x + bw / 2}" y="${y(c) - 4}" text-anchor="middle">${c}</text>` : ''}`;
    })
    .join('');
  $('#week-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories per day">
    <line x1="${pad}" x2="${W - pad}" y1="${y(t.calories)}" y2="${y(t.calories)}" stroke="var(--muted)" stroke-dasharray="4 4"/>
    <text x="${W - pad}" y="${y(t.calories) - 4}" text-anchor="end">goal ${t.calories}</text>${bars}</svg>`;

  // macro averages
  const recent = logged.sort().slice(-7);
  if (recent.length === 0) {
    $('#macro-avg').innerHTML = '<p class="muted small">Log some food to see averages.</p>';
  } else {
    const sum = recent.map((d) => totals(allEntries(d))).reduce((a, b) => ({ protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }));
    $('#macro-avg').innerHTML = [
      ['Protein', sum.protein / recent.length, t.protein, 'var(--protein)'],
      ['Carbs', sum.carbs / recent.length, t.carbs, 'var(--carbs)'],
      ['Fat', sum.fat / recent.length, t.fat, 'var(--fat)'],
    ]
      .map(
        ([n, v, g, c]) => `<div style="margin-bottom:10px"><div class="row-between"><span>${n}</span><span class="muted small">${Math.round(v)}g avg · goal ${g}g · ${Math.round((v / g) * 100)}%</span></div>
        <div class="bar"><div class="bar-fill" style="width:${Math.min(100, (v / g) * 100)}%;background:${c}"></div></div></div>`,
      )
      .join('');
  }

  // weight
  const ws = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (ws.length >= 2) {
    const pts = ws.slice(-30);
    const lo = Math.min(...pts.map((p) => p.lb)) - 1, hi = Math.max(...pts.map((p) => p.lb)) + 1;
    const px = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
    const py = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.lb).toFixed(1)}`).join(' ');
    $('#weight-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${px(i)}" cy="${py(p.lb)}" r="3" fill="var(--accent)"/>`).join('')}
      <text x="${pad}" y="12">${hi.toFixed(0)} lb</text><text x="${pad}" y="${H - 6}">${lo.toFixed(0)} lb</text></svg>`;
  } else {
    $('#weight-chart').innerHTML = '<p class="muted small">Log your weight twice to see a trend. Weigh in the morning, same scale.</p>';
  }
  $('#weight-list').innerHTML = ws
    .slice(-10)
    .reverse()
    .map((w) => `<li><span>${new Date(w.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>${w.lb} lb <button data-del-weight="${w.date}" aria-label="Delete">✕</button></span></li>`)
    .join('');
}

// ---------- render: profile ----------
function fillSelect(sel, obj) {
  sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
}
function renderProfile() {
  const f = $('#profile-form');
  const p = state.profile;
  if (p) {
    f.sex.value = p.sex;
    f.age.value = p.age;
    f.heightFt.value = Math.floor(p.heightIn / 12);
    f.heightInRem.value = Math.round(p.heightIn % 12);
    f.weightLb.value = p.weightLb;
    f.goal.value = p.goal;
    f.activity.value = p.activity;
  }
  const t = targets();
  $('#targets-card').innerHTML = `<h3>Daily targets</h3>
    <div class="targets">
      <div><b>${t.calories}</b><small>Calories</small></div>
      <div><b>${t.protein}g</b><small>Protein</small></div>
      <div><b>${t.carbs}g</b><small>Carbs</small></div>
      <div><b>${t.fat}g</b><small>Fat</small></div>
      <div><b>${t.waterOz} oz</b><small>Water</small></div>
      <div><b>${state.targets?.tdee ?? '—'}</b><small>Est. burn (TDEE)</small></div>
    </div>
    ${p ? '' : '<p class="muted small">Fill in your profile above to personalize these.</p>'}`;
  const o = $('#custom-targets');
  for (const k of ['calories', 'protein', 'carbs', 'fat']) o[k].value = state.overrides?.[k] || '';
}

function render() {
  renderToday();
  const active = $('.view.active').id;
  if (active === 'view-progress') renderProgress();
  if (active === 'view-profile') renderProfile();
}

// ---------- logging ----------
function addEntry(food, meal, servings = 1) {
  const entry = { ...food, servings: Number(servings) || 1, addedAt: Date.now() };
  dayLog()[meal].push(entry);
  // recents: newest first, dedupe by name+serving
  const key = (f) => `${f.name}|${f.serving}`;
  const { servings: _s, addedAt: _a, ...base } = entry;
  state.recents = [base, ...state.recents.filter((r) => key(r) !== key(base))].slice(0, 30);
  save();
}

// ---------- add sheet ----------
const sheet = $('#add-sheet');
function openAdd(meal = defaultMeal(), pane = 'scan') {
  $('#add-meal').value = meal;
  switchPane(pane);
  sheet.showModal();
  if (pane === 'search') {
    showRecents();
    setTimeout(() => $('#search-input').focus(), 50);
  }
}
function switchPane(name) {
  $$('#add-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.pane === name));
  $$('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === name));
  if (name === 'search') showRecents();
  if (name !== 'barcode') stopCamera();
}

function foodLi(f) {
  return `<li data-food='${esc(JSON.stringify(f))}'>
    <div><div class="entry-name">${esc(f.name)}</div>
    <div class="entry-sub">${esc(f.serving)} · ${f.calories} kcal · P ${f.protein} · C ${f.carbs} · F ${f.fat}${f.source === 'Open Food Facts' ? ' · <span class="badge">brand</span>' : ''}</div></div>
    <span class="add-plus">＋</span></li>`;
}
function showRecents() {
  if ($('#search-input').value.trim()) return;
  const list = [...state.custom.map((c) => ({ ...c, source: 'custom' })), ...state.recents];
  $('#search-section-label').textContent = list.length ? 'Recent & custom' : 'Start typing to search 70+ built-in foods and millions of branded products.';
  $('#search-results').innerHTML = list.map(foodLi).join('');
}

let searchTimer, searchSeq = 0;
$('#search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) return showRecents();
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    $('#search-section-label').innerHTML = '<span class="spinner"></span>Searching…';
    // Custom and recent foods match first, instantly.
    const ql = q.toLowerCase();
    const mine = [...state.custom, ...state.recents].filter((f) => f.name.toLowerCase().includes(ql));
    try {
      const r = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`).then((x) => x.json());
      if (seq !== searchSeq) return;
      const all = [...mine, ...r.results];
      $('#search-section-label').textContent = all.length ? (r.online ? '' : 'Offline: built-in foods only') : 'No matches. Try Quick add or Describe.';
      $('#search-results').innerHTML = all.map(foodLi).join('');
    } catch {
      $('#search-section-label').textContent = 'Search failed — is the server running?';
    }
  }, 280);
});
$('#search-results').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-food]');
  if (li) openFood(JSON.parse(li.dataset.food), { meal: $('#add-meal').value });
});

// ---------- food detail dialog ----------
const fd = $('#food-dialog');
let fdCtx = null;
function openFood(food, { meal, idx = null, servings = 1 }) {
  fdCtx = { food, meal, idx };
  $('#fd-name').textContent = food.name;
  $('#fd-meta').textContent = `${food.serving} per serving · ${food.source ?? ''}`;
  $('#fd-servings').value = servings;
  $('#fd-delete').hidden = idx === null;
  $('#fd-save').textContent = idx === null ? 'Add to ' + MEALS.find(([k]) => k === meal)[1] : 'Update';
  updateFdMacros();
  fd.showModal();
}
function updateFdMacros() {
  const n = scale(fdCtx.food, $('#fd-servings').value);
  $('#fd-macros').innerHTML = `<div><b>${n.calories}</b><small>kcal</small></div><div><b>${n.protein}</b><small>protein</small></div><div><b>${n.carbs}</b><small>carbs</small></div><div><b>${n.fat}</b><small>fat</small></div>`;
}
$('#fd-servings').addEventListener('input', updateFdMacros);
$('#fd-save').addEventListener('click', () => {
  const s = Number($('#fd-servings').value);
  if (!(s > 0)) return toast('Servings must be more than 0');
  if (fdCtx.idx === null) {
    addEntry(fdCtx.food, fdCtx.meal, s);
    toast(`Added ${fdCtx.food.name}`);
    sheet.close();
  } else {
    dayLog()[fdCtx.meal][fdCtx.idx].servings = s;
    save();
  }
  fd.close();
  render();
});
$('#fd-delete').addEventListener('click', () => {
  dayLog()[fdCtx.meal].splice(fdCtx.idx, 1);
  save();
  fd.close();
  render();
  toast('Removed');
});

// ---------- AI photo scan ----------
let photo = null; // { base64, mediaType }
$('#photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    photo = await compressImage(file);
    const img = $('#photo-preview');
    img.src = `data:${photo.mediaType};base64,${photo.base64}`;
    img.hidden = false;
    $('#photo-hint').hidden = true;
    $('#analyze-btn').disabled = !aiEnabled;
  } catch {
    toast("Couldn't read that image");
  }
});

/** Downscale to ≤1280px JPEG so uploads are fast and under the API limit. */
async function compressImage(file) {
  const bmp = await createImageBitmap(file);
  const scaleBy = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scaleBy);
  c.height = Math.round(bmp.height * scaleBy);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.85);
  return { base64: url.split(',')[1], mediaType: 'image/jpeg' };
}

async function runAnalyze(body, statusEl, btn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Analyzing…';
  statusEl.textContent = '';
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');
    openReview(data);
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}
$('#analyze-btn').addEventListener('click', () => {
  if (!photo) return;
  runAnalyze({ imageBase64: photo.base64, mediaType: photo.mediaType, text: $('#photo-note').value }, $('#ai-status'), $('#analyze-btn'));
});
$('#describe-btn').addEventListener('click', () => {
  const text = $('#describe-input').value.trim();
  if (!text) return toast('Describe what you ate first');
  runAnalyze({ text }, $('#describe-status'), $('#describe-btn'));
});

// ---------- AI review dialog ----------
const rv = $('#review-dialog');
let rvItems = [];
function openReview(meal) {
  rvItems = meal.items.map((it) => ({ ...it, servings: 1 }));
  $('#rv-title').textContent = meal.meal_name;
  $('#rv-notes').textContent = meal.notes;
  renderReview();
  rv.showModal();
}
function renderReview() {
  $('#rv-items').innerHTML = rvItems
    .map(
      (it, i) => `<li data-i="${i}">
      <div class="rv-top">
        <input type="text" data-k="name" value="${esc(it.name)}" />
        <span class="conf ${it.confidence}">${it.confidence}</span>
        <button class="icon-btn" data-remove="${i}" aria-label="Remove item">✕</button>
      </div>
      <div class="muted small">${esc(it.serving)}${it.grams ? ` (~${it.grams} g)` : ''}</div>
      <div class="rv-nums">
        <label>× portion<input type="number" step="0.25" min="0" data-k="servings" value="${it.servings}" /></label>
        <label>kcal<input type="number" min="0" data-k="calories" value="${it.calories}" /></label>
        <label>P<input type="number" step="0.1" min="0" data-k="protein" value="${it.protein}" /></label>
        <label>C<input type="number" step="0.1" min="0" data-k="carbs" value="${it.carbs}" /></label>
        <label>F<input type="number" step="0.1" min="0" data-k="fat" value="${it.fat}" /></label>
      </div></li>`,
    )
    .join('');
  renderReviewTotal();
}
function renderReviewTotal() {
  const t = totals(rvItems);
  $('#rv-total').innerHTML = `<div><b>${t.calories}</b><small>kcal</small></div><div><b>${Math.round(t.protein)}</b><small>protein</small></div><div><b>${Math.round(t.carbs)}</b><small>carbs</small></div><div><b>${Math.round(t.fat)}</b><small>fat</small></div>`;
  $('#rv-log').disabled = rvItems.length === 0;
}
$('#rv-items').addEventListener('input', (e) => {
  const k = e.target.dataset.k;
  const i = Number(e.target.closest('li').dataset.i);
  if (!k) return;
  rvItems[i][k] = k === 'name' ? e.target.value : Number(e.target.value) || 0;
  renderReviewTotal();
});
$('#rv-items').addEventListener('click', (e) => {
  const r = e.target.closest('[data-remove]');
  if (!r) return;
  rvItems.splice(Number(r.dataset.remove), 1);
  renderReview();
});
$('#rv-log').addEventListener('click', () => {
  const meal = $('#add-meal').value;
  for (const it of rvItems) {
    if (it.servings > 0) addEntry({ ...it, servings: undefined }, meal, it.servings);
  }
  rv.close();
  sheet.close();
  resetScan();
  render();
  toast(`Logged ${rvItems.length} item${rvItems.length === 1 ? '' : 's'} to ${MEALS.find(([k]) => k === meal)[1]}`);
});
function resetScan() {
  photo = null;
  $('#photo-input').value = '';
  $('#photo-preview').hidden = true;
  $('#photo-hint').hidden = false;
  $('#photo-note').value = '';
  $('#describe-input').value = '';
  $('#analyze-btn').disabled = true;
}

// ---------- barcode ----------
let stream = null, scanLoop = null;
async function lookupBarcode(code) {
  $('#barcode-status').innerHTML = '<span class="spinner"></span>Looking up…';
  try {
    const res = await fetch(`/api/barcode/${code}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Not found');
    $('#barcode-status').textContent = '';
    openFood(data, { meal: $('#add-meal').value });
  } catch (err) {
    $('#barcode-status').textContent = `${err.message}. Try Search or Quick add.`;
  }
}
$('#barcode-form').addEventListener('submit', (e) => {
  e.preventDefault();
  lookupBarcode($('#barcode-input').value.trim());
});
if ('BarcodeDetector' in window) {
  $('#barcode-cam-btn').hidden = false;
  $('#barcode-cam-btn').addEventListener('click', startCamera);
}
async function startCamera() {
  try {
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('#barcode-video');
    v.srcObject = stream;
    v.hidden = false;
    await v.play();
    $('#barcode-status').textContent = 'Point at the barcode…';
    scanLoop = setInterval(async () => {
      const codes = await detector.detect(v).catch(() => []);
      if (codes.length) {
        const code = codes[0].rawValue;
        stopCamera();
        $('#barcode-input').value = code;
        lookupBarcode(code);
      }
    }, 300);
  } catch {
    $('#barcode-status').textContent = 'Camera unavailable — type the digits instead.';
  }
}
function stopCamera() {
  clearInterval(scanLoop);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $('#barcode-video').hidden = true;
}
sheet.addEventListener('close', stopCamera);

// ---------- quick add ----------
$('#quick-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const food = {
    id: `custom-${Date.now()}`,
    source: 'custom',
    name: f.name.value.trim() || 'Quick add',
    serving: '1 serving',
    calories: Number(f.calories.value) || 0,
    protein: Number(f.protein.value) || 0,
    carbs: Number(f.carbs.value) || 0,
    fat: Number(f.fat.value) || 0,
    fiber: 0,
  };
  if (f.save.checked) state.custom = [food, ...state.custom.filter((c) => c.name !== food.name)];
  addEntry(food, $('#add-meal').value, 1);
  f.reset();
  sheet.close();
  render();
  toast(`Added ${food.name}`);
});

// ---------- wiring ----------
$('#add-meal').innerHTML = MEALS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
$('#add-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-pane]');
  if (b) switchPane(b.dataset.pane);
});
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach((d) => d.addEventListener('click', (e) => e.target === d && d.close()));

$('#fab').addEventListener('click', () => openAdd(day === isoDate(new Date()) ? defaultMeal() : 'snacks', 'scan'));
$('#meals').addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) return openAdd(add.dataset.add, 'search');
  const row = e.target.closest('.entry');
  if (row) {
    const entry = dayLog()[row.dataset.meal][Number(row.dataset.idx)];
    openFood(entry, { meal: row.dataset.meal, idx: Number(row.dataset.idx), servings: entry.servings });
  }
});
$$('[data-water]').forEach((b) =>
  b.addEventListener('click', () => {
    state.water[day] = Math.max(0, (state.water[day] ?? 0) + Number(b.dataset.water));
    save();
    renderToday();
  }),
);
$('#prev-day').addEventListener('click', () => shiftDay(-1));
$('#next-day').addEventListener('click', () => shiftDay(1));
function shiftDay(n) {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  if (isoDate(d) > isoDate(new Date())) return;
  day = isoDate(d);
  renderToday();
}

$$('.tab[data-view]').forEach((t) =>
  t.addEventListener('click', () => {
    $$('.tab[data-view]').forEach((x) => x.classList.toggle('active', x === t));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${t.dataset.view}`));
    $('.topbar').style.visibility = t.dataset.view === 'today' ? 'visible' : 'hidden';
    render();
    window.scrollTo(0, 0);
  }),
);

fillSelect($('#goal-select'), GOALS);
fillSelect($('#activity-select'), ACTIVITY);
$('#activity-select').value = 'very';
$('#goal-select').value = 'maintain';

$('#profile-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const profile = {
    sex: f.sex.value,
    age: Number(f.age.value),
    heightIn: Number(f.heightFt.value) * 12 + Number(f.heightInRem.value),
    weightLb: Number(f.weightLb.value),
    goal: f.goal.value,
    activity: f.activity.value,
  };
  try {
    state.targets = computeTargets(profile);
    state.profile = profile;
    save();
    renderProfile();
    toast(`Target set: ${targets().calories} kcal/day`);
  } catch (err) {
    toast(err.message);
  }
});
$('#custom-targets').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  state.overrides = Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map((k) => [k, Number(f[k].value) || 0]));
  save();
  renderProfile();
  toast('Targets saved');
});
$('#weight-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const lb = Number($('#weight-input').value);
  const today = isoDate(new Date());
  state.weights = [...state.weights.filter((w) => w.date !== today), { date: today, lb }];
  if (state.profile) {
    state.profile.weightLb = lb;
    state.targets = computeTargets(state.profile);
  }
  save();
  $('#weight-input').value = '';
  renderProgress();
  toast('Weight logged — targets updated');
});
$('#weight-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-del-weight]');
  if (!b) return;
  state.weights = state.weights.filter((w) => w.date !== b.dataset.delWeight);
  save();
  renderProgress();
});
$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `macrolens-${isoDate(new Date())}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import-file').addEventListener('change', async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (typeof data !== 'object' || !data.diary) throw new Error();
    state = { ...blank(), ...data };
    save();
    render();
    toast('Backup restored');
  } catch {
    toast('That file is not a MacroLens backup');
  }
});

// ---------- boot ----------
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => {
    aiEnabled = s.ai;
    if (!aiEnabled) {
      $('#ai-status').textContent = 'AI scanning is off on this server (no API key). Search, barcode and quick add still work.';
      $('#describe-status').textContent = 'AI is off on this server (no API key).';
      $('#describe-btn').disabled = true;
    }
  })
  .catch(() => {});

render();
if (!state.profile) {
  $('.tab[data-view="profile"]').click();
  toast('Set up your profile to get your targets');
}
