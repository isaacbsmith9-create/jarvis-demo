import { useEffect, useState } from 'react';
import keyart from '../../assets/menu-keyart.jpg';
import keyartSm from '../../assets/menu-keyart-sm.jpg';
import { store } from '../../app/store';
import { Modal } from '../../components/ui';
import { listSaves, loadGame, type SaveListing } from '../../persistence/saves';
import { money } from '../../utils/format';
import { SaveSlots } from '../saves/SaveSlots';

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
        <img src={keyart} srcSet={`${keyartSm} 1000w, ${keyart} 2000w`} sizes="(max-width: 760px) 100vw, 60vw" alt="" decoding="async" />
      </div>
      <div className="menu-foot">Alpha 0.3 — Miami. All businesses, people, organizations and properties are fictional.</div>
      {showLoad && (
        <Modal title="Load Game" onClose={() => setShowLoad(false)} size="wide">
          <SaveSlots mode="load" />
        </Modal>
      )}
    </div>
  );
}
