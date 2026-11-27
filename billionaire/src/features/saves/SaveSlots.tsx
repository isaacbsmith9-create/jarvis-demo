import { useCallback, useEffect, useRef, useState } from 'react';
import { store } from '../../app/store';
import { AUTOSAVE_SLOT, deleteSave, exportState, importState, listSaves, loadGame, MANUAL_SLOTS, type SaveListing } from '../../persistence/saves';
import { money } from '../../utils/format';

function when(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Save slot list. `mode` = 'load' (menu) or 'manage' (in game: save + load). */
export function SaveSlots({ mode }: { mode: 'load' | 'manage' }) {
  const [saves, setSaves] = useState<SaveListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listSaves()
      .then((s) => {
        setSaves(s);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(refresh, [refresh]);

  const bySlot = new Map((saves ?? []).map((s) => [s.slot, s]));
  const slots = [AUTOSAVE_SLOT, ...MANUAL_SLOTS];

  const doLoad = async (slot: string) => {
    setBusy(slot);
    try {
      const state = await loadGame(slot);
      store.loadState(state);
    } catch (e) {
      store.toast('error', `Could not load: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const doSave = async (slot: string) => {
    setBusy(slot);
    await store.save(slot);
    setBusy(null);
    refresh();
  };
  const doDelete = async (slot: string) => {
    await deleteSave(slot);
    setConfirmDelete(null);
    refresh();
    store.toast('info', 'Save deleted.');
  };
  const doExport = () => {
    if (!store.state) return;
    const blob = new Blob([exportState(store.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `billionaire-${store.state.player.name.replace(/\W+/g, '_')}-day${store.state.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doImport = async (f: File) => {
    try {
      const state = importState(await f.text());
      store.loadState(state);
    } catch (e) {
      store.toast('error', `Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (error) return <div className="notice neg">Saves unavailable: {error}</div>;
  if (!saves) return <div className="dim small">Reading saves…</div>;

  return (
    <div className="col" style={{ gap: 0 }}>
      <table className="table" data-testid="save-slots">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Empire</th>
            <th>Game date</th>
            <th className="r">Net worth</th>
            <th>Saved</th>
            <th className="r" />
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const s = bySlot.get(slot);
            const label = slot === AUTOSAVE_SLOT ? 'Autosave' : `Slot ${slot.slice(4)}`;
            return (
              <tr key={slot}>
                <td className="nowrap">
                  <span className={slot === AUTOSAVE_SLOT ? 'gold' : ''}>{label}</span>
                </td>
                <td>
                  {s?.summary ? (
                    <div>
                      <div>{s.summary.playerName}</div>
                      <div className="dim tiny">{s.summary.scenario}</div>
                    </div>
                  ) : (
                    <span className="dim">Empty</span>
                  )}
                  {s?.error && <div className="neg tiny">Unloadable: {s.error}</div>}
                </td>
                <td className="nowrap">{s?.summary?.date ?? ''}</td>
                <td className="r">{s?.summary ? money(s.summary.netWorth) : ''}</td>
                <td className="dim small nowrap">{s ? when(s.savedAt) : ''}</td>
                <td className="r nowrap">
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                    {mode === 'manage' && slot !== AUTOSAVE_SLOT && (
                      <button className="btn sm outline" disabled={busy !== null} onClick={() => doSave(slot)}>
                        {busy === slot ? 'Saving…' : s ? 'Overwrite' : 'Save here'}
                      </button>
                    )}
                    {s && !s.error && (
                      <button className="btn sm" disabled={busy !== null} onClick={() => doLoad(slot)}>
                        Load
                      </button>
                    )}
                    {s &&
                      (confirmDelete === slot ? (
                        <>
                          <button className="btn sm danger" onClick={() => doDelete(slot)}>
                            Confirm
                          </button>
                          <button className="btn sm ghost" onClick={() => setConfirmDelete(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="btn sm ghost" onClick={() => setConfirmDelete(slot)}>
                          Delete
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row" style={{ padding: '14px 12px 0', gap: 8 }}>
        {mode === 'manage' && (
          <button className="btn sm ghost" onClick={doExport}>
            Export save file
          </button>
        )}
        <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>
          Import save file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = '';
          }}
        />
        <span className="dim tiny" style={{ marginLeft: 'auto' }}>
          Saves are stored locally in this browser (IndexedDB). The game autosaves on the 1st of every month.
        </span>
      </div>
    </div>
  );
}
