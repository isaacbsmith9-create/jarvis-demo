# UNDERWORLD — vertical slice

A 3D browser open-world crime/empire game set in **San Aurelio**. This slice
covers one district, **The Narrows**.

Stack: React 18 + TypeScript + Vite 5, three.js via @react-three/fiber, zustand.

## Run

```bash
cd underworld
npm install
npm run dev        # http://localhost:5173 (also on your LAN: open it on your phone)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

## Controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Move | WASD / arrow keys | Left virtual stick |
| Sprint | Shift | RUN button, or push the stick to its edge |
| Upgrade owned business | F / Space (or the HUD button) | ACT/UPGRD button |
| Turn camera | Q / E, or drag | Drag anywhere off the controls |
| Pause / title | Esc | Menu button |

## Gameplay loop

- **Takeovers** — 8 businesses, each with a gold capture zone on the sidewalk.
  Stand in it for 3–6 s (longer for richer businesses). Leaving drains progress.
- **Income** — owned businesses pay every 5 s. Upgrades (Lv 1→4) multiply income
  by 1 / 1.6 / 2.4 / 3.5×.
- **Heat** — each takeover adds heat (12–34). Heat decays 1.2/s, or 0.25/s while chased.
  - 40+ heat (2 stars): patrols chase you if they see you (line of sight, 26 m).
  - 4+ stars: dispatch — every unit knows where you are.
  - Each star rolls one more unit out of the SAPD 9th Precinct.
  - Units are slightly slower than your sprint: break line of sight or outrun them past 55 m.
  - **Busted** on contact: lose 25% of cash (min $100), heat resets to 10, respawn at the plaza.
- **Save** — autosaves to `localStorage` every 5 s, on every takeover/upgrade/bust,
  and when the tab hides. Every storage call is in try/catch; the game runs normally
  with storage blocked. Loaded saves are validated field by field.

All tuning lives in `src/game/config.ts`.

## Code map

```
src/
  App.tsx              canvas, lighting, title screen, menu, world init
  game/
    config.ts          all tuning: player, city, businesses, economy, heat/police
    city.ts            seeded district layout, landmarks, colliders, road graph
    world.ts           per-frame mutable state + collision helpers
    store.ts           zustand store: cash, heat, owned levels, UI state
    GameLoop.tsx       rules: zones, capture, income, upgrades, heat, busts
    police.ts          patrol / chase / bust AI on the intersection graph
    save.ts            localStorage save/load/autosave
    input.ts           keyboard + touch input, merged into one move intent
    textures.ts        code-drawn placeholder art
    assets.ts          swaps in files from /public/assets when listed in manifest
  scene/               City, Businesses (storefronts + zones), Police, Player
  ui/                  HUD, Minimap, TouchControls
public/assets/         drop-in art (see public/assets/README.md)
```

Per-frame state (positions, capture progress) stays in plain mutable objects
read inside `useFrame`; the zustand store only changes when something the HUD
shows changes, so React never re-renders at 60 fps.

## Swapping in generated art

See `public/assets/README.md`. Put a file in `public/assets/...`, list it in
`public/assets/manifest.json`, reload. Signs, the building facade tile and the
asphalt texture are wired up today; anything unlisted falls back to the
code-drawn placeholder without a network request.

## Dev hooks

In `npm run dev` only, `window.__world`, `window.__game` (zustand store) and
`window.__layout` are exposed for debugging and automated smoke tests, and
`window.__aerial = true` switches to an overhead camera.
