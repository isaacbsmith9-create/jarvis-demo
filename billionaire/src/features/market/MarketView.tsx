import { store, useGame } from '../../app/store';
import { LineChart, Sparkline } from '../../components/charts';
import { Money, Panel, Progress, Stat } from '../../components/ui';
import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import { INDUSTRIES, SUBTYPES } from '../../data/companies/industries';
import { rivalTrailingRevenue } from '../../simulation/competitors/competitors';
import { balance, rivalAccount } from '../../simulation/finance/ledger';
import type { Rival } from '../../types/core';
import { formatPeriod, formatShortDate } from '../../utils/date';
import { money, pct } from '../../utils/format';

export function MarketView() {
  const st = useGame();
  const e = st.economy;
  const rivals = Object.values(st.rivals).sort((a, b) => (a.status === 'bankrupt' ? 1 : 0) - (b.status === 'bankrupt' ? 1 : 0) || rivalTrailingRevenue(b) - rivalTrailingRevenue(a));
  const sel = store.selection.rivalId ? st.rivals[store.selection.rivalId] : null;
  return (
    <div className="page" data-testid="market-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Economy & competition</div>
          <h1>Market</h1>
        </div>
      </div>
      <section className="panel">
        <div className="kpis">
          <Stat label="Miami business index" value={e.index.toFixed(1)} sub={e.index >= 100 ? <span className="pos">Above baseline</span> : <span className="neg">Below baseline</span>} />
          <Stat label="Consumer confidence" value={Math.round(e.consumerConfidence)} sub={<Progress ratio={e.consumerConfidence / 100} />} />
          <Stat label="Base interest rate" value={pct(e.interestRate, 2)} sub="Drives loan pricing" />
          <Stat label="Active competitors" value={rivals.filter((r) => r.status === 'active').length} sub={`${rivals.filter((r) => r.status === 'bankrupt').length} bankrupt`} />
        </div>
      </section>
      <div className="grid g-main-side">
        <Panel title="Business index" actions={<span className="dim small">Weekly</span>}>
          <LineChart series={[{ name: 'Index', color: 'var(--blue)', values: e.indexHistory.map((h) => h.value), area: true }]} labels={e.indexHistory.map((h) => formatShortDate(h.day))} format={(v) => v.toFixed(0)} height={180} />
        </Panel>
        <Panel title="Districts" tight>
          <table className="table">
            <thead>
              <tr>
                <th>District</th>
                <th className="r">Demand</th>
                <th className="r">Price idx</th>
                <th className="r">Trend/yr</th>
              </tr>
            </thead>
            <tbody>
              {DISTRICT_ORDER.map((d) => {
                const ds = e.districts[d];
                return (
                  <tr key={d} className="click" onClick={() => (store.select({ district: d, propertyId: null }), store.setView('city'))}>
                    <td>
                      <span className="dot" style={{ background: DISTRICTS[d].accent, marginRight: 8 }} />
                      {DISTRICTS[d].name}
                    </td>
                    <td className={`r ${ds.demand >= 1 ? 'pos' : 'neg'}`}>{(ds.demand * 100).toFixed(0)}</td>
                    <td className="r">{ds.priceIndex.toFixed(3)}</td>
                    <td className={`r ${ds.trend >= 0 ? 'pos' : 'neg'}`}>{pct(ds.trend * 365, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
      <div className="grid" style={{ gridTemplateColumns: sel ? 'minmax(0,1fr) 380px' : '1fr' }}>
        <Panel title="Competitors" tight>
          <table className="table" data-testid="rivals-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Industry</th>
                <th>Strategy</th>
                <th>Districts</th>
                <th className="r">Revenue / mo</th>
                <th className="r">Trend</th>
                <th className="r">Staff</th>
                <th className="r">Cash</th>
              </tr>
            </thead>
            <tbody>
              {rivals.map((r) => (
                <tr key={r.id} className={`click ${sel?.id === r.id ? 'sel' : ''}`} onClick={() => store.select({ rivalId: sel?.id === r.id ? null : r.id })} style={{ opacity: r.status === 'bankrupt' ? 0.45 : 1 }}>
                  <td>
                    <div>{r.name}</div>
                    <div className="dim tiny">{r.status === 'bankrupt' ? 'Bankrupt' : r.ceo}</div>
                  </td>
                  <td className="small" style={{ color: INDUSTRIES[r.industry].color }}>
                    {SUBTYPES[r.subtype].name}
                  </td>
                  <td className="small muted" style={{ textTransform: 'capitalize' }}>
                    {r.strategy}
                    {r.priceCut > 0.05 && <span className="tag neg" style={{ marginLeft: 6 }}>Discounting</span>}
                  </td>
                  <td className="small muted">{r.districts.map((d) => DISTRICTS[d].name).join(', ')}</td>
                  <td className="r">{money(rivalTrailingRevenue(r))}</td>
                  <td className="r">
                    <Sparkline values={r.monthly.map((m) => m.revenue)} color={r.momentum >= 0 ? 'var(--pos)' : 'var(--neg)'} width={70} height={20} />
                  </td>
                  <td className="r">{r.employees}</td>
                  <td className="r">{money(balance(st, rivalAccount(r.id)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        {sel && <RivalDetail r={sel} />}
      </div>
    </div>
  );
}

function RivalDetail({ r }: { r: Rival }) {
  const st = useGame();
  const holdings = Object.values(st.properties).filter((p) => p.owner === rivalAccount(r.id));
  const news = st.news.filter((n) => n.refs?.rivalId === r.id).slice(0, 5);
  return (
    <div className="panel" style={{ alignSelf: 'start' }}>
      <div className="insp-h">
        <div className="row between">
          <span className="tag">{SUBTYPES[r.subtype].name}</span>
          <button className="close-x" onClick={() => store.select({ rivalId: null })}>
            ×
          </button>
        </div>
        <h2>{r.name}</h2>
        <div className="dim small">
          Owner: {r.owner} · CEO: {r.ceo}
        </div>
      </div>
      <div className="insp-sec">
        <div className="muted small">{r.description}</div>
      </div>
      <div className="insp-sec">
        <h4>Financials</h4>
        <div className="kv">
          <span>Cash</span>
          <span>{money(balance(st, rivalAccount(r.id)))}</span>
          <span>Daily revenue (base)</span>
          <span>{money(r.baseRevenue)}</span>
          <span>Target margin</span>
          <span>{pct(r.margin)}</span>
          <span>Reputation</span>
          <span>{Math.round(r.reputation)}</span>
          {r.monthly.slice(-3).map((m) => (
            <FragmentKV key={m.period} k={`${formatPeriod(m.period)} profit`} v={<Money v={m.profit} />} />
          ))}
        </div>
      </div>
      <div className="insp-sec">
        <h4>Holdings ({holdings.length})</h4>
        {holdings.length ? (
          holdings.map((p) => (
            <div key={p.id} className="row between small" style={{ padding: '3px 0', cursor: 'pointer' }} onClick={() => store.openProperty(p.id, true)}>
              <span>{p.name}</span>
              <span className="dim">{money(p.value)}</span>
            </div>
          ))
        ) : (
          <div className="dim small">No mapped properties.</div>
        )}
      </div>
      <div className="insp-sec">
        <h4>Recent activity</h4>
        {news.length ? news.map((n) => <div key={n.id} className="small" style={{ marginBottom: 6 }}>{n.headline} <span className="dim">· {formatShortDate(n.day)}</span></div>) : <div className="dim small">Nothing reported yet.</div>}
      </div>
    </div>
  );
}

function FragmentKV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <span>{k}</span>
      <span>{v}</span>
    </>
  );
}
