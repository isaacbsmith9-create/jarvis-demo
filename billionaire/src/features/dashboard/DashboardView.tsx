import { store, useGame } from '../../app/store';
import { BarChart, LineChart } from '../../components/charts';
import { Money, Notice, Panel, Progress, Stat } from '../../components/ui';
import { DISTRICTS } from '../../data/cities/miami';
import { SUBTYPES } from '../../data/companies/industries';
import { scenarioById } from '../../data/scenarios/scenarios';
import { balance, companyAccount } from '../../simulation/finance/ledger';
import { balanceSheet, monthlyDebtService, valueCompany } from '../../simulation/finance/valuation';
import { objectiveProgress } from '../../simulation/objectives';
import { isOwnedByPlayer } from '../../simulation/properties/properties';
import { formatDate, formatShortDate } from '../../utils/date';
import { money } from '../../utils/format';
import { alerts, empireDailyFlows, flowLabels, sumFlows } from '../selectors';
import { NewsList } from '../news/NewsView';

export function DashboardView() {
  const st = useGame();
  const bs = balanceSheet(st);
  const flows = empireDailyFlows(st, 60);
  const m30 = sumFlows(flows, 30);
  const obj = st.objective;
  const prog = objectiveProgress(st);
  const companies = Object.values(st.companies).filter((c) => c.status !== 'closed');
  const props = Object.values(st.properties).filter((p) => isOwnedByPlayer(st, p));
  const al = alerts(st);
  const nwh = st.player.netWorthHistory;
  const scenario = scenarioById(st.player.scenarioId);
  const empty = companies.length === 0 && props.length === 0;

  return (
    <div className="page" data-testid="dashboard">
      <div className="page-h">
        <div>
          <div className="eyebrow">
            {scenario.title} · {formatDate(st.day)}
          </div>
          <h1>{st.player.name}'s Empire</h1>
        </div>
        <div className="row">
          <button className="btn outline" onClick={() => store.setView('city')}>
            Explore Miami
          </button>
          <button className="btn primary" onClick={() => store.openModal({ kind: 'found-company' })} data-testid="dash-found-company">
            Found a company
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="kpis">
          <Stat label="Net worth" value={money(bs.netWorth)} large sub={`Assets ${money(bs.totalAssets)} · Liabilities ${money(bs.totalLiabilities)}`} />
          <Stat label="Personal cash" value={money(bs.cash)} sub={`${money(bs.companyEquity)} in company equity`} />
          <Stat label="Operating result · 30 days" value={<Money v={m30.net} sign />} sub={`${money(m30.income)} in · ${money(m30.expenses)} out`} />
          <Stat label="Holdings" value={`${companies.length} co · ${props.length} prop`} sub={`${Object.values(st.employees).filter((e) => e.companyId).length} employees`} />
          <Stat label="Debt" value={bs.loans ? <span className="neg">{money(bs.loans)}</span> : '—'} sub={bs.loans ? `${money(monthlyDebtService(st))}/mo payments` : 'Debt free'} />
        </div>
      </section>

      {empty && (
        <Notice>
          <strong>Getting started.</strong> Open the <a className="gold" style={{ cursor: 'pointer' }} onClick={() => store.setView('city')}>City</a> to inspect properties, or{' '}
          <a className="gold" style={{ cursor: 'pointer' }} onClick={() => store.openModal({ kind: 'found-company' })}>
            found a company
          </a>
          . With little cash, a home-based software agency or online store is the cheapest start — you can work in it yourself. Then press <kbd>Space</kbd> to let time run.
        </Notice>
      )}

      <div className="grid g-main-side">
        <div className="col" style={{ gap: 18 }}>
          <Panel title="Net worth" actions={<span className="dim small">Weekly</span>}>
            <LineChart series={[{ name: 'Net worth', color: 'var(--gold)', values: nwh.map((h) => h.value), area: true }]} labels={nwh.map((h) => formatShortDate(h.day))} format={(v) => money(v)} height={200} />
          </Panel>
          <Panel title="Daily operating result" actions={<span className="dim small">Last 60 days · all businesses and properties</span>}>
            <BarChart values={flows.map((f) => f.net)} labels={flowLabels(flows)} format={(v) => money(v)} height={150} />
          </Panel>
          <Panel
            title="Companies"
            tight
            actions={
              <button className="btn sm ghost" onClick={() => store.setView('companies')}>
                View all
              </button>
            }
          >
            {companies.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Type</th>
                    <th className="r">Revenue 30d</th>
                    <th className="r">Profit 30d</th>
                    <th className="r">Cash</th>
                    <th className="r">Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => {
                    const h = c.history.slice(-30);
                    const rev = h.reduce((a, d) => a + d.revenue, 0);
                    const prof = h.reduce((a, d) => a + d.profit, 0);
                    return (
                      <tr key={c.id} className="click" onClick={() => store.openCompany(c.id)}>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            {c.name}
                            {c.status === 'distressed' && <span className="tag neg">Distressed</span>}
                          </div>
                        </td>
                        <td className="muted">{SUBTYPES[c.subtype].name}</td>
                        <td className="r">{money(rev)}</td>
                        <td className="r">
                          <Money v={prof} />
                        </td>
                        <td className="r">{money(balance(st, companyAccount(c.id)))}</td>
                        <td className="r">{money(valueCompany(st, c).total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty">
                <h4>No companies yet</h4>
                <span className="small">Found one to start generating revenue.</span>
              </div>
            )}
          </Panel>
          <Panel
            title="Property portfolio"
            tight
            actions={
              <button className="btn sm ghost" onClick={() => store.setView('properties')}>
                View all
              </button>
            }
          >
            {props.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>District</th>
                    <th>Use</th>
                    <th className="r">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {props.map((p) => (
                    <tr key={p.id} className="click" onClick={() => store.openProperty(p.id, true)}>
                      <td>{p.name}</td>
                      <td className="muted">{DISTRICTS[p.district].name}</td>
                      <td className="muted">{p.use.kind === 'rented' ? `Rented (${Math.round(p.use.occupancy * 100)}%)` : p.use.kind === 'company' ? st.companies[p.use.companyId]?.name : 'Vacant'}</td>
                      <td className="r">{money(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">
                <h4>No properties</h4>
                <span className="small">Browse listings in the City view.</span>
              </div>
            )}
          </Panel>
        </div>
        <div className="col" style={{ gap: 18 }}>
          <Panel title="Objective" style={{ borderColor: obj.completedDay !== null ? 'var(--pos)' : obj.failed ? 'var(--neg)' : 'var(--gold-dim)' }}>
            <div className="col" style={{ gap: 10 }} data-testid="objective">
              <div className="row between">
                <h3 className="display" style={{ fontSize: 22 }}>
                  {obj.title}
                </h3>
                {obj.completedDay !== null ? <span className="tag pos">Complete</span> : obj.failed ? <span className="tag neg">Missed</span> : null}
              </div>
              <div className="muted small">{obj.description}</div>
              <Progress ratio={prog.ratio} tone={obj.completedDay !== null ? 'pos' : undefined} />
              <div className="row between small">
                <span>{prog.label}</span>
                <span className="dim">{obj.completedDay !== null ? `Completed ${formatDate(obj.completedDay)}` : obj.deadlineDay !== null ? `${Math.max(0, obj.deadlineDay - st.day)} days left` : 'No deadline'}</span>
              </div>
            </div>
          </Panel>
          <Panel title={`Attention${al.length ? ` (${al.length})` : ''}`} tight>
            {al.length ? (
              <div data-testid="alerts">
                {al.slice(0, 8).map((a, i) => (
                  <div
                    key={i}
                    className="list-item click"
                    onClick={() => (a.companyId ? store.openCompany(a.companyId) : a.propertyId ? store.openProperty(a.propertyId, true) : a.view ? store.setView(a.view) : undefined)}
                  >
                    <span className="dot" style={{ background: a.level === 'neg' ? 'var(--neg)' : 'var(--warn)' }} />
                    <span className="small">{a.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty small">Nothing needs your attention.</div>
            )}
          </Panel>
          <Panel
            title="Latest news"
            tight
            actions={
              <button className="btn sm ghost" onClick={() => store.setView('news')}>
                All news
              </button>
            }
          >
            <NewsList items={st.news.slice(0, 7)} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
