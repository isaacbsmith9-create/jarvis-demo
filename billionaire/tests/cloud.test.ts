import { describe, expect, it } from 'vitest';
import { cloudDelete, cloudLoad, cloudManifest, cloudSave } from '../src/persistence/cloud';
import { summarize } from '../src/persistence/saves';
import { validateState } from '../src/persistence/schema';
import { advanceDays } from '../src/simulation/engine';
import { createNewGame } from '../src/simulation/newGame';

/** In-memory stand-in for the artifact db capability, enforcing the 256 KiB document cap. */
function fakeCloud() {
  const docs = new Map<string, Record<string, unknown>>();
  const ref = (path: string): any => ({
    async get() {
      const d = docs.get(path);
      return { exists: !!d, data: () => d };
    },
    async set(data: Record<string, unknown>) {
      if (JSON.stringify(data).length > 256 * 1024) throw Object.assign(new Error('too big'), { code: 'invalid_argument' });
      docs.set(path, structuredClone(data));
    },
    async delete() {
      docs.delete(path);
    },
    collection: (c: string) => ({ doc: (id: string) => ref(`${path}/${c}/${id}`) }),
  });
  return { docs, cloud: { uid: 'u_test', db: { doc: ref } } as any };
}

describe('cloud saves', () => {
  it('round-trips a large, long-running game through compressed chunks', async () => {
    const { docs, cloud } = fakeCloud();
    const s = createNewGame({ playerName: 'Cloud', scenarioId: 'inheritor', seed: 'cloud' });
    advanceDays(s, 400);
    const raw = JSON.stringify(s).length;
    expect(raw).toBeGreaterThan(256 * 1024); // too big for one document without chunking
    await cloudSave(cloud, 'slot3', JSON.parse(JSON.stringify(s)), summarize(s), s.schemaVersion);
    const m = await cloudManifest(cloud, 'slot3');
    expect(m?.summary.playerName).toBe('Cloud');
    const loaded = validateState(await cloudLoad(cloud, 'slot3'));
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s));
    expect([...docs.keys()].every((k) => k.startsWith('data/users/u_test/'))).toBe(true);
    await cloudDelete(cloud, 'slot3');
    expect(docs.size).toBe(0);
  });

  it('refuses a save whose chunks belong to a different write', async () => {
    const { docs, cloud } = fakeCloud();
    const s = createNewGame({ playerName: 'A', scenarioId: 'owner', seed: 'a' });
    await cloudSave(cloud, 'slot1', JSON.parse(JSON.stringify(s)), summarize(s), s.schemaVersion);
    const chunkKey = [...docs.keys()].find((k) => k.includes('/chunks/'))!;
    docs.set(chunkKey, { ...docs.get(chunkKey), saveId: 'other' });
    await expect(cloudLoad(cloud, 'slot1')).rejects.toThrow(/incomplete/);
  });
});
