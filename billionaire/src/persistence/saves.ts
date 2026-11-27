import type { GameState, Money } from '../types/core';
import { scenarioById } from '../data/scenarios/scenarios';
import { netWorth } from '../simulation/finance/valuation';
import { formatDate } from '../utils/date';
import { cloudDelete, cloudLoad, cloudManifest, cloudSave, getCloud } from './cloud';
import { validateState } from './schema';

/**
 * Save storage: five campaign slots. Each slot is kept in the player's claude.ai
 * account (cloud, see cloud.ts) when available, with a copy in this browser's
 * IndexedDB as a backup. 'autosave' is the legacy shared autosave slot from
 * earlier versions; it is still listed and loadable but no longer written.
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

export type SaveLocation = 'cloud' | 'device';

async function localPut(record: SaveRecord): Promise<boolean> {
  try {
    await tx('readwrite', (s) => s.put(record));
    return true;
  } catch {
    return false;
  }
}

async function localGet(slot: string): Promise<SaveRecord | undefined> {
  try {
    return (await tx('readonly', (s) => s.get(slot))) as SaveRecord | undefined;
  } catch {
    return undefined;
  }
}

async function localAll(): Promise<SaveRecord[]> {
  try {
    return (await tx('readonly', (s) => s.getAll())) as SaveRecord[];
  } catch {
    return [];
  }
}

/**
 * Save to a slot. Writes to your claude.ai account (cloud) when available, and
 * always keeps a copy in this browser as a backup. Resolves where it was stored.
 */
export async function saveGame(slot: string, state: GameState): Promise<SaveLocation[]> {
  // Validate before writing so a broken state never overwrites a good save.
  validateState(state);
  const summary = summarize(state);
  const savedAt = Date.now();
  // IndexedDB stores a structured clone, so the live state is snapshotted at this moment.
  const record: SaveRecord = { slot, savedAt, schemaVersion: state.schemaVersion, summary, data: state };
  const json = JSON.parse(JSON.stringify(state));
  const where: SaveLocation[] = [];
  if (await localPut(record)) where.push('device');
  const cloud = await getCloud();
  if (cloud) {
    try {
      await cloudSave(cloud, slot, json, summary, state.schemaVersion);
      where.push('cloud');
    } catch (e) {
      if (!where.length) throw e;
    }
  }
  if (!where.length) throw new Error('No storage is available in this browser.');
  return where;
}

/** Load a slot, preferring whichever copy (cloud or this device) is newer. */
export async function loadGame(slot: string): Promise<GameState> {
  const cloud = await getCloud();
  const [manifest, local] = await Promise.all([cloud ? cloudManifest(cloud, slot).catch(() => null) : null, localGet(slot)]);
  if (!manifest && !local) throw new Error('That save slot is empty.');
  const tryCloud = async () => validateState(await cloudLoad(cloud!, slot));
  const tryLocal = async () => validateState(structuredClone(local!.data));
  const order = manifest && (!local || manifest.savedAt >= local.savedAt) ? [tryCloud, local ? tryLocal : null] : [tryLocal, manifest ? tryCloud : null];
  let lastErr: unknown = null;
  for (const fn of order) {
    if (!fn) continue;
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Could not load this save.');
}

export async function deleteSave(slot: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(slot));
  } catch {
    /* no local storage */
  }
  const cloud = await getCloud();
  if (cloud) await cloudDelete(cloud, slot);
}

export interface SaveListingEx extends SaveListing {
  where: SaveLocation[];
}

/** Every save slot that has data, newest copy per slot. */
export async function listSaves(): Promise<SaveListingEx[]> {
  const cloud = await getCloud();
  const slots = [...MANUAL_SLOTS, AUTOSAVE_SLOT];
  const [locals, manifests] = await Promise.all([
    localAll(),
    cloud ? Promise.all(slots.map((s) => cloudManifest(cloud, s).catch(() => null))) : Promise.resolve(slots.map(() => null)),
  ]);
  const out: SaveListingEx[] = [];
  for (const [i, slot] of slots.entries()) {
    const m = manifests[i];
    const rec = locals.find((r) => r.slot === slot);
    if (!m && !rec) continue;
    let localError: string | null = null;
    if (rec) {
      try {
        validateState(structuredClone(rec.data));
      } catch (e) {
        localError = e instanceof Error ? e.message : 'Unreadable save.';
      }
    }
    const where: SaveLocation[] = [];
    if (m) where.push('cloud');
    if (rec && !localError) where.push('device');
    const newestCloud = m && (!rec || m.savedAt >= rec.savedAt);
    out.push({
      slot,
      savedAt: newestCloud ? m!.savedAt : rec!.savedAt ?? 0,
      summary: newestCloud ? m!.summary : rec!.summary ?? null,
      error: !m && localError ? localError : null,
      where,
    });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export { getCloud };

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
