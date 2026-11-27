import { create } from 'zustand';
import { BUSINESSES, ECONOMY, HEAT } from './config';

export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info' | 'money';
}

export interface GameState {
  cash: number;
  heat: number;
  /** business id -> level (1..maxLevel). Missing = not owned. */
  owned: Record<string, number>;
  totalEarned: number;
  busts: number;
  /** capture in progress (UI mirror of loop state) */
  capture: { id: string; progress: number } | null;
  /** business zone the player is standing in */
  zoneId: string | null;
  chased: boolean;
  paused: boolean;
  payoutIn: number;
  lastPayout: { amount: number; at: number } | null;
  busted: { penalty: number; at: number } | null;
  toasts: Toast[];

  addCash: (n: number) => void;
  setHeat: (h: number) => void;
  takeOver: (id: string) => void;
  upgrade: (id: string) => boolean;
  bust: () => number;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  reset: () => void;
}

let toastId = 1;

export const incomePerTick = (owned: Record<string, number>) =>
  BUSINESSES.reduce((sum, b) => sum + (owned[b.id] ? b.baseIncome * ECONOMY.levelMultiplier[owned[b.id]] : 0), 0);

export const territoryPct = (owned: Record<string, number>) =>
  Math.round((Object.keys(owned).length / BUSINESSES.length) * 100);

export const wantedStars = (heat: number) => HEAT.wanted.filter((t) => heat >= t).length;

const initial = () => ({
  cash: ECONOMY.startCash,
  heat: 0,
  owned: {} as Record<string, number>,
  totalEarned: 0,
  busts: 0,
  capture: null,
  zoneId: null,
  chased: false,
  paused: true,
  payoutIn: ECONOMY.payoutInterval,
  lastPayout: null,
  busted: null,
  toasts: [] as Toast[],
});

export const useGame = create<GameState>((set, get) => ({
  ...initial(),

  addCash: (n) =>
    set((s) => ({ cash: Math.max(0, Math.round(s.cash + n)), totalEarned: n > 0 ? s.totalEarned + n : s.totalEarned })),

  setHeat: (h) => set({ heat: Math.max(0, Math.min(HEAT.max, h)) }),

  takeOver: (id) => {
    const def = BUSINESSES.find((b) => b.id === id);
    if (!def || get().owned[id]) return;
    set((s) => ({ owned: { ...s.owned, [id]: 1 }, heat: Math.min(HEAT.max, s.heat + def.heatGain) }));
    get().toast(`${def.name} is yours  (+${def.heatGain} heat)`, 'good');
  },

  upgrade: (id) => {
    const def = BUSINESSES.find((b) => b.id === id);
    const level = get().owned[id];
    if (!def || !level || level >= ECONOMY.maxLevel) return false;
    const cost = ECONOMY.upgradeCost(def.baseIncome, level);
    if (get().cash < cost) {
      get().toast(`Need $${cost.toLocaleString()} to upgrade`, 'bad');
      return false;
    }
    set((s) => ({ cash: s.cash - cost, owned: { ...s.owned, [id]: level + 1 } }));
    get().toast(`${def.name} upgraded to Lv ${level + 1}`, 'good');
    return true;
  },

  bust: () => {
    const { cash } = get();
    const penalty = Math.min(cash, Math.max(HEAT.bustMinPenalty, Math.round(cash * HEAT.bustPenaltyPct)));
    set((s) => ({
      cash: s.cash - penalty,
      heat: HEAT.bustHeatAfter,
      busts: s.busts + 1,
      busted: { penalty, at: Date.now() },
      chased: false,
    }));
    return penalty;
  },

  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  reset: () => set(initial()),
}));
