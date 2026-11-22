// ===================== Athlete suite: shared across every page of the bundle =====================
// One app switcher (the app's name, top-left, on every page), one theme setting, one list of apps.
// Each page calls Suite.mount(el, '<app id>', beforeLeave) — beforeLeave saves pending changes before navigating.
(function () {
  const APPS = [
    { id: 'hub', name: 'Hub', plain: 'Hub', href: 'hub.html', desc: 'Every app in one place: your day, alerts and graphs', color: '#14b8a6' },
    { id: 'aos', name: 'Athlete<i>OS</i>', plain: 'Athlete OS', href: 'index.html', desc: 'Training, performance, load and the Lab', color: '#3d8bff' },
    { id: 'gp', name: 'Game<i>plan</i>', plain: 'Gameplan', href: 'gameplan.html', desc: 'Your day hour by hour, Top 3, night routine', color: '#22c55e' },
    { id: 'school', name: 'School', plain: 'School', href: 'school.html', desc: 'Classes, assignments, tests and grades', color: '#0ea5e9' },
    { id: 'btc', name: 'Training<i>Center</i>', plain: 'Training Center', href: 'btc.html', desc: 'Drills, workouts and running your sessions', color: '#f97316' },
    { id: 'ml', name: 'Macro<i>Lens</i>', plain: 'MacroLens', href: 'macrolens.html', desc: 'Food, macros, water and game-day fuel', color: '#eab308' },
  ];
  const THEME_KEY = 'macrolens-theme';
  function theme() {
    let c = 'dark'; try { c = localStorage.getItem(THEME_KEY) || 'dark'; } catch {}
    if (c === 'light' || c === 'dark') document.documentElement.setAttribute('data-theme', c); else document.documentElement.removeAttribute('data-theme');
  }
  const chev = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function mount(el, current, beforeLeave) {
    if (!el) return;
    const me = APPS.find((a) => a.id === current) || APPS[0];
    el.classList.add('suite');
    el.style.setProperty('--suite-c', me.color);
    el.innerHTML = `<button type="button" class="suite-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${me.plain}: switch app"><span class="suite-mark" aria-hidden="true"></span><span class="suite-name">${me.name}</span>${chev}</button>
      <div class="suite-menu" role="menu" hidden><div class="suite-head">Your apps · same data</div>${APPS.map((a) => `<a role="menuitem" class="suite-item${a.id === me.id ? ' on' : ''}" href="${a.href}" data-suite="${a.id}" style="--c:${a.color}" ${a.id === me.id ? 'aria-current="page"' : ''}><i></i><span><b>${a.plain}</b><small>${a.desc}</small></span>${a.id === me.id ? '<em>Here</em>' : ''}</a>`).join('')}</div>`;
    const btn = el.querySelector('.suite-btn'), menu = el.querySelector('.suite-menu');
    const set = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('.suite-item:not(.on)')?.focus(); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(menu.hidden); });
    document.addEventListener('click', (e) => { if (!el.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
    menu.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-suite]'); if (!a) return;
      e.preventDefault(); e.stopPropagation();
      if (a.dataset.suite === me.id) return set(false);
      a.classList.add('going');
      try { await Promise.race([Promise.resolve(beforeLeave?.()), new Promise((r) => setTimeout(r, 2500))]); } catch {}
      location.href = a.getAttribute('href');
    });
  }
  window.Suite = { APPS, mount, theme, THEME_KEY };
})();
