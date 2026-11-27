import { useEffect } from 'react';
import { Icon } from '../components/icons';
import { CompaniesView } from '../features/companies/CompaniesView';
import { FoundCompanyModal } from '../features/companies/FoundCompany';
import { InteriorModal } from '../features/companies/InteriorModal';
import { CityView } from '../features/city/CityView';
import { DashboardView } from '../features/dashboard/DashboardView';
import { StaffView } from '../features/employees/StaffView';
import { FinanceView } from '../features/finance/FinanceView';
import { MarketView } from '../features/market/MarketView';
import { NewsView } from '../features/news/NewsView';
import { OrganizationView } from '../features/organizations/OrganizationView';
import { ProfileView } from '../features/organizations/ProfileView';
import { PropertiesView } from '../features/properties/PropertiesView';
import { SavesView } from '../features/saves/SavesView';
import { alerts } from '../features/selectors';
import { balanceSheet } from '../simulation/finance/valuation';
import { formatDate, weekdayName } from '../utils/date';
import { money } from '../utils/format';
import { Modal } from '../components/ui';
import { store, useStore, type Speed, type ViewId } from './store';

const NAV: { id: ViewId; label: string; icon: keyof typeof Icon }[] = [
  { id: 'dashboard', label: 'Empire', icon: 'dashboard' },
  { id: 'city', label: 'City', icon: 'city' },
  { id: 'companies', label: 'Companies', icon: 'company' },
  { id: 'properties', label: 'Property', icon: 'property' },
  { id: 'staff', label: 'Staff', icon: 'staff' },
  { id: 'finance', label: 'Finance', icon: 'finance' },
  { id: 'market', label: 'Market', icon: 'market' },
  { id: 'news', label: 'News', icon: 'news' },
  { id: 'organization', label: 'Network', icon: 'org' },
];

function TopBar() {
  const s = useStore();
  const st = s.state!;
  const bs = balanceSheet(st);
  const speeds: { v: Speed; icon: keyof typeof Icon; title: string }[] = [
    { v: 0, icon: 'pause', title: 'Pause (Space)' },
    { v: 1, icon: 'play', title: 'Normal speed (1)' },
    { v: 2, icon: 'fast', title: 'Fast (2)' },
    { v: 3, icon: 'faster', title: 'Fastest (3)' },
  ];
  const nw0 = st.player.netWorthHistory.length > 1 ? st.player.netWorthHistory[st.player.netWorthHistory.length - 2].value : bs.netWorth;
  const delta = bs.netWorth - nw0;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">B</span>
      </div>
      <span className="wordmark">BILLIONAIRE</span>
      <span className="sep" />
      <div className="clock">
        <div>
          <div className="wd">{weekdayName(st.day)} · Day {st.day + 1}</div>
          <div className="date num" data-testid="game-date">
            {formatDate(st.day)}
          </div>
        </div>
        <div className="speed" data-testid="speed-controls">
          {speeds.map((x) => {
            const I = Icon[x.icon];
            return (
              <button key={x.v} className={s.speed === x.v ? 'on' : ''} title={x.title} onClick={() => s.setSpeed(x.v)} data-testid={`speed-${x.v}`}>
                <I />
              </button>
            );
          })}
          <button title="Advance one day (N)" onClick={() => s.nextDay()} disabled={s.speed !== 0} data-testid="step-day" style={{ opacity: s.speed !== 0 ? 0.3 : 1 }}>
            <Icon.step />
          </button>
        </div>
      </div>
      <span className="sep" />
      <div className="tb-group">
        <div className="tb-stat">
          <span className="l">Cash</span>
          <span className={`v ${bs.cash < 0 ? 'neg' : ''}`} data-testid="tb-cash">
            {money(bs.cash)}
          </span>
        </div>
        <div className="tb-stat">
          <span className="l">Net worth</span>
          <span className="v" data-testid="tb-networth">
            {money(bs.netWorth)} <span className={`tiny ${delta >= 0 ? 'pos' : 'neg'}`}>{delta !== 0 ? money(delta, { sign: true }) : ''}</span>
          </span>
        </div>
        {bs.loans > 0 && (
          <div className="tb-stat">
            <span className="l">Debt</span>
            <span className="v neg">{money(bs.loans)}</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <div className="tb-group" style={{ gap: 6 }}>
        <span className="dim tiny" style={{ marginRight: 6 }}>
          {s.saving ? 'Saving…' : s.lastSaved ? `Saved ${new Date(s.lastSaved).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not saved'}
        </span>
        <button className="btn sm ghost" onClick={() => void s.save('slot1')} title="Quick save to Slot 1 (Ctrl/⌘+S)">
          Quick save
        </button>
        <button className="btn sm ghost" onClick={() => s.setView('profile')} title="Profile">
          {st.player.name}
        </button>
      </div>
    </header>
  );
}

function NavRail() {
  const s = useStore();
  const st = s.state!;
  const alertCount = alerts(st).filter((a) => a.level === 'neg').length;
  return (
    <nav className="rail">
      {NAV.map((n) => {
        const I = Icon[n.icon];
        return (
          <button
            key={n.id}
            className={s.view === n.id ? 'on' : ''}
            onClick={() => {
              if (n.id === 'companies') s.select({ companyId: null });
              s.setView(n.id);
            }}
            data-testid={`nav-${n.id}`}
          >
            <I />
            {n.label}
            {n.id === 'dashboard' && alertCount > 0 && <span className="badge">{alertCount}</span>}
          </button>
        );
      })}
      <div className="spacer" />
      <button className={s.view === 'saves' ? 'on' : ''} onClick={() => s.setView('saves')} data-testid="nav-saves">
        <Icon.save />
        Saves
      </button>
    </nav>
  );
}

function ConfirmModal() {
  const s = useStore();
  const m = s.modal!;
  return (
    <Modal
      title={m.title ?? 'Confirm'}
      onClose={() => s.openModal(null)}
      size="narrow"
      footer={
        <>
          <button className="btn ghost" onClick={() => s.openModal(null)}>
            Cancel
          </button>
          <button
            className="btn primary"
            data-testid="confirm-ok"
            onClick={() => {
              m.onConfirm?.();
              if (store.modal === m) s.openModal(null);
            }}
          >
            {m.confirmLabel ?? 'Confirm'}
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0 }}>
        {m.body}
      </p>
    </Modal>
  );
}

export function GameShell() {
  const s = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void store.save('slot1');
        return;
      }
      if (store.modal) return;
      if (e.code === 'Space') {
        e.preventDefault();
        store.togglePause();
      } else if (e.key === '1' || e.key === '2' || e.key === '3') store.setSpeed(Number(e.key) as Speed);
      else if (e.key === '0') store.setSpeed(0);
      else if (e.key.toLowerCase() === 'n' && store.speed === 0) store.nextDay();
    };
    window.addEventListener('keydown', onKey);
    const onUnload = () => {
      // Best-effort autosave when the window closes.
      void store.autosave();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  if (!s.state) return null;
  const v = s.view;
  return (
    <div className="shell">
      <TopBar />
      <NavRail />
      <main className="main">
        <CityView active={v === 'city'} />
        {v !== 'city' && (
          <div className="view" key={v}>
            {v === 'dashboard' && <DashboardView />}
            {v === 'companies' && <CompaniesView />}
            {v === 'properties' && <PropertiesView />}
            {v === 'staff' && <StaffView />}
            {v === 'finance' && <FinanceView />}
            {v === 'market' && <MarketView />}
            {v === 'news' && <NewsView />}
            {v === 'organization' && <OrganizationView />}
            {v === 'profile' && <ProfileView />}
            {v === 'saves' && <SavesView />}
          </div>
        )}
      </main>
      {s.modal?.kind === 'found-company' && <FoundCompanyModal />}
      {s.modal?.kind === 'interior' && <InteriorModal />}
      {s.modal?.kind === 'confirm' && <ConfirmModal />}
    </div>
  );
}
