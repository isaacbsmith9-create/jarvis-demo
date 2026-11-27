import { MainMenu } from '../features/menu/MainMenu';
import { NewCampaign } from '../features/scenarios/NewCampaign';
import { GameShell } from './GameShell';
import { useStore } from './store';

function Toasts() {
  const s = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function App() {
  const s = useStore();
  return (
    <>
      {s.screen === 'menu' && <MainMenu />}
      {s.screen === 'new' && <NewCampaign />}
      {s.screen === 'game' && <GameShell />}
      <Toasts />
    </>
  );
}
