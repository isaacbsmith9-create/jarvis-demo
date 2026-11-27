import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deleteSave, exportState, importState, listSaves, loadGame, saveGame } from '../src/persistence/saves';
import { advanceDays } from '../src/simulation/engine';
import { createNewGame } from '../src/simulation/newGame';

describe('IndexedDB saves', () => {
  it('saves, lists, loads and deletes slots', async () => {
    const s = createNewGame({ playerName: 'Persist', scenarioId: 'owner', seed: 'p' });
    advanceDays(s, 40);
    expect(await saveGame('slot1', s)).toEqual(['device']);
    const list = await listSaves();
    const rec = list.find((x) => x.slot === 'slot1')!;
    expect(rec.error).toBeNull();
    expect(rec.summary?.playerName).toBe('Persist');
    const loaded = await loadGame('slot1');
    expect(loaded.day).toBe(40);
    expect(loaded.rng).toBe(s.rng);
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s));
    // Continuing a loaded game is identical to continuing the original.
    advanceDays(loaded, 20);
    advanceDays(s, 20);
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s));
    await deleteSave('slot1');
    expect((await listSaves()).find((x) => x.slot === 'slot1')).toBeUndefined();
  });

  it('flags corrupted saves instead of crashing', async () => {
    const s = createNewGame({ playerName: 'C', scenarioId: 'nobody', seed: 'c' });
    await saveGame('slot2', s);
    // Corrupt the stored record directly.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('billionaire', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('saves', 'readwrite');
        const store = tx.objectStore('saves');
        const g = store.get('slot2');
        g.onsuccess = () => {
          const rec = g.result;
          rec.data.companies = 'garbage';
          store.put(rec);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
    const rec = (await listSaves()).find((x) => x.slot === 'slot2')!;
    expect(rec.error).toMatch(/companies/i);
    await expect(loadGame('slot2')).rejects.toThrow();
  });

  it('round-trips export/import files', () => {
    const s = createNewGame({ playerName: 'X', scenarioId: 'double', seed: 'x' });
    const back = importState(exportState(s));
    expect(back.player.name).toBe('X');
    expect(() => importState('{"format":"other"}')).toThrow(/Not a BILLIONAIRE/);
    expect(() => importState('not json')).toThrow(/JSON/);
  });
});
