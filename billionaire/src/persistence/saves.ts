import type { GameState, Money } from '../types/core';
import { scenarioById } from '../data/scenarios/scenarios';
import { netWorth } from '../simulation/finance/valuation';
import { formatDate } from '../utils/date';
import { validateState } from './schema';

/**
 * IndexedDB save storage. Each slot stores the full state plus a small summary
 * so the save list can be shown without parsing every game.
 */
const DB_NAME = 'billionaire';
const DB_VERSION = 1;
const STORE = 'saves';

export const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'] as const;
export const AUTOSAVE_SLOT = 'autosave';

export interface SaveSummary {
  playerName: string;
  scenario: string;
  date: string;
  day: number;
  netWorth: Money;
  companies: number;
}

export interface SaveRecord {
  slot: string;
  savedAt: number;
  schemaVersion: number;
  summary: SaveSummary;
  data: unknown;
}

export interface SaveListing {
  slot: string;
  savedAt: number;
  summary: SaveSummary | null;
  /** Non-null when the save can't be loaded. */
  error: string | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open save database.'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Save operation failed.'));
      }),
  );
}

export function summarize(state: GameState): SaveSummary {
  let scenario = state.player.scenarioId;
  try {
    scenario = scenarioById(state.player.scenarioId).title;
  } catch {
    /* unknown scenario id: keep raw id */
  }
  return {
    playerName: state.player.name,
    scenario,
    date: formatDate(state.day),
    day: state.day,
    netWorth: netWorth(state),
    companies: Object.values(state.companies).filter((c) => c.status !== 'closed').length,
  };
}

export async function saveGame(slot: string, state: GameState): Promise<void> {
  // Validate before writing so a broken state never overwrites a good save.
  validateState(state);
  // IndexedDB stores a structured clone, so the live state is snapshotted at this moment.
  const record: SaveRecord = { slot, savedAt: Date.now(), schemaVersion: state.schemaVersion, summary: summarize(state), data: state };
  await tx('readwrite', (s) => s.put(record));
}

export async function loadGame(slot: string): Promise<GameState> {
  const rec = (await tx('readonly', (s) => s.get(slot))) as SaveRecord | undefined;
  if (!rec) throw new Error('That save slot is empty.');
  return validateState(structuredClone(rec.data));
}

export async function deleteSave(slot: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(slot));
}

export async function listSaves(): Promise<SaveListing[]> {
  const all = (await tx('readonly', (s) => s.getAll())) as SaveRecord[];
  return all
    .map((rec): SaveListing => {
      try {
        validateState(structuredClone(rec.data));
        return { slot: rec.slot, savedAt: rec.savedAt, summary: rec.summary, error: null };
      } catch (e) {
        return { slot: rec.slot, savedAt: rec.savedAt ?? 0, summary: rec.summary ?? null, error: e instanceof Error ? e.message : 'Unreadable save.' };
      }
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** Export a save as a downloadable JSON string. */
export function exportState(state: GameState): string {
  return JSON.stringify({ format: 'billionaire-save', exportedAt: Date.now(), state });
}

export function importState(text: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const obj = parsed as { format?: string; state?: unknown };
  if (!obj || obj.format !== 'billionaire-save') throw new Error('Not a BILLIONAIRE save file.');
  return validateState(obj.state);
}
