// Food tab: the MacroLens diary in the Baseline design. Reads/writes ml:core and ml:day-*.
import { esc, todayIso, shiftIso, relDay, shortDate, dayLabel, clamp, r1, fmtNum, avg, haptic, $, $$ } from './util.js';
import * as ml from './ml.js';
import { on, sheet, sheetOf, toast, icon, ring, donut, bar, barChart, confirmTap, go, profileBtn } from './ui.js';
import { ai, scanFood, aiError } from './ai.js';
import { inClaude } from './store.js';

let fday = todayIso();
let lastToday = todayIso();
const syncDay = () => { if (lastToday !== todayIso()) { if (fday === lastToday) fday = todayIso(); lastToday = todayIso(); } };
export const setDay = (iso) => { fday = iso; };

const MEAL_COLORS = { breakfast: 'var(--m-breakfast)', lunch: 'var(--m-lunch)', dinner: 'var(--m-dinner)', snacks: 'var(--m-snacks)' };
const fmtG = (v) => `${Math.round(v)}`;

// ===================== root =====================
export function render(rest) {
  syncDay();
  if (rest[0] === 'nutrition') return renderNutrition(rest[1] || 'calories');
  const iso = fday, d = ml.day(iso) || ml.blankDay(), t = ml.targets(iso), tot = ml.totals(ml.entriesOf(iso)), c = ml.core();
  const left = t.calories - tot.calories, dtype = d.type || 'training', isToday = iso === todayIso();
  const setup = !c.profile && !c.targets;
  const caff = Math.round(ml.entriesOf(iso).reduce((a, e) => a + ml.caffeineOf(e), 0));
  return `
  <header class="lt"><div><div class="eyebrow">${esc(shortDate(iso))}</div><h1>Food</h1></div>
    <div class="actions"><button class="icon-btn" data-act="openSearchOnly" aria-label="Search foods">${icon('search')}</button>${profileBtn()}</div></header>

  <div class="card tight" style="display:flex;align-items:center;gap:8px;padding:6px">
    <button class="icon-btn plain" data-act="fdayShift" data-n="-1" aria-label="Previous day">${icon('back')}</button>
    <button class="grow btn ghost" data-act="fdayToday" style="color:var(--fg);font-weight:700;font-size:17px">${esc(relDay(iso))}</button>
    <button class="icon-btn plain" data-act="fdayShift" data-n="1" aria-label="Next day" ${isToday ? 'disabled style="opacity:.3"' : ''}>${icon('chev')}</button>
  </div>

  ${setup ? `<div class="card" style="margin-top:12px;background:var(--accent-soft)"><h3>Set your targets</h3><p class="sm" style="margin:4px 0 12px;color:var(--fg-2)">Age, height, weight and how hard you train. Baseline works out your calories, protein, carbs, fat and water.</p><button class="btn primary block" data-act="openProfile">Set targets</button></div>` : ''}

  <div class="card" style="margin-top:12px">
    <div class="row-sb" style="margin-bottom:12px"><h3>Calories</h3>
      <div class="seg" role="group" aria-label="Day type" style="width:auto">${[['training', 'Training'], ['heavy', 'Heavy'], ['rest', 'Rest']].map(([k, l]) => `<button type="button" data-act="dayType" data-type="${k}" aria-pressed="${dtype === k}">${l}</button>`).join('')}</div></div>
    <div class="hero" style="grid-template-columns:132px 1fr">
      ${ring({ pct: t.calories ? tot.calories / t.calories : 0, size: 132, stroke: 13, color: 'var(--cal)', label: `${tot.calories} of ${t.calories} calories`, center: `<b style="font-size:30px">${fmtNum(Math.abs(left))}</b><span>${left < 0 ? 'over' : 'left'}</span>` })}
      <div class="legend3">
        <div class="lg"><i style="--c:var(--surface-3)"></i><span>Goal</span><b>${fmtNum(t.calories)}</b></div>
        <div class="lg"><i style="--c:var(--cal)"></i><span>Food</span><b>${fmtNum(tot.calories)}</b></div>
        <div class="lg"><i style="--c:${left < 0 ? 'var(--over)' : 'var(--fg-2)'}"></i><span>${left < 0 ? 'Over' : 'Remaining'}</span><b>${fmtNum(Math.abs(left))}</b></div>
      </div>
    </div>
    ${t.adj ? `<div class="note good" style="margin-top:12px">Targets raised today. ${esc(t.adj.join(' · '))}.</div>` : ''}
    ${t.rest ? `<div class="note" style="margin-top:12px">Rest day: 30% fewer carbs, same protein.</div>` : ''}
    <div style="height:14px"></div>
    ${macroRings(t, tot)}
    <button class="btn tinted block" style="margin-top:14px" data-act="go" data-href="#food-nutrition">${icon('chart')} Nutrition</button>
  </div>

  <div class="card">
    <div class="row-sb"><div><h3>Water</h3><div class="sub num">${d.water || 0} of ${t.waterOz} oz</div></div>
      <div class="row-g"><button class="btn sm" data-act="water" data-oz="-8" aria-label="Remove 8 ounces">−8</button><button class="btn sm tinted" data-act="water" data-oz="8">+8</button><button class="btn sm tinted" data-act="water" data-oz="16">+16</button></div></div>
    <div style="margin-top:12px">${waterGlasses(d.water || 0, t.waterOz)}</div>
  </div>

  ${caff ? `<div class="card"><div class="row-sb"><h3>Caffeine</h3><span class="pill ${caff > 100 ? 'bad' : 'good'} num">${caff} mg</span></div><p class="sm muted" style="margin:6px 0 0">${caff > 100 ? 'Over 100 mg, the daily max for teens. Too much hurts sleep, and sleep is when you recover.' : 'Under the 100 mg teen limit.'}</p></div>` : ''}

  ${ml.MEALS.map(([k, label]) => mealCard(iso, d, k, label)).join('')}
  `;
}
function macroRings(t, tot) {
  return `<div class="mrings">${[['Protein', tot.protein, t.protein, 'var(--protein)'], ['Carbs', tot.carbs, t.carbs, 'var(--carbs)'], ['Fat', tot.fat, t.fat, 'var(--fat)']].map(([n, have, goal, c]) => {
    const l = Math.round(goal - have);
    return `<button type="button" class="mring" data-act="go" data-href="#food-nutrition-macros" aria-label="${n}: ${Math.round(have)} of ${goal} grams">
      ${ring({ pct: goal ? have / goal : 0, size: 88, stroke: 9, color: c, center: `<b class="num">${Math.round(have)}</b><span>/${goal}g</span>` })}
      <small>${n}</small><span class="left${l < 0 ? ' over' : ''}">${l >= 0 ? `${l}g left` : `${-l}g over`}</span></button>`;
  }).join('')}</div>`;
}
function waterGlasses(oz, goal) {
  const n = Math.max(8, Math.min(16, Math.round(goal / 8))), per = goal / n, full = oz / per;
  return `<div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:4px" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<div style="height:26px;border-radius:6px;background:var(--surface-2);overflow:hidden;display:flex;align-items:flex-end"><div style="width:100%;height:${clamp(full - i) * 100}%;background:var(--water);border-radius:6px"></div></div>`).join('')}</div>`;
}
function mealCard(iso, d, k, label) {
  const items = d[k] || [], mt = ml.totals(items), yItems = ml.day(shiftIso(iso, -1))?.[k] || [];
  return `<div class="sh"><h2 style="display:flex;align-items:center;gap:8px"><span class="dot" style="--c:${MEAL_COLORS[k]}"></span>${label}</h2><span class="num muted" style="font-size:15px">${items.length ? `${fmtNum(mt.calories)} cal` : ''}</span></div>
  <div class="list">
    ${items.map((e, i) => { const n = ml.scale(e, e.servings ?? 1), srv = (e.servings ?? 1) === 1 ? e.serving : `${r1(e.servings)} × ${e.serving}`;
      return `<button type="button" class="li" data-act="editEntry" data-meal="${k}" data-i="${i}"><span class="tx"><div class="t1">${esc(e.name)}</div><div class="t2">${esc(srv || '')} · P ${fmtG(n.protein)} · C ${fmtG(n.carbs)} · F ${fmtG(n.fat)}</div></span><span class="val num">${fmtNum(n.calories)}</span></button>`; }).join('')}
    <button type="button" class="li" data-act="addFood" data-meal="${k}" style="color:var(--accent)"><span class="ic" style="--ic:var(--accent-soft);color:var(--accent)">${icon('plus', 2.4)}</span><span class="tx"><div class="t1" style="color:var(--accent);font-weight:600">Add food</div></span></button>
  </div>
  ${items.length ? `<div class="list-foot row-sb"><span class="num">P ${fmtG(mt.protein)} g · C ${fmtG(mt.carbs)} g · F ${fmtG(mt.fat)} g</span><button class="btn ghost sm" data-act="saveMeal" data-meal="${k}">Save meal</button></div>`
    : yItems.length ? `<div class="list-foot"><button class="btn ghost sm" style="padding:0" data-act="copyMeal" data-meal="${k}">${icon('copy')} Copy yesterday's ${label.toLowerCase()} (${yItems.length})</button></div>` : ''}`;
}

// ===================== diary actions =====================
on({
  fdayShift(el) { const n = Number(el.dataset.n), next = shiftIso(fday, n); if (next > todayIso()) return; fday = next; go('#food'); },
  fdayToday() { fday = todayIso(); go('#food'); },
  dayType(el) { ml.setDayType(fday, el.dataset.type); haptic(); },
  water(el) { const oz = Number(el.dataset.oz), v = ml.addWater(fday, oz); haptic(); if (oz > 0) toast(`${v} oz of water`); },
  addFood(el) { openAdd(el.dataset.meal, fday); },
  openSearchOnly() { openAdd(fday === todayIso() ? ml.defaultMeal() : 'snacks', fday); },
  copyMeal(el) { const k = el.dataset.meal; ml.snapshot(fday); const n = ml.copyMeal(shiftIso(fday, -1), fday, k); toast(`Copied ${n} item${n === 1 ? '' : 's'}`, () => ml.undo()); },
  saveMeal(el) { const name = ml.saveMealTemplate(fday, el.dataset.meal); if (name) toast(`Saved “${name}”. Find it in search.`); },
  editEntry(el) { openEntry(fday, el.dataset.meal, Number(el.dataset.i)); },
  openProfile() { openProfile(); },
});
export function openWater() {
  const s = sheet({ title: 'Water', left: { label: 'Done', close: true }, body: () => {
    const iso = todayIso(), oz = ml.day(iso)?.water || 0, goal = ml.targets(iso).waterOz;
    return `<div style="display:grid;justify-items:center;gap:6px;padding:8px 0 16px">${ring({ pct: oz / goal, size: 150, stroke: 14, color: 'var(--water)', center: `<b style="font-size:34px">${oz}</b><span>of ${goal} oz</span>` })}</div>
      <div class="grid3">${[8, 16, 24].map((n) => `<button class="btn tinted" style="background:color-mix(in srgb,var(--water) 16%,transparent);color:var(--water)" data-act="waterSheet" data-oz="${n}">+${n} oz</button>`).join('')}</div>
      <button class="btn block" style="margin-top:8px" data-act="waterSheet" data-oz="-8">Remove 8 oz</button>`; } });
  return s;
}
on({ waterSheet(el) { ml.addWater(todayIso(), Number(el.dataset.oz)); haptic(); sheetOf(el)?.refresh(); } });

// ===================== add food sheet =====================
let addCtx = { iso: todayIso(), meal: 'snacks', pane: 'search', q: '' };
export function openAdd(meal = ml.defaultMeal(), iso = todayIso()) {
  addCtx = { iso, meal, pane: ai.ready ? 'scan' : 'search', q: '', scan: { images: [], urls: [], text: '', busy: false, items: null, sel: new Set(), note: '' } };
  const s = sheet({ title: `Add to ${ml.mealLabel(meal)}`, left: { label: 'Close', close: true }, body: addBody,
    onMount: (api) => { if (matchMedia('(hover: hover)').matches) setTimeout(() => $('#food-q', api.el)?.focus(), 80); } });
  s.el.dataset.add = '1';
}
function addBody() {
  const p = addCtx.pane;
  return `<div class="chips" style="margin-bottom:12px">${ml.MEALS.map(([k, l]) => `<button type="button" class="chip" data-act="addMeal" data-meal="${k}" aria-pressed="${addCtx.meal === k}"><i style="--c:${MEAL_COLORS[k]}"></i>${l}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Add by" style="margin-bottom:12px">${[...(ai.ready ? [['scan', 'Scan']] : []), ['search', 'Search'], ['quick', 'Quick add'], ['barcode', 'Barcode']].map(([k, l]) => `<button type="button" data-act="addPane" data-pane="${k}" aria-pressed="${p === k}">${l}</button>`).join('')}</div>
    <div id="add-pane">${p === 'scan' ? scanPane() : p === 'search' ? searchPane() : p === 'quick' ? quickPane() : barcodePane()}</div>`;
}
function searchPane() {
  return `<label class="search"><span class="sr">Search foods</span>${icon('search')}<input class="input" id="food-q" type="search" placeholder="Search ${ml.FOODS.length}+ foods, your foods and meals" autocomplete="off" value="${esc(addCtx.q)}" data-input="foodSearch"></label>
    <div id="food-results" style="margin-top:12px">${resultsHtml()}</div>`;
}
function resultsHtml() {
  const { meals, foods } = ml.searchFoods(addCtx.q);
  if (!meals.length && !foods.length) return addCtx.q ? `<div class="empty"><b>No match</b>Try fewer words, or use Quick add to enter the numbers from the label.<br><br><button class="btn tinted" data-act="addPane" data-pane="quick">Quick add “${esc(addCtx.q)}”</button></div>` : `<div class="empty">Your recent foods and saved meals show up here. Start typing to search.</div>`;
  return `${!addCtx.q ? '<div class="label" style="margin:0 4px 6px">Recent and saved</div>' : ''}<div class="list">
    ${meals.map((m, i) => { const t = ml.totals(m.items); return `<button type="button" class="li" data-act="pickMeal" data-i="${i}"><span class="tx"><div class="t1">${esc(m.name)} <span class="pill accent" style="margin-left:4px">MEAL</span></div><div class="t2">${m.items.length} items · ${fmtNum(t.calories)} cal · P ${fmtG(t.protein)}</div></span><span class="ic" style="--ic:var(--accent-soft);color:var(--accent);width:30px;height:30px;border-radius:50%">${icon('plus', 2.4)}</span></button>`; }).join('')}
    ${foods.map((f, i) => `<button type="button" class="li" data-act="pickFood" data-i="${i}"><span class="tx"><div class="t1">${esc(f.name)}</div><div class="t2">${esc(f.serving || '')} · ${fmtNum(f.calories)} cal · P ${fmtG(f.protein)} · C ${fmtG(f.carbs)} · F ${fmtG(f.fat)}</div></span><span class="ic" style="--ic:var(--accent-soft);color:var(--accent);width:30px;height:30px;border-radius:50%" data-act="quickPick" data-i="${i}" role="button" aria-label="Add 1 serving">${icon('plus', 2.4)}</span></button>`).join('')}
  </div>`;
}
function quickPane() {
  return `<form class="stack" data-submit="foodQuickAdd">
    <label class="field"><span>Name</span><input class="input" name="name" placeholder="e.g. Chipotle bowl" value="${esc(addCtx.q)}" maxlength="80"></label>
    <div class="fields2"><label class="field"><span>Calories</span><input class="input" name="calories" inputmode="decimal" required placeholder="0"></label><label class="field"><span>Protein (g)</span><input class="input" name="protein" inputmode="decimal" placeholder="0"></label></div>
    <div class="fields2"><label class="field"><span>Carbs (g)</span><input class="input" name="carbs" inputmode="decimal" placeholder="0"></label><label class="field"><span>Fat (g)</span><input class="input" name="fat" inputmode="decimal" placeholder="0"></label></div>
    <details><summary class="sm muted" style="cursor:pointer;padding:4px 0">More nutrients (optional)</summary>
      <div class="fields3" style="margin-top:10px"><label class="field"><span>Fiber g</span><input class="input" name="fiber" inputmode="decimal"></label><label class="field"><span>Sugar g</span><input class="input" name="sugar" inputmode="decimal"></label><label class="field"><span>Sodium mg</span><input class="input" name="sodium" inputmode="decimal"></label></div></details>
    <label class="row-sb" style="padding:4px 2px"><span>Save to my foods</span><span class="switch"><input type="checkbox" name="save" checked><span></span></span></label>
    <button class="btn primary block">Add to ${esc(ml.mealLabel(addCtx.meal))}</button></form>`;
}
function scanPane() {
  const sc = addCtx.scan;
  if (sc.items) {
    const tot = ml.totals(sc.items.filter((_, i) => sc.sel.has(i)));
    return `${sc.urls.length ? `<div class="row-g" style="margin-bottom:10px">${sc.urls.map((u) => `<img src="${u}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:12px">`).join('')}</div>` : ''}
      ${sc.items.length ? `<div class="list">${sc.items.map((f, i) => `<div class="li"><button type="button" class="check${sc.sel.has(i) ? ' on' : ''}" data-act="scanSel" data-i="${i}" aria-label="Include ${esc(f.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
        <span class="tx"><div class="t1">${esc(f.name)}${f.confidence === 'low' ? ' <span class="pill warn">check</span>' : ''}</div><div class="t2">${esc(f.serving)} · P ${Math.round(f.protein)} · C ${Math.round(f.carbs)} · F ${Math.round(f.fat)}</div></span><span class="val num">${fmtNum(f.calories)}</span></div>`).join('')}</div>` : '<div class="card empty">No food found. Try another photo or describe it.</div>'}
      ${sc.note ? `<p class="sm muted" style="margin:8px 4px">${esc(sc.note)}</p>` : ''}
      <div class="stack-sm" style="margin-top:12px">${sc.items.length ? `<button class="btn primary block" data-act="scanAdd" ${sc.sel.size ? '' : 'disabled'}>Add ${sc.sel.size} item${sc.sel.size === 1 ? '' : 's'} · ${fmtNum(tot.calories)} cal</button>` : ''}<button class="btn block" data-act="scanReset">Scan something else</button></div>`;
  }
  return `<div class="stack">
    <label class="btn tinted block" style="position:relative;min-height:120px;flex-direction:column;gap:8px;border-radius:18px">${icon('food')}<span>${sc.urls.length ? `${sc.urls.length} photo${sc.urls.length === 1 ? '' : 's'} ready · tap to add more` : 'Take or choose a photo'}</span>
      <input type="file" accept="image/*" multiple data-change="scanPhoto" style="position:absolute;inset:0;opacity:0" aria-label="Food photo"></label>
    ${sc.urls.length ? `<div class="row-g">${sc.urls.map((u) => `<img src="${u}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:12px">`).join('')}</div>` : ''}
    <label class="field"><span>Or describe it (optional with a photo)</span><textarea class="input" style="min-height:70px" placeholder="e.g. half a Chipotle chicken bowl, extra rice" data-input="scanText">${esc(sc.text)}</textarea></label>
    <button class="btn primary block" data-act="scanGo" ${sc.busy ? 'disabled' : ''}>${sc.busy ? 'Looking at your food… (10-30 s)' : 'Estimate nutrition'}</button>
    <p class="xs muted" style="margin:0">AI estimates. Check portions before adding.</p></div>`;
}
function barcodePane() {
  return `<form class="stack" data-submit="barcode">
    <p class="sm muted" style="margin:0">Type the numbers under the barcode. Baseline looks it up in Open Food Facts and remembers it.</p>
    <input class="input num" name="code" inputmode="numeric" pattern="[0-9 ]*" placeholder="e.g. 012000161155" autocomplete="off" style="font-size:20px;letter-spacing:.06em">
    ${'BarcodeDetector' in window ? `<label class="btn tinted block" style="position:relative">${icon('barcode')} Scan with camera<input type="file" accept="image/*" capture="environment" data-change="barcodePhoto" style="position:absolute;inset:0;opacity:0"></label>` : ''}
    <button class="btn primary block">Look up</button><div id="bc-status" class="sm muted"></div></form>`;
}
const curAddSheet = () => $('dialog[data-add]')?._sheet;
on({
  addPane(el) { addCtx.pane = el.dataset.pane; sheetOf(el).refresh(); },
  addMeal(el) { addCtx.meal = el.dataset.meal; const s = sheetOf(el); s.el.querySelector('.sheet-head h2').textContent = `Add to ${ml.mealLabel(addCtx.meal)}`; $$('[data-act="addMeal"]', s.el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.meal === addCtx.meal))); const btn = $('form[data-submit="foodQuickAdd"] .btn.primary', s.el); if (btn) btn.textContent = `Add to ${ml.mealLabel(addCtx.meal)}`; },
  foodSearch(el) { addCtx.q = el.value; $('#food-results').innerHTML = resultsHtml(); },
  pickFood(el, e) { if (e.target.closest('[data-act="quickPick"]')) return; const f = ml.searchFoods(addCtx.q).foods[Number(el.dataset.i)]; if (f) openFoodDetail(f); },
  quickPick(el) { const f = ml.searchFoods(addCtx.q).foods[Number(el.dataset.i)]; if (!f) return; commitAdd(f, 1); },
  pickMeal(el) {
    const m = ml.searchFoods(addCtx.q).meals[Number(el.dataset.i)]; if (!m) return;
    ml.snapshot(addCtx.iso); for (const it of m.items) ml.addEntry(addCtx.iso, addCtx.meal, it, it.servings ?? 1);
    curAddSheet()?.close(); haptic(); toast(`Added ${m.name}`, () => ml.undo());
  },
  foodQuickAdd(form) {
    const fd = new FormData(form), num = (k) => Number(fd.get(k)) || 0;
    const food = { id: 'c' + Date.now(), source: 'custom', name: String(fd.get('name') || '').trim() || 'Quick add', serving: '1 serving', calories: num('calories'), protein: num('protein'), carbs: num('carbs'), fat: num('fat') };
    for (const k of ['fiber', 'sugar', 'sodium']) if (String(fd.get(k) || '') !== '') food[k] = num(k);
    if (!food.calories && !food.protein && !food.carbs && !food.fat) return toast('Enter at least the calories');
    if (fd.get('save')) ml.saveCustom(food);
    commitAdd(food, 1);
  },
  async barcode(form) {
    const code = String(new FormData(form).get('code') || '').replace(/\D/g, ''), st = $('#bc-status');
    if (code.length < 8 || code.length > 14) { st.textContent = 'Barcodes are 8 to 14 digits.'; return; }
    st.textContent = 'Looking it up…';
    if (inClaude() && !ml.core().barcodes?.[code]) { st.textContent = 'Barcode lookup only works in the website version of Baseline. Snap the Nutrition Facts label in Scan instead.'; return; }
    try { const f = await ml.fetchBarcode(code); if (!f) { st.textContent = `Barcode ${code} isn't in the database yet. Use Quick add with the numbers from the label.`; return; } st.textContent = ''; openFoodDetail(f); }
    catch { st.textContent = navigator.onLine ? 'Lookup failed. Try again in a second.' : "You're offline. Use Quick add for now."; }
  },
  async barcodePhoto(el) {
    const file = el.files?.[0]; if (!file) return; const st = $('#bc-status');
    try { const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }), r = await det.detect(await createImageBitmap(file));
      if (r[0]?.rawValue) { const inp = $('input[name="code"]', el.closest('form')); inp.value = r[0].rawValue; el.closest('form').requestSubmit(); } else st.textContent = "Couldn't read a barcode in that photo. Type the numbers instead."; }
    catch { st.textContent = "Couldn't read that photo. Type the numbers instead."; }
  },
});
const refreshPane = () => { const el = $('#add-pane'); if (el) el.innerHTML = addCtx.pane === 'scan' ? scanPane() : el.innerHTML; };
on({
  scanPhoto(el) {
    const sc = addCtx.scan;
    for (const f of [...(el.files || [])].slice(0, 4 - sc.images.length)) { sc.images.push(f); sc.urls.push(URL.createObjectURL(f)); }
    refreshPane();
  },
  scanText(el) { addCtx.scan.text = el.value; },
  async scanGo() {
    const sc = addCtx.scan; if (!sc.images.length && !sc.text.trim()) return toast('Add a photo or describe the food');
    sc.busy = true; refreshPane();
    try { const r = await scanFood({ images: sc.images, text: sc.text.trim(), profile: ml.core().profile }); sc.items = r.items; sc.note = r.note; sc.sel = new Set(r.items.map((_, i) => i)); }
    catch (e) { toast(aiError(e)); }
    sc.busy = false; refreshPane();
  },
  scanSel(el) { const sc = addCtx.scan, i = Number(el.dataset.i); if (sc.sel.has(i)) sc.sel.delete(i); else sc.sel.add(i); haptic(); refreshPane(); },
  scanReset() { addCtx.scan = { images: [], urls: [], text: '', busy: false, items: null, sel: new Set(), note: '' }; refreshPane(); },
  scanAdd() {
    const sc = addCtx.scan, picked = sc.items.filter((_, i) => sc.sel.has(i)); if (!picked.length) return;
    ml.snapshot(addCtx.iso); for (const f of picked) ml.addEntry(addCtx.iso, addCtx.meal, f, 1);
    const tot = ml.totals(picked); curAddSheet()?.close(); haptic(12); toast(`Added ${picked.length} item${picked.length === 1 ? '' : 's'} · ${fmtNum(tot.calories)} cal`, () => ml.undo());
  },
});
function commitAdd(food, servings) {
  ml.snapshot(addCtx.iso); ml.addEntry(addCtx.iso, addCtx.meal, food, servings);
  $$('dialog[data-detail]').forEach((d) => d._sheet.close()); curAddSheet()?.close(); haptic(12);
  const n = ml.scale(food, servings);
  toast(`${food.name} · ${n.calories} cal`, () => ml.undo());
}

// ===================== food detail (servings) =====================
function openFoodDetail(food, { servings = 1 } = {}) {
  const st = { s: servings };
  const s = sheet({ title: 'Add food', left: { label: 'Back', close: true }, right: { label: 'Add', act: 'detailAdd' }, body: () => detailBody(food, st), data: { food, st } });
  s.el.dataset.detail = '1';
}
function detailBody(food, st, meal = addCtx.meal) {
  const n = ml.scale(food, st.s), kc = n.protein * 4 + n.carbs * 4 + n.fat * 9 || 1;
  return `<div style="padding:4px 0 12px"><h3 style="font-size:22px;margin:0">${esc(food.name)}</h3><div class="muted sm" style="margin-top:2px">${esc(food.serving || '1 serving')}${food.source === 'barcode' ? ' · from barcode' : ''}</div></div>
    <div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center">
      ${donut([{ v: n.protein * 4, color: 'var(--protein)' }, { v: n.carbs * 4, color: 'var(--carbs)' }, { v: n.fat * 9, color: 'var(--fat)' }], { size: 104, stroke: 12, center: `<b style="font-size:24px">${n.calories}</b><span>cal</span>`, label: 'Macro split' })}
      <div class="stack-sm">${[['Protein', n.protein, 'var(--protein)', n.protein * 4], ['Carbs', n.carbs, 'var(--carbs)', n.carbs * 4], ['Fat', n.fat, 'var(--fat)', n.fat * 9]].map(([l, g, c, k]) => `<div class="row-sb"><span class="row-g" style="gap:6px"><span class="dot" style="--c:${c}"></span>${l}</span><span class="num b">${r1(g)} g <span class="muted" style="font-weight:400">${Math.round((k / kc) * 100)}%</span></span></div>`).join('')}</div>
    </div>
    <div class="card"><div class="row-sb"><span class="b">Servings</span>
      <div class="stepper"><button type="button" data-act="srv" data-d="-0.5" aria-label="Fewer">−</button><input class="num" inputmode="decimal" value="${st.s}" data-input="srvIn" aria-label="Servings"><button type="button" data-act="srv" data-d="0.5" aria-label="More">+</button></div></div>
      <div class="wrap-chips" style="margin-top:12px">${[0.5, 1, 1.5, 2, 3].map((v) => `<button type="button" class="chip${st.s === v ? ' on' : ''}" data-act="srvSet" data-v="${v}">${v}×</button>`).join('')}</div></div>
    ${ml.MICROS.some((m) => n[m.k] != null) ? `<div class="list" style="margin-top:12px">${ml.MICROS.filter((m) => n[m.k] != null).map((m) => `<div class="li" style="min-height:44px"><span class="tx">${m.label}</span><span class="val num">${n[m.k]} ${m.unit}</span></div>`).join('')}</div>` : ''}
    <button class="btn primary block" style="margin-top:16px" data-act="detailAdd">Add to ${esc(ml.mealLabel(meal))}</button>`;
}
on({
  srv(el) { const s = sheetOf(el), st = s.data.st; st.s = Math.max(0.25, r1(st.s + Number(el.dataset.d))); s.refresh(); },
  srvSet(el) { const s = sheetOf(el); s.data.st.s = Number(el.dataset.v); s.refresh(); },
  srvIn(el) { const s = sheetOf(el), v = Number(el.value); if (v > 0) s.data.st.s = v; },
  detailAdd(el) { const s = sheetOf(el), { food, st } = s.data; commitAdd(food, st.s); },
});

// ===================== edit an entry =====================
function openEntry(iso, meal, idx) {
  const e = ml.day(iso)?.[meal]?.[idx]; if (!e) return;
  const st = { s: e.servings ?? 1, meal };
  sheet({ title: 'Edit food', right: { label: 'Save', act: 'entrySave' }, data: { iso, meal, idx, st, e }, body: (api) => {
    const n = ml.scale(e, st.s);
    return `<div style="padding:4px 0 12px"><h3 style="font-size:22px;margin:0">${esc(e.name)}</h3><div class="muted sm">${esc(e.serving || '')}</div></div>
      <div class="grid4">${[['Cal', n.calories, ''], ['Protein', n.protein, 'g'], ['Carbs', n.carbs, 'g'], ['Fat', n.fat, 'g']].map(([l, v, u]) => `<div class="stat"><b>${Math.round(v)}<small>${u}</small></b><span>${l}</span></div>`).join('')}</div>
      <div class="card" style="margin-top:12px"><div class="row-sb"><span class="b">Servings</span><div class="stepper"><button type="button" data-act="srv" data-d="-0.5" aria-label="Fewer">−</button><input class="num" inputmode="decimal" value="${st.s}" data-input="srvIn" aria-label="Servings"><button type="button" data-act="srv" data-d="0.5" aria-label="More">+</button></div></div></div>
      <div class="label" style="margin:16px 4px 8px">Meal</div>
      <div class="seg">${ml.MEALS.map(([k, l]) => `<button type="button" data-act="entryMeal" data-meal="${k}" aria-pressed="${st.meal === k}">${l}</button>`).join('')}</div>
      <div class="stack-sm" style="margin-top:20px"><button class="btn primary block" data-act="entrySave">Save</button><button class="btn danger block" data-act="entryDelete">Delete</button></div>`;
  } });
}
on({
  entryMeal(el) { const s = sheetOf(el); s.data.st.meal = el.dataset.meal; s.refresh(); },
  entrySave(el) { const s = sheetOf(el), { iso, meal, idx, st } = s.data; ml.snapshot(iso); ml.updateEntry(iso, meal, idx, { servings: st.s }, st.meal); s.close(); toast('Saved', () => ml.undo()); },
  entryDelete(el) { if (!confirmTap(el)) return; const s = sheetOf(el), { iso, meal, idx, e } = s.data; ml.snapshot(iso); ml.removeEntry(iso, meal, idx); s.close(); toast(`Removed ${e.name}`, () => ml.undo()); },
});

// ===================== profile / targets =====================
export function openProfile() {
  const c = ml.core(), p = c.profile || { age: 16, sex: 'male', heightIn: 70, weightLb: 160, activity: 'athlete', goal: 'maintain' };
  sheet({ title: 'Your targets', right: { label: 'Save', act: 'profileSave' }, body: () => `<form class="stack" id="profile-form" data-submit="profileSave">
    <div class="fields2"><label class="field"><span>Age</span><input class="input" name="age" inputmode="numeric" value="${p.age}"></label>
      <label class="field"><span>Sex</span><select class="input" name="sex"><option value="male"${p.sex !== 'female' ? ' selected' : ''}>Male</option><option value="female"${p.sex === 'female' ? ' selected' : ''}>Female</option></select></label></div>
    <div class="fields3"><label class="field"><span>Height ft</span><input class="input" name="ft" inputmode="numeric" value="${Math.floor(p.heightIn / 12)}"></label><label class="field"><span>in</span><input class="input" name="in" inputmode="numeric" value="${Math.round(p.heightIn % 12)}"></label><label class="field"><span>Weight lb</span><input class="input" name="weightLb" inputmode="decimal" value="${p.weightLb}"></label></div>
    <label class="field"><span>Activity</span><select class="input" name="activity">${Object.entries(ml.ACTIVITY).map(([k, a]) => `<option value="${k}"${p.activity === k ? ' selected' : ''}>${a.label}</option>`).join('')}</select></label>
    <label class="field"><span>Goal</span><select class="input" name="goal">${Object.entries(ml.GOALS).map(([k, a]) => `<option value="${k}"${p.goal === k ? ' selected' : ''}>${a.label}</option>`).join('')}</select></label>
    <div class="label" style="margin-top:6px">Custom targets (optional, overrides the math)</div>
    <div class="fields4">${[['calories', 'Cal'], ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, l]) => `<label class="field"><span>${l}</span><input class="input" name="o_${k}" inputmode="numeric" placeholder="auto" value="${c.overrides?.[k] || ''}"></label>`).join('')}</div>
    <label class="field"><span>Water goal override (oz)</span><input class="input" name="o_waterOz" inputmode="numeric" placeholder="auto" value="${c.overrides?.waterOz || ''}"></label>
    ${c.targets ? `<div class="note">Current: ${fmtNum(c.targets.calories)} cal · ${c.targets.protein} g protein · ${c.targets.carbs} g carbs · ${c.targets.fat} g fat · ${c.targets.waterOz} oz water</div>` : ''}
    <button class="btn primary block">Save targets</button></form>` });
}
on({
  profileSave(el) {
    const form = el.closest('dialog').querySelector('#profile-form'), fd = new FormData(form), n = (k) => Number(fd.get(k));
    const p = { age: n('age'), sex: fd.get('sex'), heightIn: n('ft') * 12 + n('in'), weightLb: n('weightLb'), activity: fd.get('activity'), goal: fd.get('goal') };
    let tg; try { tg = ml.computeTargets(p); } catch (e) { return toast(e.message); }
    ml.saveCore((c) => { c.profile = p; c.targets = tg; c.overrides = {}; for (const k of ['calories', 'protein', 'carbs', 'fat', 'waterOz']) { const v = n('o_' + k); if (v > 0) c.overrides[k] = v; } });
    sheetOf(el).close(); toast(`Targets set: ${fmtNum(ml.targets(todayIso()).calories)} cal`);
  },
});

// ===================== nutrition screen =====================
let nvMode = 'day';
function renderNutrition(tab) {
  const days = nvMode === 'day' ? [fday] : ml.dayDates(7, fday), logged = days.filter((d) => ml.entriesOf(d).length);
  const n = Math.max(1, nvMode === 'day' ? 1 : logged.length);
  const tg = ml.targets(fday), tots = days.map((d) => ml.totals(ml.entriesOf(d)));
  const avgT = Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'iron', 'calcium'].map((k) => [k, tots.reduce((a, t) => a + (t[k] || 0), 0) / n]));
  let body = '';
  if (tab === 'calories') {
    const byMeal = ml.MEALS.map(([k, l]) => ({ k, l, v: days.reduce((a, d) => a + ml.totals(ml.day(d)?.[k] || []).calories, 0) / n }));
    const tot = byMeal.reduce((a, m) => a + m.v, 0);
    body = `<div class="card"><div style="display:grid;justify-items:center;padding:4px 0 12px">${donut(byMeal.map((m) => ({ v: m.v, color: MEAL_COLORS[m.k] })), { size: 168, stroke: 22, center: `<b style="font-size:30px">${fmtNum(tot)}</b><span>${nvMode === 'day' ? 'calories' : 'avg / day'}</span>`, label: 'Calories by meal' })}</div>
      <div class="stack-sm">${byMeal.map((m) => `<div class="row-sb"><span class="row-g" style="gap:8px"><span class="dot" style="--c:${MEAL_COLORS[m.k]}"></span>${m.l}</span><span class="num b">${tot ? Math.round((m.v / tot) * 100) : 0}% <span class="muted" style="font-weight:400">(${fmtNum(m.v)})</span></span></div>`).join('')}</div></div>
      ${nvMode === 'week' ? `<div class="card"><div class="card-head"><h3>Calories per day</h3><span class="num muted sm">goal ${fmtNum(tg.calories)}</span></div><div class="chart" id="nv-week"></div></div>` : ''}
      <div class="list" style="margin-top:12px">${[['Total calories', fmtNum(avgT.calories)], ['Goal', fmtNum(tg.calories)], ['Net vs goal', `${avgT.calories - tg.calories > 0 ? '+' : ''}${fmtNum(avgT.calories - tg.calories)}`]].map(([l, v]) => `<div class="li" style="min-height:46px"><span class="tx">${l}</span><span class="val num">${v}</span></div>`).join('')}</div>
      ${topFoods(days, n, 'calories', 'cal')}`;
  } else if (tab === 'nutrients') {
    const mt = ml.microTargets(tg);
    const rows = [['Calories', 'calories', tg.calories, '', 'goal'], ['Protein', 'protein', tg.protein, 'g', 'goal'], ['Carbs', 'carbs', tg.carbs, 'g', 'goal'], ['Fat', 'fat', tg.fat, 'g', 'goal'],
      ...ml.MICROS.map((m) => [m.label, m.k, mt[m.k], m.unit, m.kind])];
    body = `<div class="list"><div class="li" style="min-height:36px"><span class="tx label">Nutrient</span><span class="label" style="width:56px;text-align:right">Total</span><span class="label" style="width:56px;text-align:right">Goal</span><span class="label" style="width:56px;text-align:right">Left</span></div>
      ${rows.map(([l, k, g, u, kind]) => { const v = avgT[k] || 0, left = g - v, bad = kind === 'limit' ? v > g : false;
        return `<div class="li" style="flex-wrap:wrap;row-gap:6px"><span class="tx b" style="font-weight:500">${l}${kind === 'limit' ? ' <span class="muted xs">limit</span>' : ''}</span><span class="num" style="width:56px;text-align:right">${fmtNum(v)}</span><span class="num muted" style="width:56px;text-align:right">${fmtNum(g)}</span><span class="num b" style="width:56px;text-align:right;color:${bad || left < 0 ? 'var(--over)' : 'var(--fg)'}">${fmtNum(left)}</span>
        <div style="flex-basis:100%">${bar(g ? v / g : 0, kind === 'limit' ? (bad ? 'var(--over)' : 'var(--warn)') : k === 'protein' ? 'var(--protein)' : k === 'carbs' ? 'var(--carbs)' : k === 'fat' ? 'var(--fat)' : 'var(--accent)', false)}</div></div>`; }).join('')}</div>
      ${tots.some((t) => t.missing) ? `<p class="sm muted" style="margin:8px 4px">Some foods have no micronutrient data, so those totals may be low.</p>` : ''}`;
  } else {
    const kc = { p: avgT.protein * 4, c: avgT.carbs * 4, f: avgT.fat * 9 }, sumK = kc.p + kc.c + kc.f || 1, gk = { p: tg.protein * 4, c: tg.carbs * 4, f: tg.fat * 9 }, sumG = gk.p + gk.c + gk.f || 1;
    body = `<div class="card"><div style="display:grid;justify-items:center;padding:4px 0 12px">${donut([{ v: kc.p, color: 'var(--protein)' }, { v: kc.c, color: 'var(--carbs)' }, { v: kc.f, color: 'var(--fat)' }], { size: 168, stroke: 22, center: `<b style="font-size:26px">${fmtNum(avgT.protein)}g</b><span>protein</span>`, label: 'Macro split' })}</div>
      <div class="list" style="box-shadow:none;background:var(--surface-2)"><div class="li" style="min-height:34px"><span class="tx label">Macro</span><span class="label" style="width:64px;text-align:right">Total</span><span class="label" style="width:56px;text-align:right">Goal</span></div>
      ${[['Protein', 'p', 'protein', 'var(--protein)'], ['Carbs', 'c', 'carbs', 'var(--carbs)'], ['Fat', 'f', 'fat', 'var(--fat)']].map(([l, k, key, c]) => `<div class="li"><span class="tx row-g" style="gap:8px"><span class="dot" style="--c:${c}"></span>${l} <span class="muted sm num">${fmtNum(avgT[key])} g</span></span><span class="num b" style="width:64px;text-align:right">${Math.round((kc[k] / sumK) * 100)}%</span><span class="num muted" style="width:56px;text-align:right">${Math.round((gk[k] / sumG) * 100)}%</span></div>`).join('')}</div></div>
      ${nvMode === 'week' ? `<div class="card"><div class="card-head"><h3>Protein per day</h3><span class="num muted sm">goal ${tg.protein} g</span></div><div class="chart" id="nv-week"></div></div>` : ''}
      ${topFoods(days, n, 'protein', 'g')}`;
  }
  return `<nav class="navbar"><button class="back" data-act="go" data-href="#food">${icon('back', 2.4)}Food</button><h2>Nutrition</h2><span class="right"></span></nav>
    <div class="seg" style="margin-bottom:10px">${[['calories', 'Calories'], ['nutrients', 'Nutrients'], ['macros', 'Macros']].map(([k, l]) => `<button type="button" data-act="go" data-href="#food-nutrition-${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
    <div class="row-sb" style="margin:0 2px 12px"><span class="sm muted">${nvMode === 'day' ? esc(relDay(fday) + ' · ' + shortDate(fday)) : `${shortDate(days[0])} – ${shortDate(days[6])} · avg of ${logged.length} logged day${logged.length === 1 ? '' : 's'}`}</span>
      <div class="seg" style="width:140px">${[['day', 'Day'], ['week', 'Week']].map(([k, l]) => `<button type="button" data-act="nvMode" data-m="${k}" aria-pressed="${nvMode === k}">${l}</button>`).join('')}</div></div>
    ${body}`;
}
function topFoods(days, n, key, unit) {
  const foods = new Map();
  for (const d of days) for (const [m, l] of ml.MEALS) for (const e of ml.day(d)?.[m] || []) { const v = ml.scale(e, e.servings ?? 1), f = foods.get(e.name) || { name: e.name, meals: new Set(), v: 0, n: 0 }; f.meals.add(l); f.n++; f.v += v[key] / n; foods.set(e.name, f); }
  const top = [...foods.values()].sort((a, b) => b.v - a.v).slice(0, 8);
  return `<div class="sh"><h2>Top foods</h2><span class="sm muted">by ${key}</span></div>${top.length ? `<div class="list">${top.map((f) => `<div class="li"><span class="tx"><div class="t1">${esc(f.name)}</div><div class="t2">${[...f.meals].join(', ')}${f.n > 1 ? ` · ${f.n}×` : ''}</div></span><span class="val num">${fmtNum(f.v)} ${unit}</span></div>`).join('')}</div>` : '<div class="card empty">Nothing logged yet.</div>'}`;
}
on({ nvMode(el) { nvMode = el.dataset.m; go(location.hash); } });

export function mount(root, rest) {
  if (rest[0] === 'nutrition' && nvMode === 'week') {
    const el = root.querySelector('#nv-week'); if (!el) return;
    const days = ml.dayDates(7, fday), tab = rest[1] || 'calories', key = tab === 'macros' ? 'protein' : 'calories';
    const vals = days.map((d) => { const t = ml.totals(ml.entriesOf(d)); return ml.entriesOf(d).length ? t[key] : null; });
    barChart(el, days, vals, { color: key === 'protein' ? 'var(--protein)' : 'var(--cal)', target: days.map((d) => ml.targets(d)[key]), name: key === 'protein' ? 'Protein' : 'Calories', unit: key === 'protein' ? ' g' : '', targetName: 'Goal' });
  }
}
