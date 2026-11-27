import { useEffect, useState } from 'react';
import { store } from '../../app/store';
import { Modal } from '../../components/ui';
import { listSaves, loadGame, type SaveListing } from '../../persistence/saves';
import { money } from '../../utils/format';
import { SaveSlots } from '../saves/SaveSlots';

/** Line-art skyline drawn from the game's own district palette. */
function Skyline() {
  const buildings: { x: number; w: number; h: number; c: string }[] = [];
  let x = 0;
  let i = 0;
  while (x < 1200) {
    const r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = Math.abs(Math.sin(i * 78.233) * 12345.678) % 1;
    const w = 28 + r * 46;
    const tall = i > 6 && i < 22;
    const h = tall ? 180 + r2 * 330 : 60 + r2 * 160;
    buildings.push({ x, w, h, c: tall ? '#c8a35a' : '#5a5650' });
    x += w + 6 + r2 * 10;
    i++;
  }
  return (
    <svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <pattern id="win" width="10" height="12" patternUnits="userSpaceOnUse">
          <rect x="2" y="3" width="4" height="5" fill="#c8a35a" opacity="0.18" />
        </pattern>
      </defs>
      <rect width="1200" height="900" fill="#0a0a0c" />
      <circle cx="860" cy="330" r="120" fill="none" stroke="#c8a35a" strokeOpacity="0.18" />
      <circle cx="860" cy="330" r="160" fill="none" stroke="#c8a35a" strokeOpacity="0.07" />
      {buildings.map((b, k) => (
        <g key={k}>
          <rect x={b.x} y={760 - b.h} width={b.w} height={b.h} fill="#0f0f12" stroke={b.c} strokeOpacity={0.55} strokeWidth={1} />
          <rect x={b.x} y={760 - b.h} width={b.w} height={b.h} fill="url(#win)" />
        </g>
      ))}
      <line x1="0" y1="760" x2="1200" y2="760" stroke="#c8a35a" strokeOpacity="0.5" />
      {Array.from({ length: 14 }, (_, k) => (
        <line key={k} x1={0} x2={1200} y1={772 + k * 9} y2={772 + k * 9} stroke="#7ea6c9" strokeOpacity={0.12 - k * 0.007} />
      ))}
    </svg>
  );
}

export function MainMenu() {
  const [latest, setLatest] = useState<SaveListing | null | undefined>(undefined);
  const [showLoad, setShowLoad] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    listSaves()
      .then((s) => setLatest(s.find((x) => !x.error && x.slot.startsWith('slot')) ?? s.find((x) => !x.error) ?? null))
      .catch((e) => {
        setLatest(null);
        setDbError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const cont = async () => {
    if (!latest) return;
    try {
      store.loadState(await loadGame(latest.slot), latest.slot);
    } catch (e) {
      store.toast('error', `Could not load: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="menu">
      <div className="menu-left">
        <div className="menu-logo">
          <div className="crest">
            <span className="brand-mark">B</span>
          </div>
          <h1>BILLIONAIRE</h1>
          <div className="rule" />
          <p>Build a business empire in Miami — from a laptop and five hundred dollars, or from a fortune with a past.</p>
        </div>
        <div className="menu-actions">
          <button onClick={cont} disabled={!latest} data-testid="menu-continue">
            Continue
            <span className="sub">{latest?.summary ? `${latest.summary.playerName} · ${latest.summary.date} · ${money(latest.summary.netWorth)}` : latest === undefined ? '' : 'No saved games'}</span>
          </button>
          <button onClick={() => store.setScreen('new')} data-testid="menu-new">
            New Campaign
            <span className="sub">11 starting backgrounds</span>
          </button>
          <button onClick={() => setShowLoad(true)} data-testid="menu-load">
            Load Game
            <span className="sub">5 save slots</span>
          </button>
        </div>
        {dbError && <div className="notice warn">Saving is unavailable in this browser: {dbError}</div>}
      </div>
      <div className="menu-right">
        <Skyline />
      </div>
      <div className="menu-foot">Alpha 0.1 — Miami. All businesses, people, organizations and properties are fictional.</div>
      {showLoad && (
        <Modal title="Load Game" onClose={() => setShowLoad(false)} size="wide">
          <SaveSlots mode="load" />
        </Modal>
      )}
    </div>
  );
}
