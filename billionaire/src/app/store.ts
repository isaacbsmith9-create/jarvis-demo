/**
 * Game store: owns the GameState, runs the clock, applies player actions and
 * notifies React (useSyncExternalStore) and Phaser (event listeners).
 * The simulation itself lives in src/simulation and knows nothing about this.
 */
import { useSyncExternalStore } from 'react';
import { getLayout } from './layout';
import { saveGame, type SaveLocation } from '../persistence/saves';
import { advanceDay } from '../simulation/engine';
import { createNewGame, type NewGameOptions } from '../simulation/newGame';
import type { ActionResult } from '../simulation/result';
import type { DistrictId, GameState } from '../types/core';

export type Screen = 'menu' | 'new' | 'game';
export type ViewId = 'dashboard' | 'city' | 'companies' | 'properties' | 'staff' | 'finance' | 'market' | 'news' | 'organization' | 'profile' | 'saves';
export type Speed = 0 | 1 | 2 | 3;

export const MS_PER_DAY: Record<Speed, number> = { 0: Infinity, 1: 1500, 2: 550, 3: 160 };

export interface Selection {
  propertyId: string | null;
  district: DistrictId | null;
  companyId: string | null;
  employeeId: string | null;
  rivalId: string | null;
}

export interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
}

export interface Modal {
  kind: 'found-company' | 'interior' | 'confirm' | 'branch' | 'executives';
  branchId?: string;
  propertyId?: string;
  companyId?: string;
  subtype?: string;
  title?: string;
  body?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
}

type Listener = () => void;

class GameStore {
  state: GameState | null = null;
  version = 0;
  screen: Screen = 'menu';
  view: ViewId = 'dashboard';
  speed: Speed = 0;
  selection: Selection = { propertyId: null, district: null, companyId: null, employeeId: null, rivalId: null };
  toasts: Toast[] = [];
  modal: Modal | null = null;
  lastSaved: number | null = null;
  /** The save slot (slot1..slot5) this campaign lives in; autosave writes here. */
  activeSlot: string | null = null;
  savedWhere: SaveLocation[] = [];
  private lastSavedDay = -1;
  private savePending = false;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  saving = false;
  cityFilter: DistrictId | null = null;
  /** One-shot camera focus requests for the city scene. */
  focusRequest: { propertyId: string; nonce: number } | null = null;

  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private accum = 0;
  private lastTick = 0;
  private toastId = 0;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;

  emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  /* ---------------- lifecycle ---------------- */

  startNewGame(opts: NewGameOptions, slot: string) {
    this.state = createNewGame(opts);
    this.activeSlot = slot;
    this.enterGame();
    void this.save(slot, true);
    this.toast('info', getLayout() === 'phone' ? 'Welcome to Miami. Time is paused: tap play at the top to begin.' : 'Welcome to Miami. Time is paused: press Space or use the speed controls to begin.');
  }

  /** `slot` is the slot the game came from; null for imported files and the old shared autosave. */
  loadState(state: GameState, slot: string | null) {
    this.state = state;
    this.activeSlot = slot && slot.startsWith('slot') ? slot : null;
    this.enterGame();
    this.lastSavedDay = state.day;
    this.toast('ok', this.activeSlot ? `Game loaded from Slot ${this.activeSlot.slice(4)}.` : 'Game loaded. Pick a save slot in Saves so it can autosave.');
  }

  private enterGame() {
    this.screen = 'game';
    this.view = 'dashboard';
    this.speed = 0;
    this.selection = { propertyId: null, district: null, companyId: null, employeeId: null, rivalId: null };
    this.modal = null;
    this.lastSaved = null;
    this.savedWhere = [];
    this.lastSavedDay = -1;
    this.startClock();
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    // Autosave every 30 seconds while time has moved since the last save.
    this.autosaveTimer = setInterval(() => {
      if (this.state && this.state.day !== this.lastSavedDay) void this.autosave();
    }, 30000);
    this.emit();
  }

  quitToMenu() {
    void this.autosave();
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    this.autosaveTimer = null;
    this.activeSlot = null;
    this.stopClock();
    this.state = null;
    this.screen = 'menu';
    this.modal = null;
    this.emit();
  }

  setScreen(s: Screen) {
    this.screen = s;
    this.emit();
  }

  /* ---------------- navigation ---------------- */

  setView(v: ViewId) {
    this.view = v;
    this.emit();
  }

  setCityFilter(d: DistrictId | null) {
    this.cityFilter = d;
    this.emit();
  }

  select(patch: Partial<Selection>) {
    this.selection = { ...this.selection, ...patch };
    this.emit();
  }

  openProperty(propertyId: string, goToCity = false) {
    this.selection = { ...this.selection, propertyId, district: this.state?.properties[propertyId]?.district ?? null };
    if (goToCity) {
      this.view = 'city';
      this.focusRequest = { propertyId, nonce: Date.now() };
    }
    this.emit();
  }

  openCompany(companyId: string) {
    this.selection = { ...this.selection, companyId };
    this.view = 'companies';
    this.emit();
  }

  openModal(m: Modal | null) {
    this.modal = m;
    if (m && this.speed > 0 && m.kind !== 'interior') this.setSpeed(0);
    this.emit();
  }

  /* ---------------- clock ---------------- */

  setSpeed(s: Speed) {
    this.speed = s;
    this.accum = 0;
    this.emit();
  }

  togglePause() {
    this.setSpeed(this.speed === 0 ? 1 : 0);
  }

  private startClock() {
    this.stopClock();
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.tick(), 50);
  }

  private stopClock() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    const now = performance.now();
    const dt = Math.min(500, now - this.lastTick);
    this.lastTick = now;
    if (!this.state || this.speed === 0) return;
    this.accum += dt;
    const per = MS_PER_DAY[this.speed];
    let days = 0;
    while (this.accum >= per && days < 4) {
      this.accum -= per;
      this.stepDay();
      days++;
    }
    if (days > 0) this.emit();
  }

  /** Advance one day immediately (used by the clock and the "next day" button). */
  stepDay() {
    if (!this.state) return;
    try {
      const report = advanceDay(this.state);
      if (report.newMonth) void this.autosave();
    } catch (e) {
      this.setSpeed(0);
      console.error(e);
      this.toast('error', `Simulation error: ${e instanceof Error ? e.message : String(e)}. Time paused.`);
    }
  }

  nextDay() {
    this.stepDay();
    this.emit();
  }

  /* ---------------- actions ---------------- */

  /** Run a simulation action, show its result and refresh views. */
  act(fn: (s: GameState) => ActionResult, opts: { quietSuccess?: boolean } = {}): ActionResult {
    if (!this.state) return { ok: false, message: 'No game loaded.' };
    let res: ActionResult;
    try {
      res = fn(this.state);
    } catch (e) {
      console.error(e);
      res = { ok: false, message: e instanceof Error ? e.message : 'Action failed.' };
    }
    if (!res.ok || !opts.quietSuccess) this.toast(res.ok ? 'ok' : 'error', res.message);
    this.emit();
    return res;
  }

  toast(kind: Toast['kind'], text: string) {
    const t = { id: ++this.toastId, kind, text };
    this.toasts = [...this.toasts.slice(-3), t];
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.emit();
    }, kind === 'error' ? 6000 : 4000);
    this.emit();
  }

  /* ---------------- saving ---------------- */

  /** Save to a slot. Saving to a different slot makes it this campaign's slot from then on. */
  async save(slot: string, silent = false): Promise<boolean> {
    if (!this.state) return false;
    if (this.saving) {
      // One save at a time; remember that another is wanted.
      this.savePending = true;
      return false;
    }
    const state = this.state;
    this.saving = true;
    this.activeSlot = slot;
    this.emit();
    try {
      const day = state.day;
      this.savedWhere = await saveGame(slot, state);
      this.lastSaved = Date.now();
      this.lastSavedDay = day;
      if (!silent) this.toast('ok', `Saved to Slot ${slot.slice(4)}${this.savedWhere.includes('cloud') ? ' (your account)' : ' (this browser only)'}.`);
      return true;
    } catch (e) {
      this.toast('error', `Save failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      this.saving = false;
      this.emit();
      if (this.savePending) {
        this.savePending = false;
        void this.autosave();
      }
    }
  }

  /** Save the current campaign into its own slot (does nothing until it has one). */
  async autosave() {
    if (this.state && this.activeSlot) await this.save(this.activeSlot, true);
  }

  quickSave() {
    if (this.activeSlot) void this.save(this.activeSlot);
    else {
      this.setView('saves');
      this.toast('info', 'Choose a slot to save this game in.');
    }
  }
}

export const store = new GameStore();

/** Re-render on every store change. */
export function useStore(): GameStore {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

/** The current game state; only call inside the in-game shell. */
export function useGame(): GameState {
  const s = useStore();
  if (!s.state) throw new Error('No game state');
  return s.state;
}

if (typeof window !== 'undefined') {
  (window as unknown as { __billionaire: GameStore }).__billionaire = store;
}
