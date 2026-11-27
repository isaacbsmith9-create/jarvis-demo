import { useCallback, useEffect, useRef, useState } from 'react';
import { store, useStore } from '../../app/store';
import { AUTOSAVE_SLOT, deleteSave, exportState, getCloud, importState, listSaves, loadGame, MANUAL_SLOTS, type SaveListingEx } from '../../persistence/saves';
import { money } from '../../utils/format';

function when(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Shared hook: the current save list, refreshable. */
export function useSaveList() {
  const [saves, setSaves] = useState<SaveListingEx[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloud, setCloud] = useState<boolean | null>(null);
  const refresh = useCallback(() => {
    listSaves()
      .then((s) => {
        setSaves(s);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => {
    refresh();
    getCloud().then((c) => setCloud(!!c));
  }, [refresh]);
  return { saves, error, cloud, refresh };
}

function WhereTag({ s }: { s: SaveListingEx }) {
  if (s.where.includes('cloud')) return <span className="tag gold" title="Saved to your claude.ai account: kept across game updates and devices">Account</span>;
  return <span className="tag" title="Saved only in this browser. Save again to copy it to your account.">This browser</span>;
}

async function offerDownload(filename: string, data: string): Promise<void> {
  const c = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  const dl = c?.use ? ((await c.use('downloads').catch(() => null)) as { save(o: { filename: string; data: string }): Promise<unknown> } | null) : null;
  if (dl) {
    await dl.save({ filename, data });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** The five campaign slots. `mode` = 'load' (main menu) or 'manage' (in game: save here too). */
export function SaveSlots({ mode }: { mode: 'load' | 'manage' }) {
  const s = useStore();
  const { saves, error, cloud, refresh } = useSaveList();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ slot: string; action: 'delete' | 'overwrite' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Refresh after any save finishes.
  const lastSaved = s.lastSaved;
  useEffect(() => {
    if (lastSaved) refresh();
  }, [lastSaved, refresh]);

  const bySlot = new Map((saves ?? []).map((x) => [x.slot, x]));
  const legacy = bySlot.get(AUTOSAVE_SLOT);

  const doLoad = async (slot: string) => {
    setBusy(slot);
    try {
      store.loadState(await loadGame(slot), slot);
    } catch (e) {
      store.toast('error', `Could not load: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const doSave = async (slot: string) => {
    setConfirm(null);
    setBusy(slot);
    await store.save(slot);
    setBusy(null);
    refresh();
  };
  const doDelete = async (slot: string) => {
    setConfirm(null);
    setBusy(slot);
    try {
      await deleteSave(slot);
      store.toast('info', `Slot ${slot.startsWith('slot') ? slot.slice(4) : ''} cleared.`);
    } catch (e) {
      store.toast('error', `Could not delete: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(null);
    refresh();
  };
  const doExport = async () => {
    if (!store.state) return;
    try {
      await offerDownload(`billionaire-${store.state.player.name.replace(/\W+/g, '_')}-day${store.state.day}.json`, exportState(store.state));
    } catch {
      store.toast('error', 'The download was cancelled or is not available here.');
    }
  };
  const doImport = async (f: File) => {
    try {
      store.loadState(importState(await f.text()), null);
    } catch (e) {
      store.toast('error', `Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (error) return <div className="notice neg">Saves unavailable: {error}</div>;
  if (!saves) return <div className="dim small" style={{ padding: 16 }}>Reading your saves…</div>;

  const row = (slot: string, label: string) => {
    const x = bySlot.get(slot);
    const current = mode === 'manage' && s.activeSlot === slot;
    const asking = confirm?.slot === slot;
    return (
      <div key={slot} className={`slot-row ${current ? 'current' : ''}`} data-testid={`slot-${slot}`}>
        <div className="slot-num">{label}</div>
        <div className="slot-info">
          {x?.summary ? (
            <>
              <div className="row wrap" style={{ gap: 8 }}>
                <strong>{x.summary.playerName}</strong>
                <span className="dim small">{x.summary.scenario}</span>
                {current && <span className="tag pos">Playing now</span>}
                <WhereTag s={x} />
              </div>
              <div className="dim small">
                {x.summary.date} · {money(x.summary.netWorth)} net worth · {x.summary.companies} {x.summary.companies === 1 ? 'company' : 'companies'} · saved {when(x.savedAt)}
              </div>
            </>
          ) : (
            <span className="dim">Empty</span>
          )}
          {x?.error && <div className="neg tiny">Can't be loaded: {x.error}</div>}
          {asking && (
            <div className="slot-confirm">
              <span className="small">{confirm!.action === 'delete' ? `Delete ${x?.summary?.playerName ?? 'this save'} for good?` : `Replace ${x?.summary?.playerName ?? 'this save'} with your current game?`}</span>
              <button className="btn sm danger" onClick={() => (confirm!.action === 'delete' ? doDelete(slot) : doSave(slot))} data-testid="slot-confirm">
                {confirm!.action === 'delete' ? 'Delete' : 'Replace'}
              </button>
              <button className="btn sm ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
        {!asking && (
          <div className="slot-actions">
            {mode === 'manage' && slot !== AUTOSAVE_SLOT && (
              <button
                className={`btn sm ${current ? 'primary' : 'outline'}`}
                disabled={busy !== null}
                onClick={() => (x && !current ? setConfirm({ slot, action: 'overwrite' }) : doSave(slot))}
                data-testid={`save-${slot}`}
              >
                {busy === slot ? 'Saving…' : current ? 'Save now' : x ? 'Save here' : 'Save here'}
              </button>
            )}
            {x && !x.error && !current && (
              <button className="btn sm" disabled={busy !== null} onClick={() => doLoad(slot)} data-testid={`load-${slot}`}>
                {busy === slot ? 'Loading…' : 'Load'}
              </button>
            )}
            {x && !current && (
              <button className="btn sm ghost" disabled={busy !== null} onClick={() => setConfirm({ slot, action: 'delete' })}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="col" style={{ gap: 0 }}>
      <div className="slot-list" data-testid="save-slots">
        {MANUAL_SLOTS.map((slot) => row(slot, slot.slice(4)))}
        {legacy && row(AUTOSAVE_SLOT, 'Old')}
      </div>
      <div className="slot-foot">
        <span className="dim small grow" style={{ minWidth: 220 }}>
          {cloud
            ? 'Saves are stored in your claude.ai account, so they stay through game updates and on every device. Your game saves itself to its slot every 30 seconds, at the start of each month and when you leave.'
            : cloud === false
              ? 'Saves are stored in this browser only (sign in to claude.ai to keep them in your account). Your game saves itself every 30 seconds, at the start of each month and when you leave.'
              : ''}
        </span>
        <div className="row" style={{ gap: 6 }}>
          {mode === 'manage' && (
            <button className="btn sm ghost" onClick={doExport}>
              Export file
            </button>
          )}
          <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>
            Import file
          </button>
        </div>
        <input
          ref={fileRef}
          id="save-import"
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
