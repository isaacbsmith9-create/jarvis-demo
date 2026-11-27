// localStorage persistence. Every access is wrapped: storage can be
// disabled, full, or throw in private mode — the game must run regardless.

import { BUSINESSES, ECONOMY, HEAT, SAVE_KEY } from './config';
import { useGame } from './store';
import { world } from './world';

interface SaveData {
  v: 1;
  cash: number;
  heat: number;
  owned: Record<string, number>;
  totalEarned: number;
  busts: number;
  player: { x: number; z: number };
  savedAt: number;
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (!d || d.v !== 1) return null;
    // validate every field so a hand-edited or stale save can't break the game
    const owned: Record<string, number> = {};
    for (const b of BUSINESSES) {
      const lvl = d.owned?.[b.id];
      if (typeof lvl === 'number' && lvl >= 1) owned[b.id] = Math.min(ECONOMY.maxLevel, Math.floor(lvl));
    }
    return {
      v: 1,
      cash: Math.max(0, num(d.cash, ECONOMY.startCash)),
      heat: Math.max(0, Math.min(HEAT.max, num(d.heat, 0))),
      owned,
      totalEarned: num(d.totalEarned, 0),
      busts: num(d.busts, 0),
      player: { x: num(d.player?.x, NaN), z: num(d.player?.z, NaN) },
      savedAt: num(d.savedAt, 0),
    };
  } catch {
    return null;
  }
}

export function applySave(d: SaveData) {
  useGame.setState({
    cash: d.cash,
    heat: d.heat,
    owned: d.owned,
    totalEarned: d.totalEarned,
    busts: d.busts,
  });
  if (Number.isFinite(d.player.x) && Number.isFinite(d.player.z)) {
    world.player.pos.set(d.player.x, 0, d.player.z);
  }
}

export function saveGame(): boolean {
  try {
    const s = useGame.getState();
    const data: SaveData = {
      v: 1,
      cash: s.cash,
      heat: s.heat,
      owned: s.owned,
      totalEarned: s.totalEarned,
      busts: s.busts,
      player: { x: +world.player.pos.x.toFixed(2), z: +world.player.pos.z.toFixed(2) },
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

let started = false;
/** Autosave on an interval, on any ownership/upgrade change, and when the tab hides. */
export function startAutosave(intervalMs = 5000) {
  if (started) return;
  started = true;
  setInterval(saveGame, intervalMs);
  useGame.subscribe((s, prev) => {
    if (s.owned !== prev.owned || s.busts !== prev.busts) saveGame();
  });
  const flush = () => saveGame();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
