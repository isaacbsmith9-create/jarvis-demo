import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { listedBusinesses } from '../../simulation/companies/market';
import { branchLabel } from '../../simulation/companies/units';
import { buyStake, MAX_STAKE, rivalValuation, sellStake, stakePrice, stakeValue } from '../../simulation/competitors/investments';
import { PLAYER } from '../../simulation/finance/ledger';
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
  const [tab, setTab] = useState<'economy' | 'deals' | 'investments'>('economy');
  const forSale = listedBusinesses(st);
  const stakes = rivals.filter((r) => r.playerStake > 0);
  return (
    <div className="page" data-testid="market-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Economy & competition</div>
          <h1>Market</h1>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'economy' ? 'on' : ''} onClick={() => setTab('economy')}>
          Economy & competitors
        </button>
        <button className={tab === 'deals' ? 'on' : ''} onClick={() => setTab('deals')} data-testid="tab-deals">
          Businesses for sale ({forSale.length})
        </button>
        <button className={tab === 'investments' ? 'on' : ''} onClick={() => setTab('investments')} data-testid="tab-investments">
          Your investments ({stakes.length})
        </button>
      </div>
      {tab === 'deals' && <Deals />}
      {tab === 'investments' && <Investments onOpen={(id) => (store.select({ rivalId: id }), setTab('economy'))} />}
      {tab === 'economy' && (<>
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
                <th className="r">Your stake</th>
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
                  <td className="r">{r.playerStake > 0 ? <span className="gold">{pct(r.playerStake)}</span> : <span className="dim">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        {sel && <RivalDetail r={sel} />}
      </div>
      </>)}
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
      <StakePanel r={r} />
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

function StakePanel({ r }: { r: Rival }) {
  const st = useGame();
  if (r.status !== 'active') return null;
  const val = rivalValuation(st, r);
  const cash = balance(st, PLAYER);
  const sizes = [0.05, 0.1, 0.25].filter((f) => r.playerStake + f <= MAX_STAKE + 1e-9);
  return (
    <div className="insp-sec" data-testid="stake-panel">
      <h4>Invest</h4>
      <div className="kv">
        <span>Company valuation</span>
        <span>{money(val)}</span>
        <span>Your stake</span>
        <span>{r.playerStake > 0 ? `${pct(r.playerStake)} · worth ${money(stakeValue(st, r))}` : 'None'}</span>
        {r.playerStake > 0 && (
          <>
            <span>You paid</span>
            <span>{money(r.stakeCost)}</span>
          </>
        )}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {sizes.map((f) => {
          const price = stakePrice(st, r, f);
          return (
            <button
              key={f}
              className="btn sm outline"
              disabled={cash < price}
              data-testid={`buy-stake-${Math.round(f * 100)}`}
              onClick={() =>
                store.openModal({
                  kind: 'confirm',
                  title: `Buy ${pct(f)} of ${r.name}?`,
                  body: `${money(price)} for newly issued shares (valuation plus a 10% premium). The money goes into ${r.name}'s treasury. You'll receive ${pct(f)} of 35% of each profitable month as a dividend.`,
                  confirmLabel: 'Buy stake',
                  onConfirm: () => store.act((s) => buyStake(s, r.id, f)),
                })
              }
            >
              Buy {pct(f)} · {money(price)}
            </button>
          );
        })}
        {r.playerStake > 0 && (
          <button className="btn sm danger" onClick={() => store.act((s) => sellStake(s, r.id, r.playerStake))} data-testid="sell-stake">
            Sell all · {money(Math.round(val * r.playerStake * 0.92))}
          </button>
        )}
      </div>
      <div className="dim tiny" style={{ marginTop: 8 }}>
        Minority stakes only (up to {pct(MAX_STAKE)}): the founders keep control. Selling gets 92% of the current valuation. If the company goes bankrupt the stake is lost.
      </div>
    </div>
  );
}

function Deals() {
  const st = useGame();
  const list = listedBusinesses(st);
  if (!list.length)
    return (
      <Panel>
        <div className="empty">
          <h4>No businesses for sale right now</h4>
          <span className="small">Independent owners list their businesses after a few weeks of trading, so you can see real numbers. Check back soon.</span>
        </div>
      </Panel>
    );
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }} data-testid="deals">
      {list.map((c) => {
        const h = c.history.slice(-30);
        const rev = h.reduce((a, d) => a + d.revenue, 0);
        const prof = h.reduce((a, d) => a + d.profit, 0);
        const b = c.branches[0];
        const p = b.locationId ? st.properties[b.locationId] : null;
        const years = prof > 0 ? c.listing!.askingPrice / (prof * 12) : null;
        return (
          <button key={c.id} className="panel" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: 0 }} onClick={() => store.openCompany(c.id)} data-testid={`deal-${c.id}`}>
            <div className="panel-h">
              <div>
                <div className="eyebrow" style={{ color: INDUSTRIES[c.industry].color }}>
                  {SUBTYPES[c.subtype].name}
                </div>
                <div className="display" style={{ fontSize: 21, marginTop: 2 }}>
                  {c.name}
                </div>
              </div>
              <span className="tag gold">{money(c.listing!.askingPrice)}</span>
            </div>
            <div className="panel-b col" style={{ gap: 10 }}>
              <div className="grid g3" style={{ gap: 10 }}>
                <Stat label="Revenue 30d" value={<span style={{ fontSize: 16 }}>{money(rev)}</span>} />
                <Stat label="Profit 30d" value={<span style={{ fontSize: 16 }}><Money v={prof} /></span>} />
                <Stat label="Price / yr profit" value={<span style={{ fontSize: 16 }}>{years !== null ? `${years.toFixed(1)}×` : '—'}</span>} />
              </div>
              <div className="small muted">{p ? `${branchLabel(st, c, b)} · ${DISTRICTS[p.district].name}` : ''} · {c.employeeIds.length} staff · reputation {Math.round(c.reputation)}</div>
              <div className="dim tiny">{c.listing!.story}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Investments({ onOpen }: { onOpen: (rivalId: string) => void }) {
  const st = useGame();
  const stakes = Object.values(st.rivals).filter((r) => r.playerStake > 0);
  const total = stakes.reduce((s, r) => s + stakeValue(st, r), 0);
  const cost = stakes.reduce((s, r) => s + r.stakeCost, 0);
  const dividends = st.ledger.entries.filter((t) => t.category === 'dividend' && t.from.startsWith('rival:') && t.to === PLAYER).reduce((s, t) => s + t.amount, 0);
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="panel">
        <div className="kpis">
          <Stat label="Portfolio value" value={money(total)} />
          <Stat label="Invested" value={money(cost)} />
          <Stat label="Gain / loss" value={<Money v={total - cost} sign />} />
          <Stat label="Dividends received" value={money(dividends)} sub="Recent history" />
        </div>
      </section>
      <Panel title="Stakes" tight>
        {stakes.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th className="r">Stake</th>
                <th className="r">Paid</th>
                <th className="r">Value now</th>
                <th className="r">Gain</th>
              </tr>
            </thead>
            <tbody>
              {stakes.map((r) => (
                <tr key={r.id} className="click" onClick={() => onOpen(r.id)}>
                  <td>{r.name}</td>
                  <td className="r">{pct(r.playerStake)}</td>
                  <td className="r">{money(r.stakeCost)}</td>
                  <td className="r">{money(stakeValue(st, r))}</td>
                  <td className="r"><Money v={stakeValue(st, r) - r.stakeCost} sign /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <h4>No investments yet</h4>
            <span className="small">Open a competitor in Economy & competitors to buy a minority stake (up to 49%).</span>
          </div>
        )}
      </Panel>
    </div>
  );
}
