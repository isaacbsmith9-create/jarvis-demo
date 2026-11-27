import { useEffect, useState } from 'react';
import { BUSINESSES, ECONOMY } from '../game/config';
import { incomePerTick, territoryPct, useGame } from '../game/store';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString();

function CashPanel() {
  const cash = useGame((s) => s.cash);
  const owned = useGame((s) => s.owned);
  const payoutIn = useGame((s) => s.payoutIn);
  const last = useGame((s) => s.lastPayout);
  const [flash, setFlash] = useState<number | null>(null);
  useEffect(() => {
    if (!last) return;
    setFlash(last.amount);
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [last]);
  const income = incomePerTick(owned);
  return (
    <div className="panel cash-panel">
      <div className="cash">{fmt(cash)}</div>
      {flash !== null && <div className="cash-flash">+{fmt(flash)}</div>}
      <div className="sub">
        {income > 0 ? (
          <>
            <span className="money">+{fmt(income)}</span> / {ECONOMY.payoutInterval}s · next in {payoutIn}s
          </>
        ) : (
          'No income yet — take over a business'
        )}
      </div>
    </div>
  );
}

function TerritoryPanel() {
  const owned = useGame((s) => s.owned);
  const pct = territoryPct(owned);
  return (
    <div className="panel territory-panel">
      <div className="label">TERRITORY</div>
      <div className="bar">
        <div className="bar-fill territory" style={{ width: `${pct}%` }} />
      </div>
      <div className="sub">
        {pct}% · {Object.keys(owned).length}/{BUSINESSES.length} businesses
      </div>
    </div>
  );
}

function ZonePrompt() {
  const zoneId = useGame((s) => s.zoneId);
  const capture = useGame((s) => s.capture);
  const level = useGame((s) => (s.zoneId ? s.owned[s.zoneId] ?? 0 : 0));
  const cash = useGame((s) => s.cash);
  const upgrade = useGame((s) => s.upgrade);

  const capDef = capture ? BUSINESSES.find((b) => b.id === capture.id) : null;
  if (capDef && capture && !level) {
    return (
      <div className="panel prompt">
        <div className="prompt-title">TAKING OVER</div>
        <div className="prompt-name">{capDef.name}</div>
        <div className="bar big">
          <div className="bar-fill capture" style={{ width: `${Math.max(0, capture.progress) * 100}%` }} />
        </div>
        <div className="sub">
          {zoneId === capture.id ? 'Hold the zone…' : 'Get back in the zone!'} · +{fmt(capDef.baseIncome)}/tick · +{capDef.heatGain} heat
        </div>
      </div>
    );
  }
  if (!zoneId || !level) return null;
  const def = BUSINESSES.find((b) => b.id === zoneId)!;
  const maxed = level >= ECONOMY.maxLevel;
  const cost = ECONOMY.upgradeCost(def.baseIncome, level);
  const now = def.baseIncome * ECONOMY.levelMultiplier[level];
  const next = maxed ? now : def.baseIncome * ECONOMY.levelMultiplier[level + 1];
  return (
    <div className="panel prompt">
      <div className="prompt-title owned">YOUR BUSINESS · LV {level}</div>
      <div className="prompt-name">{def.name}</div>
      <div className="sub">
        Pays {fmt(now)}/tick{!maxed && <> → {fmt(next)} at Lv {level + 1}</>}
      </div>
      {maxed ? (
        <div className="sub gold">Fully upgraded</div>
      ) : (
        <button
          className="upgrade-btn"
          disabled={cash < cost}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => upgrade(def.id)}
        >
          Upgrade · {fmt(cost)} <span className="key">F / Space</span>
        </button>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function HUD({ children }: { children?: React.ReactNode }) {
  return (
    <div className="hud">
      <div className="hud-top-left">
        <CashPanel />
        <TerritoryPanel />
        {children}
      </div>
      <ZonePrompt />
      <Toasts />
    </div>
  );
}
