/**
 * Cloud saves through the claude.ai artifact `db` capability.
 *
 * Each viewer's saves live under their private path `data/users/<id>/…`,
 * so they survive new versions of the game, cleared browser data and
 * switching devices. A save is gzip-compressed JSON split into chunks
 * (documents are capped at 256 KiB):
 *
 *   data/users/<id>/<slot>                 manifest {saveId, savedAt, summary, chunks}
 *   data/users/<id>/<slot>/chunks/<n>      {saveId, data}
 *
 * Chunks are written first and the manifest last, and every chunk carries
 * the manifest's saveId, so a half-written save is detected, never loaded.
 */
import type { SaveSummary } from './saves';

/* Minimal typings for the parts of the db/user capabilities we use. */
interface DocSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): { doc(id: string): DocRef };
}
interface Db {
  doc(path: string): DocRef;
}
interface UserNs {
  id(): Promise<string | null>;
}
interface ClaudeGlobal {
  use(name: string): Promise<unknown>;
}

const CHUNK_CHARS = 180_000;

export interface CloudManifest {
  saveId: string;
  savedAt: number;
  schemaVersion: number;
  summary: SaveSummary;
  chunks: number;
  encoding: 'gzip-b64' | 'json';
}

interface Cloud {
  db: Db;
  uid: string;
}

let cloudPromise: Promise<Cloud | null> | null = null;

/** Resolves the cloud store, or null when this view can't use it (local dev, signed out, not granted). */
export function getCloud(): Promise<Cloud | null> {
  if (cloudPromise) return cloudPromise;
  cloudPromise = (async () => {
    const c = (typeof window !== 'undefined' ? (window as unknown as { claude?: ClaudeGlobal }).claude : undefined) ?? null;
    if (!c?.use) return null;
    try {
      const [db, user] = (await Promise.all([c.use('db'), c.use('user')])) as [Db | null, UserNs | null];
      if (!db || !user) return null;
      const uid = await user.id();
      if (!uid) return null;
      return { db, uid };
    } catch {
      return null;
    }
  })();
  return cloudPromise;
}

const slotRef = (c: Cloud, slot: string) => c.db.doc(`data/users/${c.uid}/${slot}`);
const chunkRef = (c: Cloud, slot: string, n: number) => slotRef(c, slot).collection('chunks').doc(String(n));

/* ---------------- encoding ---------------- */

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function encode(json: string): Promise<{ text: string; encoding: CloudManifest['encoding'] }> {
  if (typeof CompressionStream === 'undefined') return { text: json, encoding: 'json' };
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return { text: toB64(buf), encoding: 'gzip-b64' };
}

async function decode(text: string, encoding: CloudManifest['encoding']): Promise<string> {
  if (encoding === 'json') return text;
  const stream = new Blob([fromB64(text) as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/* ---------------- retry helper ---------------- */

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if ((e as { code?: string })?.code !== 'unavailable') throw e;
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    return fn();
  }
}

/* ---------------- API ---------------- */

export async function cloudSave(c: Cloud, slot: string, state: unknown, summary: SaveSummary, schemaVersion: number): Promise<void> {
  const { text, encoding } = await encode(JSON.stringify(state));
  const saveId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const chunks = Math.max(1, Math.ceil(text.length / CHUNK_CHARS));
  // One write at a time per document: chunks are separate documents, written in sequence.
  for (let i = 0; i < chunks; i++) {
    await withRetry(() => chunkRef(c, slot, i).set({ saveId, data: text.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS) }));
  }
  const manifest: CloudManifest = { saveId, savedAt: Date.now(), schemaVersion, summary, chunks, encoding };
  await withRetry(() => slotRef(c, slot).set(manifest as unknown as Record<string, unknown>));
}

export async function cloudManifest(c: Cloud, slot: string): Promise<CloudManifest | null> {
  const snap = await withRetry(() => slotRef(c, slot).get());
  if (!snap.exists) return null;
  const m = snap.data() as unknown as CloudManifest;
  if (!m || typeof m.chunks !== 'number' || typeof m.saveId !== 'string') return null;
  return m;
}

export async function cloudLoad(c: Cloud, slot: string): Promise<unknown> {
  const m = await cloudManifest(c, slot);
  if (!m) throw new Error('That save slot is empty.');
  const parts: string[] = [];
  for (let i = 0; i < m.chunks; i++) {
    const snap = await withRetry(() => chunkRef(c, slot, i).get());
    const d = snap.data() as { saveId?: string; data?: string } | undefined;
    if (!snap.exists || !d || d.saveId !== m.saveId || typeof d.data !== 'string') throw new Error('This save is incomplete (it was interrupted while saving).');
    parts.push(d.data);
  }
  return JSON.parse(await decode(parts.join(''), m.encoding));
}

export async function cloudDelete(c: Cloud, slot: string): Promise<void> {
  const m = await cloudManifest(c, slot);
  await withRetry(() => slotRef(c, slot).delete());
  if (m) for (let i = 0; i < m.chunks; i++) await withRetry(() => chunkRef(c, slot, i).delete());
}
