import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { LineChart } from '../../components/charts';
import { Money, MoneyInput, Notice, Panel, Progress, Stat } from '../../components/ui';
import { DISTRICTS } from '../../data/cities/miami';
import { INDUSTRIES, PRICE_LEVELS, RETAIL_ECON, roleDef, SUBTYPES } from '../../data/companies/industries';
import { closeCompany, injectCapital, maxStaff, playerCompanies, renameCompany, setOwnerOperated, setStockTarget, updateSettings, withdrawDividend } from '../../simulation/companies/companies';
import { buyBusiness } from '../../simulation/companies/market';
import { branchLabel, companyDistricts, primaryBranch, unitFor } from '../../simulation/companies/units';
import { execBonus } from '../../simulation/executives/executives';
import { Locations } from './Locations';
import { managementInfo } from '../../simulation/companies/industryRules';
import { dailyPayroll, hasManager, roleUnits } from '../../simulation/employees/employees';
import { activeModifiersFor } from '../../simulation/events/randomEvents';
import { balance, companyAccount, PLAYER } from '../../simulation/finance/ledger';
import { annualizedProfit, valueCompany } from '../../simulation/finance/valuation';
import type { Company, PriceLevel } from '../../types/core';
import { formatDate, formatPeriod, formatShortDate } from '../../utils/date';
import { dollars, money, num, pct } from '../../utils/format';
import { HiringPanel, StaffTable } from '../employees/StaffView';

export function CompaniesView() {
  const st = useGame();
  const sel = store.selection.companyId;
  const list = playerCompanies(st, true).sort((a, b) => (a.status === 'closed' ? 1 : 0) - (b.status === 'closed' ? 1 : 0) || a.foundedDay - b.foundedDay);
  const selected = sel ? st.companies[sel] : null;
  if (selected) return <CompanyDetail c={selected} />;
  const active = list.filter((c) => c.status !== 'closed');
  const closed = list.filter((c) => c.status === 'closed');
  return (
    <div className="page" data-testid="companies-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Operations</div>
          <h1>Companies</h1>
        </div>
        <button className="btn primary" onClick={() => store.openModal({ kind: 'found-company' })} data-testid="found-company">
          Found a company
        </button>
      </div>
      {active.length === 0 ? (
        <Panel>
          <div className="empty">
            <h4>You don't own any companies</h4>
            <span className="small">Pick from four industries: real estate, technology, hospitality and retail. Each runs on its own economic model.</span>
            <button className="btn primary" onClick={() => store.openModal({ kind: 'found-company' })}>
              Found your first company
            </button>
          </div>
        </Panel>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {active.map((c) => (
            <CompanyCard key={c.id} c={c} />
          ))}
        </div>
      )}
      {closed.length > 0 && (
        <Panel title="Closed companies" tight>
          <table className="table">
            <tbody>
              {closed.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="muted">{SUBTYPES[c.subtype].name}</td>
                  <td className="r muted">Lifetime revenue {money(c.lifetime.revenue)}</td>
                  <td className="r">
                    <Money v={c.lifetime.revenue - c.lifetime.expenses} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function CompanyCard({ c }: { c: Company }) {
  const st = useGame();
  const h = c.history.slice(-30);
  const rev = h.reduce((a, d) => a + d.revenue, 0);
  const prof = h.reduce((a, d) => a + d.profit, 0);
  const ds = companyDistricts(st, c);
  const where = c.branches.length > 1 ? `${c.branches.length} locations · ${ds.map((d) => DISTRICTS[d].name).join(', ')}` : branchLabel(st, c, c.branches[0]) + (c.subtype === 'foodtruck' && ds[0] ? ` · ${DISTRICTS[ds[0]].name}` : '');
  return (
    <button className="panel" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: 0 }} onClick={() => store.openCompany(c.id)} data-testid={`company-card-${c.id}`}>
      <div className="panel-h">
        <div>
          <div className="eyebrow" style={{ color: INDUSTRIES[c.industry].color }}>
            {SUBTYPES[c.subtype].name}
          </div>
          <div className="display" style={{ fontSize: 22, marginTop: 2 }}>
            {c.name}
          </div>
        </div>
        {c.status === 'distressed' ? <span className="tag neg">Distressed</span> : <span className="tag pos">Operating</span>}
      </div>
      <div className="panel-b col" style={{ gap: 12 }}>
        <div className="grid g3" style={{ gap: 10 }}>
          <Stat label="Revenue 30d" value={<span style={{ fontSize: 17 }}>{money(rev)}</span>} />
          <Stat label="Profit 30d" value={<span style={{ fontSize: 17 }}><Money v={prof} /></span>} />
          <Stat label="Cash" value={<span style={{ fontSize: 17 }}>{money(balance(st, companyAccount(c.id)))}</span>} />
        </div>
        <LineChart series={[{ name: 'Profit', color: prof >= 0 ? 'var(--pos)' : 'var(--neg)', values: c.history.slice(-60).map((x) => x.profit), area: true }]} labels={c.history.slice(-60).map((x) => formatShortDate(x.day))} format={(v) => money(v)} height={80} zeroLine />
        <div className="row between small muted">
          <span className="ellipsis">{where}</span>
          <span>
            {c.employeeIds.length} staff{c.ownerOperated ? ' + you' : ''}
          </span>
        </div>
      </div>
    </button>
  );
}

type Tab = 'overview' | 'locations' | 'staff' | 'financials' | 'manage';

function CompanyDetail({ c }: { c: Company }) {
  const st = useGame();
  const [tab, setTab] = useState<Tab>('overview');
  const sub = SUBTYPES[c.subtype];
  const val = valueCompany(st, c);
  const cash = balance(st, companyAccount(c.id));
  const h30 = c.history.slice(-30);
  const rev30 = h30.reduce((a, d) => a + d.revenue, 0);
  const prof30 = h30.reduce((a, d) => a + d.profit, 0);
  const firstLoc = primaryBranch(c).locationId;
  const loc = firstLoc ? st.properties[firstLoc] : null;
  const closed = c.status === 'closed';
  const forSale = c.owner === 'market';
  const tabs: Tab[] = forSale ? ['overview', 'financials'] : ['overview', 'locations', 'staff', 'financials', 'manage'];

  return (
    <div className="page" data-testid="company-detail">
      <div className="page-h">
        <div>
          <button className="btn sm ghost" style={{ marginBottom: 10, marginLeft: -10 }} onClick={() => (forSale ? (store.select({ companyId: null }), store.setView('market')) : store.select({ companyId: null }))}>
            {forSale ? '← Businesses for sale' : '← All companies'}
          </button>
          <div className="eyebrow" style={{ color: INDUSTRIES[c.industry].color }}>
            {INDUSTRIES[c.industry].name} · {sub.name} · {c.foundedDay < 0 ? `Established ${Math.max(1, Math.round(-c.foundedDay / 365))} yr before you arrived` : `Founded ${formatDate(c.foundedDay)}`}
          </div>
          <h1>{c.name}</h1>
        </div>
        <div className="row">
          {loc && !closed && (
            <button className="btn outline" onClick={() => store.openProperty(loc.id, true)}>
              View on map
            </button>
          )}
          {!closed && !forSale && (
            <button className="btn outline" onClick={() => store.openModal({ kind: 'interior', companyId: c.id })} data-testid="visit-hq">
              Visit {c.industry === 'hospitality' ? 'venue' : c.industry === 'retail' ? 'store' : 'office'}
            </button>
          )}
        </div>
      </div>
      {c.status === 'distressed' && (
        <Notice kind="neg">
          {c.name} is overdrawn and cannot pay its bills. Inject capital, enable auto-funding, or cut costs. Forced closure in {45 - c.distressDays} days.
        </Notice>
      )}
      {closed && <Notice>This company is closed.</Notice>}
      {forSale && c.listing && <ForSaleBanner c={c} />}
      <section className="panel">
        <div className="kpis">
          <Stat label="Valuation" value={money(val.total)} sub={`Book ${money(val.book)} + goodwill ${money(val.goodwill)}`} />
          <Stat label="Company cash" value={<span className={cash < 0 ? 'neg' : ''}>{money(cash)}</span>} sub={c.settings.autoFund ? 'Auto-funded from your cash' : 'Auto-funding off'} />
          <Stat label="Revenue · 30d" value={money(rev30)} sub={`Annualized ${money((rev30 / Math.max(1, h30.length)) * 365)}`} />
          <Stat label="Profit · 30d" value={<Money v={prof30} sign />} sub={`Margin ${rev30 ? pct(prof30 / rev30) : '—'}`} />
          <Stat label="Reputation" value={Math.round(c.reputation)} sub={<Progress ratio={c.reputation / 100} />} />
        </div>
      </section>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} data-testid={`tab-${t}`}>
            {t === 'overview' ? 'Operations' : t === 'locations' ? `Locations (${c.branches.length})` : t === 'staff' ? `Staff (${c.employeeIds.length})` : t === 'financials' ? 'Financials' : 'Capital & settings'}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Operations c={c} />}
      {tab === 'locations' && !forSale && <Locations c={c} />}
      {tab === 'staff' && (
        <div className="col" style={{ gap: 18 }}>
          <Panel title="Team" tight actions={<span className="dim small">{c.employeeIds.length} / {maxStaff(st, c)} positions · payroll {money(dailyPayroll(st, c) * 30)}/mo</span>}>
            <StaffTable employees={c.employeeIds.map((id) => st.employees[id])} showCompany={false} />
            {c.ownerOperated && (
              <div className="list-item">
                <span className="tag gold">You</span>
                <span className="small muted">Working full-time as {roleDef(c.subtype, sub.primaryRole)?.title} (skill {st.player.businessSkill}). No salary.</span>
              </div>
            )}
          </Panel>
          {!closed && <HiringPanel c={c} />}
        </div>
      )}
      {tab === 'financials' && <Financials c={c} />}
      {tab === 'manage' && !closed && <Manage c={c} />}
    </div>
  );
}

function Operations({ c }: { c: Company }) {
  const st = useGame();
  const sub = SUBTYPES[c.subtype];
  const hist = c.history.slice(-90);
  const labels = hist.map((x) => formatShortDate(x.day));
  const mods = activeModifiersFor(st, c.id, c.industry);
  const [branchId, setBranchId] = useState(c.branches[0].id);
  const branch = c.branches.find((b) => b.id === branchId) ?? c.branches[0];
  const unit = unitFor(st, c, branch);
  const district = branch.locationId ? st.properties[branch.locationId]?.district : branch.ops.kind === 'hospitality' ? branch.ops.foodTruckDistrict : null;
  const closed = c.status === 'closed' || c.owner !== 'player';
  const set = (patch: Partial<Company['settings']>) => store.act((s) => updateSettings(s, c.id, patch), { quietSuccess: true });

  const opsRows: [string, React.ReactNode][] = [];
  const o = branch.ops;
  if (o.kind === 'technology' && c.subtype === 'agency') {
    const last = c.history[c.history.length - 1];
    opsRows.push(['Billable capacity', `${(roleUnits(st, unit, 'dev') * 6).toFixed(1)} hrs/day`]);
    opsRows.push(['Client demand (last day)', `${(last?.customers ?? 0).toFixed(0)} hrs billed`]);
    opsRows.push(['Utilization', pct(o.utilization)]);
    opsRows.push(['Delivery quality', Math.round(o.quality)]);
  } else if (o.kind === 'technology') {
    opsRows.push(['Subscribers', num(o.users)]);
    opsRows.push(['Product quality', `${Math.round(o.quality)} / 100`]);
    opsRows.push(['Version', `${o.version}.0 · next release ${Math.round(o.devProgress)}%`]);
    opsRows.push(['Monthly churn', pct(o.utilization * 30, 1)]);
    opsRows.push(['Price', `${money(dollars(39 * PRICE_LEVELS[c.settings.priceLevel].mult))}/user/mo`]);
  } else if (o.kind === 'hospitality') {
    const unit = c.subtype === 'hotel' ? 'rooms' : c.subtype === 'nightclub' ? 'guests' : c.subtype === 'foodtruck' ? 'orders' : 'covers';
    opsRows.push([`Capacity (${unit}/day)`, num(o.lastCapacity)]);
    opsRows.push([`Demand (${unit}/day)`, num(o.lastDemand)]);
    opsRows.push([`Served yesterday`, num(o.lastCustomers)]);
    opsRows.push(['Service quality', Math.round(o.quality)]);
    if (c.subtype === 'hotel' && branch.locationId) opsRows.push(['Rooms', num(Math.floor(st.properties[branch.locationId].sqft / 450))]);
    if (c.subtype === 'foodtruck' && o.foodTruckDistrict) opsRows.push(['Parked today', DISTRICTS[o.foodTruckDistrict].name]);
    if (c.subtype === 'nightclub') opsRows.push(['Open nights', 'Thu – Sun']);
  } else if (o.kind === 'retail') {
    const econ = RETAIL_ECON[c.subtype as 'boutique' | 'convenience' | 'online'];
    opsRows.push(['Inventory', `${num(o.inventory)} units (${money(o.inventory * o.unitCost)})`]);
    opsRows.push(['Restock target', `${num(branch.stockTarget)} units`]);
    opsRows.push(['Unit cost → shelf price', `${money(o.unitCost)} → ${money(dollars((o.unitCost / 100) * econ.markup * PRICE_LEVELS[c.settings.priceLevel].mult))}`]);
    opsRows.push([c.subtype === 'online' ? 'Orders yesterday' : 'Shoppers yesterday', num(o.lastCustomers)]);
    opsRows.push(['Demand yesterday', num(o.lastDemand)]);
    opsRows.push(['Stock-out days', num(o.stockouts)]);
  } else if (o.kind === 'realestate') {
    const info = managementInfo(st, c);
    opsRows.push(['Deals closed (lifetime)', num(o.dealsClosed)]);
    opsRows.push(['Deal flow', `${(o.pipeline / 20).toFixed(2)} expected deals/day`]);
    opsRows.push(['Rental properties managed', `${info.managedIds.length} (coverage ${pct(info.coverage)})`]);
    opsRows.push(['Management fee', '8% of rent on your rentals']);
  }

  const levels: PriceLevel[] = ['budget', 'standard', 'premium', 'luxury'];
  const mkt = c.settings.marketingPerDay;
  const mktMax = c.industry === 'technology' || c.subtype === 'online' ? dollars(5000) : dollars(1500);

  return (
    <div className="grid g-main-side">
      <div className="col" style={{ gap: 18 }}>
        <Panel title="Revenue & expenses" actions={<span className="legend"><span><i style={{ background: 'var(--gold)' }} />Revenue</span><span><i style={{ background: 'var(--neg)' }} />Expenses</span><span><i style={{ background: 'var(--pos)' }} />Profit</span></span>}>
          <LineChart
            series={[
              { name: 'Revenue', color: 'var(--gold)', values: hist.map((x) => x.revenue) },
              { name: 'Expenses', color: 'var(--neg)', values: hist.map((x) => x.expenses), dashed: true },
              { name: 'Profit', color: 'var(--pos)', values: hist.map((x) => x.profit), area: true },
            ]}
            labels={labels}
            format={(v) => money(v)}
            height={220}
            zeroLine
          />
        </Panel>
        <Panel title="Company cash">
          <LineChart series={[{ name: 'Cash', color: 'var(--blue)', values: hist.map((x) => x.cash), area: true }]} labels={labels} format={(v) => money(v)} height={120} zeroLine />
        </Panel>
        <Panel title="How this business works">
          <div className="col" style={{ gap: 10 }}>
            <div className="muted">{sub.description}</div>
            <div className="small">
              <span className="dim">Model: </span>
              {sub.model}
            </div>
            <div className="small">
              <span className="dim">Roles: </span>
              {sub.roles.map((r) => `${r.title} — ${r.description}`).join(' · ')}
            </div>
          </div>
        </Panel>
      </div>
      <div className="col" style={{ gap: 18 }}>
        <Panel title="Operations" actions={c.branches.length > 1 ? <select className="select" style={{ height: 28, width: 200 }} value={branch.id} onChange={(e) => setBranchId(e.target.value)} data-testid="ops-branch">{c.branches.map((b) => <option key={b.id} value={b.id}>{branchLabel(st, c, b)}</option>)}</select> : undefined}>
          <div className="kv">
            {opsRows.map(([k, v]) => (
              <FragmentKV key={k} k={k} v={v} />
            ))}
            {district && (
              <>
                <span>District</span>
                <span>{DISTRICTS[district].name}</span>
              </>
            )}
          </div>
          {mods.length > 0 && (
            <div className="col" style={{ gap: 4, marginTop: 12 }}>
              {mods.map((m) => (
                <div key={m.id} className={`small ${m.mult >= 1 ? 'pos' : 'neg'}`}>
                  {m.mult >= 1 ? '▲' : '▼'} {m.label} ({m.mult >= 1 ? '+' : ''}
                  {Math.round((m.mult - 1) * 100)}% demand, until {formatShortDate(m.untilDay)})
                </div>
              ))}
            </div>
          )}
        </Panel>
        {!closed && (
          <Panel title="Strategy">
            <div className="col" style={{ gap: 16 }}>
              <div className="field">
                <label>Pricing</label>
                <div className="seg">
                  {levels.map((l) => (
                    <button key={l} className={c.settings.priceLevel === l ? 'on' : ''} disabled={c.settings.delegated} onClick={() => set({ priceLevel: l })}>
                      {PRICE_LEVELS[l].label}
                    </button>
                  ))}
                </div>
                <span className="dim tiny">
                  Prices ×{PRICE_LEVELS[c.settings.priceLevel].mult} · demand ×{PRICE_LEVELS[c.settings.priceLevel].demand}
                </span>
              </div>
              <div className="field">
                <label>
                  Marketing budget · <span className="gold">{money(mkt)}/day</span> ({money(mkt * 30)}/mo)
                </label>
                <input type="range" min={0} max={mktMax} step={dollars(10)} value={Math.min(mkt, mktMax)} disabled={c.settings.delegated} onChange={(e) => set({ marketingPerDay: Number(e.target.value) })} />
                <span className="dim tiny">{c.industry === 'technology' || c.subtype === 'online' ? 'Acquires users/orders directly. Rising cost per acquisition at high spend.' : 'Raises local demand with diminishing returns.'}</span>
              </div>
              {branch.ops.kind === 'retail' && (
                <div className="field">
                  <label>Restock target (units){c.branches.length > 1 ? ` · ${branchLabel(st, c, branch)}` : ''}</label>
                  <input className="input num" type="number" min={0} value={branch.stockTarget} disabled={c.settings.delegated} onChange={(e) => store.act((s) => setStockTarget(s, c.id, branch.id, Math.max(0, Math.round(Number(e.target.value) || 0))), { quietSuccess: true })} />
                  <span className="dim tiny">Reorders from suppliers when stock falls below 35% of target.</span>
                </div>
              )}
              <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={c.ownerOperated} onChange={(e) => store.act((s) => setOwnerOperated(s, c.id, e.target.checked))} />
                <span>
                  Work here yourself <span className="dim">(as {roleDef(c.subtype, sub.primaryRole)?.title}; one company at a time)</span>
                </span>
              </label>
              <label className="row small" style={{ gap: 8, cursor: hasManager(st, c) ? 'pointer' : 'not-allowed', opacity: hasManager(st, c) ? 1 : 0.5 }}>
                <input type="checkbox" checked={c.settings.delegated} disabled={!hasManager(st, c)} onChange={(e) => store.act((s) => updateSettings(s, c.id, { delegated: e.target.checked }))} />
                <span>
                  Delegate to manager <span className="dim">{hasManager(st, c) ? `(weekly pricing, marketing & stock decisions${execBonus(st, c, 'coo') > 0 ? ' — your COO covers it' : ''})` : '(hire a manager or an empire COO first)'}</span>
                </span>
              </label>
            </div>
          </Panel>
        )}
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

function Financials({ c }: { c: Company }) {
  const rows = [...c.statements, c.current].slice(-12).reverse();
  const lines: [keyof (typeof rows)[number], string][] = [
    ['revenue', 'Revenue'],
    ['cogs', 'Cost of goods'],
    ['payroll', 'Payroll'],
    ['rent', 'Rent'],
    ['marketing', 'Marketing'],
    ['operating', 'Operating & overhead'],
    ['depreciation', 'Depreciation'],
    ['profit', 'Operating profit'],
  ];
  return (
    <div className="col" style={{ gap: 18 }}>
      <Panel title="Monthly income statements" tight>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" data-testid="statements">
            <thead>
              <tr>
                <th>Line</th>
                {rows.map((r, i) => (
                  <th key={r.period} className="r">
                    {formatPeriod(r.period)}
                    {i === 0 ? ' (MTD)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(([k, label]) => (
                <tr key={k}>
                  <td style={{ fontWeight: k === 'profit' || k === 'revenue' ? 600 : 400 }}>{label}</td>
                  {rows.map((r) => {
                    const v = r[k] as number;
                    return (
                      <td key={r.period} className="r">
                        {k === 'profit' ? <Money v={v} /> : k === 'revenue' ? money(v) : v ? <span className="muted">({money(v)})</span> : <span className="dim">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid g2">
        <Panel title="Lifetime">
          <div className="kv">
            <span>Revenue</span>
            <span>{money(c.lifetime.revenue)}</span>
            <span>Expenses</span>
            <span>{money(c.lifetime.expenses)}</span>
            <span>Profit</span>
            <span>
              <Money v={c.lifetime.revenue - c.lifetime.expenses} />
            </span>
            <span>Starting capital</span>
            <span>{money(c.startingCapital)}</span>
            <span>Annualized profit (30d trend)</span>
            <span>
              <Money v={annualizedProfit(c)} />
            </span>
          </div>
        </Panel>
        <Panel title="Notes">
          <div className="small muted col" style={{ gap: 6 }}>
            <span>Statements are accrual-based. Retail cost of goods is recognized when units sell; inventory purchases are a cash outflow but not an expense.</span>
            <span>Every cash movement is recorded in the ledger (Finance → Ledger).</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Manage({ c }: { c: Company }) {
  const st = useGame();
  const [inject, setInject] = useState(0);
  const [withdraw, setWithdraw] = useState(0);
  const [name, setName] = useState(c.name);
  const cash = balance(st, companyAccount(c.id));
  const playerCash = balance(st, PLAYER);
  return (
    <div className="grid g2">
      <Panel title="Capital">
        <div className="col" style={{ gap: 16 }}>
          <div className="field">
            <label>Invest from your cash ({money(playerCash)} available)</label>
            <div className="row">
              <div className="grow">
                <MoneyInput value={inject} onChange={setInject} max={playerCash} />
              </div>
              <button className="btn outline" disabled={inject <= 0 || inject > playerCash} onClick={() => store.act((s) => injectCapital(s, c.id, inject)).ok && setInject(0)}>
                Invest
              </button>
            </div>
          </div>
          <div className="field">
            <label>Withdraw to your cash ({money(Math.max(0, cash))} in company)</label>
            <div className="row">
              <div className="grow">
                <MoneyInput value={withdraw} onChange={setWithdraw} max={Math.max(0, cash)} />
              </div>
              <button className="btn outline" disabled={withdraw <= 0 || withdraw > cash} onClick={() => store.act((s) => withdrawDividend(s, c.id, withdraw)).ok && setWithdraw(0)} data-testid="withdraw">
                Withdraw
              </button>
            </div>
          </div>
          <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={c.settings.autoFund} onChange={(e) => store.act((s) => updateSettings(s, c.id, { autoFund: e.target.checked }), { quietSuccess: true })} />
            <span>
              Auto-fund shortfalls from your personal cash <span className="dim">(prevents distress)</span>
            </span>
          </label>
        </div>
      </Panel>
      <Panel title="Company">
        <div className="col" style={{ gap: 16 }}>
          <div className="field">
            <label>Name</label>
            <div className="row">
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              <button className="btn" disabled={name.trim() === c.name} onClick={() => store.act((s) => renameCompany(s, c.id, name))}>
                Rename
              </button>
            </div>
          </div>
          <div className="divider" />
          <div className="small muted">Closing lays off all staff (2 weeks severance each), liquidates equipment at 25% of book value, releases the location and returns remaining cash to you. Debts fall to you.</div>
          <button
            className="btn danger"
            onClick={() =>
              store.openModal({
                kind: 'confirm',
                title: `Close ${c.name}?`,
                body: `This cannot be undone. ${c.employeeIds.length} employees will be laid off.`,
                confirmLabel: 'Close company',
                onConfirm: () => store.act((s) => closeCompany(s, c.id)),
              })
            }
          >
            Close company
          </button>
        </div>
      </Panel>
    </div>
  );
}

function ForSaleBanner({ c }: { c: Company }) {
  const st = useGame();
  const l = c.listing!;
  const h = c.history.slice(-30);
  const prof = h.reduce((a, d) => a + d.profit, 0);
  const rev = h.reduce((a, d) => a + d.revenue, 0);
  const cash = balance(st, PLAYER);
  const years = prof > 0 ? l.askingPrice / (prof * 12) : null;
  return (
    <section className="panel" style={{ borderColor: 'var(--gold-dim)' }} data-testid="for-sale">
      <div className="panel-b row wrap between" style={{ gap: 16 }}>
        <div className="col" style={{ gap: 4, minWidth: 240, flex: 1 }}>
          <span className="eyebrow gold">For sale · listed {formatDate(l.listedDay)}</span>
          <span className="muted small">{l.story} Staff, equipment, stock and the lease transfer to you; the seller keeps the cash in the business.</span>
          <span className="small">
            Last 30 days: revenue {money(rev)}, profit <Money v={prof} />.{' '}
            {years !== null ? <span className="dim">Price is {years.toFixed(1)}× a year of profit.</span> : <span className="neg">Currently losing money.</span>}
          </span>
        </div>
        <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
          <span className="stat"><span className="value">{money(l.askingPrice)}</span></span>
          <button
            className="btn primary"
            disabled={cash < l.askingPrice}
            data-testid="buy-business"
            onClick={() =>
              store.openModal({
                kind: 'confirm',
                title: `Buy ${c.name}?`,
                body: `Pay ${money(l.askingPrice)} for the business, its ${c.employeeIds.length} staff and its location. It will need working capital for payroll right away.`,
                confirmLabel: 'Buy business',
                onConfirm: () => {
                  const res = store.act((s) => buyBusiness(s, c.id));
                  if (res.ok) store.openCompany(c.id);
                },
              })
            }
          >
            Buy business
          </button>
          {cash < l.askingPrice && <span className="dim tiny">You need {money(l.askingPrice - cash)} more.</span>}
        </div>
      </div>
    </section>
  );
}
