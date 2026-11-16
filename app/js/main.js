// App shell: hash router, tab bar, re-render on data changes, quick add, theme, offline.
import { $, $$ } from './util.js';
import { onChange } from './store.js';
import { on, sheet, icon, hideTip, go, applyTheme } from './ui.js';
import { resetCache } from './insights.js';
import * as Today from './view.today.js';
import * as Food from './view.food.js';
import * as Train from './view.train.js';
import * as Plan from './view.plan.js';
import * as Progress from './view.progress.js';
import * as More from './view.more.js';

const VIEWS = { today: Today, food: Food, train: Train, plan: Plan, progress: Progress, more: More };
const TABS = ['today', 'food', 'train', 'plan', 'progress'];
let current = null;

function parse() {
  const [tab = 'today', ...rest] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { tab: VIEWS[tab] ? tab : 'today', rest };
}
export function render(keepScroll = false) {
  resetCache();
  const { tab, rest } = parse(), V = VIEWS[tab], root = $('#app');
  const key = tab + '/' + rest.join('/'), same = current === key, y = scrollY;
  const html = V.render(rest);
  root.innerHTML = `<div class="view${rest.length && tab !== 'plan' ? ' sub' : ''}" data-view="${tab}">${html}</div>`;
  if (same) root.firstElementChild.style.animation = 'none';
  V.mount?.(root.firstElementChild, rest);
  const tabName = tab === 'more' ? null : tab;
  $$('.tabbar a').forEach((a) => (a.dataset.tab === tabName ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  $('#fab').hidden = tab === 'more';
  if (same && keepScroll) scrollTo(0, y); else if (!same) scrollTo(0, 0);
  current = key;
  hideTip();
}

addEventListener('hashchange', () => render());
onChange(() => render(true));
// Time-based UI (next up, timers, countdowns) refreshes every minute; live clocks every second.
setInterval(() => { if (!document.hidden && !$('dialog.sheet[open]')) render(true); }, 60000);
setInterval(() => { for (const el of $$('[data-since]')) { const s = Math.max(0, Math.floor((Date.now() - Number(el.dataset.since)) / 1000)); el.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; } }, 1000);

// Tapping the active tab scrolls to top / pops back to the tab root.
$('.tabbar').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-tab]'); if (!a) return;
  const { tab, rest } = parse();
  if (a.dataset.tab === tab) { e.preventDefault(); if (rest.length && tab !== 'plan') location.hash = '#' + tab; else scrollTo({ top: 0, behavior: 'smooth' }); }
});

// ---------- quick add ----------
on({
  quickAdd() {
    const s = sheet({
      title: 'Quick add', left: { label: 'Close', close: true },
      body: `<div class="list">
        ${[['food', 'Log food', 'Search, quick add or scan a barcode', 'var(--cal)', 'qaFood'], ['water', 'Add water', '+8, +16 or +24 oz', 'var(--water)', 'qaWater'],
          ['train', 'Log a workout', 'Practice, lift, game, skill work', 'var(--c-practice)', 'qaWorkout'], ['heart', 'Morning check-in', 'Sleep, soreness, energy → readiness', 'var(--fat)', 'qaCheckin'],
          ['task', 'Add a task', 'Goes in your priority matrix', 'var(--warn)', 'qaTask'], ['plan', 'Add to the week', 'Homework, practice, work, anything', 'var(--c-lift)', 'qaWeek'],
          ['timer', 'Start a timer', 'Track homework, phone, practice', 'var(--c-phone)', 'qaTimer'], ['scale', 'Log weight', 'Morning weigh-in', 'var(--protein)', 'qaWeight']]
          .map(([ic, t, d, c, act]) => `<button type="button" class="li" data-act="${act}"><span class="ic" style="--ic:${c}">${icon(ic)}</span><span class="tx"><div class="t1">${t}</div><div class="t2">${d}</div></span></button>`).join('')}
      </div>`,
    });
    s.el.dataset.qa = '1';
  },
});
const closeQa = () => { const d = $('dialog[data-qa]'); d?._sheet.close(); };
on({
  qaFood() { closeQa(); Food.openAdd(); },
  qaWater() { closeQa(); Food.openWater(); },
  qaWorkout() { closeQa(); Train.openSession(); },
  qaCheckin() { closeQa(); Train.openCheckin(); },
  qaTask() { closeQa(); Plan.openTask(); },
  qaWeek() { closeQa(); Plan.openWbItem(); },
  qaTimer() { closeQa(); go('#plan/time'); },
  qaWeight() { closeQa(); Progress.openWeight(); },
  go(el) { go(el.dataset.href); },
  back(el) { if (history.length > 1 && el.dataset.soft !== '1') history.back(); else location.hash = el.dataset.href || '#today'; },
});

// ---------- theme ----------
const savedTheme = () => { try { return localStorage.getItem('bl:theme') || 'system'; } catch { return 'system'; } };
applyTheme(savedTheme());
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(savedTheme()));

// ---------- offline ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

if (!location.hash) history.replaceState(null, '', '#today');
render();
