import { useMemo, useState } from 'react';
import { store, useGame } from '../../app/store';
import { BarChart, LineChart } from '../../components/charts';
import { Money, MoneyInput, Notice, Panel, Stat } from '../../components/ui';
import { accountLabel, balance, isPlayerAccount, PLAYER } from '../../simulation/finance/ledger';
import { creditOffer, repayLoan, takeLoan } from '../../simulation/finance/loans';
import { balanceSheet, monthlyDebtService } from '../../simulation/finance/valuation';
import type { TxCategory } from '../../types/core';
import { formatShortDate } from '../../utils/date';
import { money, pct } from '../../utils/format';
import { empireDailyFlows, flowLabels, sumFlows } from '../selectors';

const CAT_LABEL: Partial<Record<TxCategory, string>> = {
  revenue: 'Sales revenue',
  rental_income: 'Rental income',
  payroll: 'Payroll',
  rent: 'Rent',
  cogs: 'Cost of goods',
  inventory: 'Inventory',
  utilities: 'Utilities & overhead',
  marketing: 'Marketing',
  hosting: 'Hosting',
  supplies: 'Supplies',
  upkeep: 'Property costs',
  commission: 'Commissions',
  loan_interest: 'Loan interest',
  loan_principal: 'Loan principal',
  management_fee: 'Management fees',
  org_income: 'Organization income',
  org_upkeep: 'Organization upkeep',
  event: 'Events & fines',
  training: 'Training',
  severance: 'Severance',
  renovation: 'Renovation',
  closing_costs: 'Closing costs',
  setup: 'Company setup',
};

export function FinanceView() {
  const st = useGame();
  const [tab, setTab] = useState<'overview' | 'ledger' | 'debt'>('overview');
  return (
    <div className="page" data-testid="finance-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Treasury</div>
          <h1>Finance</h1>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={tab === 'ledger' ? 'on' : ''} onClick={() => setTab('ledger')} data-testid="tab-ledger">
          Ledger
        </button>
        <button className={tab === 'debt' ? 'on' : ''} onClick={() => setTab('debt')} data-testid="tab-debt">
          Debt & credit {st.loans.length ? `(${st.loans.length})` : ''}
        </button>
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'ledger' && <Ledger />}
      {tab === 'debt' && <Debt />}
    </div>
  );
}

function Overview() {
  const st = useGame();
  const bs = balanceSheet(st);
  const flows = empireDailyFlows(st, 90);
  const m30 = sumFlows(flows, 30);
  // Category breakdown, last 30 days
  const from = st.day - 29;
  const byCat = new Map<TxCategory, number>();
  for (let i = st.ledger.entries.length - 1; i >= 0; i--) {
    const tx = st.ledger.entries[i];
    if (tx.day < from) break;
    const toMine = isPlayerAccount(st, tx.to);
    const fromMine = isPlayerAccount(st, tx.from);
    if (toMine === fromMine) continue;
    byCat.set(tx.category, (byCat.get(tx.category) ?? 0) + (toMine ? tx.amount : -tx.amount));
  }
  const cats = [...byCat.entries()].filter(([c]) => CAT_LABEL[c]).sort((a, b) => b[1] - a[1]);
  const nwh = st.player.netWorthHistory;
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="panel">
        <div className="kpis">
          <Stat label="Net worth" value={money(bs.netWorth)} large />
          <Stat label="Income · 30d" value={<span className="pos">{money(m30.income)}</span>} />
          <Stat label="Expenses · 30d" value={<span className="neg">{money(m30.expenses)}</span>} />
          <Stat label="Net · 30d" value={<Money v={m30.net} sign />} sub={m30.income ? `Margin ${pct(m30.net / m30.income)}` : undefined} />
        </div>
      </section>
      <div className="grid g-main-side">
        <div className="col" style={{ gap: 18 }}>
          <Panel title="Income vs expenses" actions={<span className="dim small">Daily, last 90 days</span>}>
            <LineChart
              series={[
                { name: 'Income', color: 'var(--pos)', values: flows.map((f) => f.income), area: true },
                { name: 'Expenses', color: 'var(--neg)', values: flows.map((f) => f.expenses) },
              ]}
              labels={flowLabels(flows)}
              format={(v) => money(v)}
              height={220}
            />
          </Panel>
          <Panel title="Net worth history">
            <LineChart series={[{ name: 'Net worth', color: 'var(--gold)', values: nwh.map((h) => h.value), area: true }]} labels={nwh.map((h) => formatShortDate(h.day))} format={(v) => money(v)} height={160} />
          </Panel>
          <Panel title="Cash flow by category · 30 days" tight>
            {cats.length ? (
              <table className="table">
                <tbody>
                  {cats.map(([c, v]) => (
                    <tr key={c}>
                      <td>{CAT_LABEL[c]}</td>
                      <td className="r">
                        <Money v={v} sign />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty small">No activity in the last 30 days.</div>
            )}
          </Panel>
        </div>
        <Panel title="Balance sheet">
          <div className="kv" data-testid="balance-sheet">
            <span className="eyebrow" style={{ gridColumn: '1 / -1' }}>
              Assets
            </span>
            <span>Personal cash</span>
            <span>{money(bs.cash)}</span>
            <span>Company equity (valuation)</span>
            <span>{money(bs.companyEquity)}</span>
            <span>Personally held property</span>
            <span>{money(bs.properties)}</span>
            {bs.organization !== 0 && (
              <>
                <span>Organization treasury</span>
                <span>{money(bs.organization)}</span>
              </>
            )}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>Total assets</span>
            <span style={{ fontWeight: 600 }}>{money(bs.totalAssets)}</span>
            <span className="eyebrow" style={{ gridColumn: '1 / -1', marginTop: 10 }}>
              Liabilities
            </span>
            {st.loans.map((l) => (
              <FragmentKV key={l.id} k={l.lender} v={<span className="neg">{money(l.principal)}</span>} />
            ))}
            {!st.loans.length && <FragmentKV k="Loans" v="—" />}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>Total liabilities</span>
            <span style={{ fontWeight: 600 }}>{money(bs.totalLiabilities)}</span>
            <span style={{ color: 'var(--gold-2)', fontWeight: 600, marginTop: 10 }}>Net worth</span>
            <span style={{ color: 'var(--gold-2)', fontWeight: 600, marginTop: 10 }}>{money(bs.netWorth)}</span>
          </div>
          <div className="dim tiny" style={{ marginTop: 14 }}>
            Company equity includes company cash, equipment, inventory, company-held property and goodwill for profitable businesses with staff.
          </div>
        </Panel>
      </div>
      <Panel title="Daily net result">
        <BarChart values={flows.map((f) => f.net)} labels={flowLabels(flows)} format={(v) => money(v)} height={130} />
      </Panel>
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

const PAGE = 50;

function Ledger() {
  const st = useGame();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [cat, setCat] = useState<TxCategory | 'all'>('all');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const out = [];
    for (let i = st.ledger.entries.length - 1; i >= 0; i--) {
      const tx = st.ledger.entries[i];
      if (scope === 'mine' && !isPlayerAccount(st, tx.from) && !isPlayerAccount(st, tx.to)) continue;
      if (cat !== 'all' && tx.category !== cat) continue;
      out.push(tx);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.ledger.entries.length, scope, cat, st.ledger.nextId]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const cats = [...new Set(st.ledger.entries.map((t) => t.category))].sort();
  return (
    <Panel
      title={`Ledger · ${rows.length.toLocaleString()} transactions`}
      tight
      actions={
        <>
          <div className="seg">
            <button className={scope === 'mine' ? 'on' : ''} onClick={() => (setScope('mine'), setPage(0))}>
              Your accounts
            </button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => (setScope('all'), setPage(0))}>
              Whole economy
            </button>
          </div>
          <select className="select" style={{ width: 180, height: 28 }} value={cat} onChange={(e) => (setCat(e.target.value as TxCategory | 'all'), setPage(0))}>
            <option value="all">All categories</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {CAT_LABEL[c] ?? c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </>
      }
    >
      <table className="table" data-testid="ledger-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>From</th>
            <th>To</th>
            <th>Category</th>
            <th>Memo</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {view.map((tx) => {
            const inflow = isPlayerAccount(st, tx.to) && !isPlayerAccount(st, tx.from);
            const outflow = isPlayerAccount(st, tx.from) && !isPlayerAccount(st, tx.to);
            return (
              <tr key={tx.id}>
                <td className="dim small">{tx.id}</td>
                <td className="nowrap small">{formatShortDate(tx.day)}</td>
                <td className="small">{accountLabel(st, tx.from)}</td>
                <td className="small">{accountLabel(st, tx.to)}</td>
                <td className="small muted">{CAT_LABEL[tx.category] ?? tx.category.replace(/_/g, ' ')}</td>
                <td className="small muted ellipsis" style={{ maxWidth: 300 }}>
                  {tx.memo}
                </td>
                <td className={`r ${inflow ? 'pos' : outflow ? 'neg' : ''}`}>{money(tx.amount, { compact: false })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row between" style={{ padding: '10px 14px' }}>
        <span className="dim tiny">
          {st.ledger.archived.count > 0 ? `${st.ledger.archived.count.toLocaleString()} older transactions archived as category totals.` : 'Complete history.'}
        </span>
        <div className="row">
          <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Newer
          </button>
          <span className="small dim">
            {page + 1} / {pages}
          </span>
          <button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Older
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Debt() {
  const st = useGame();
  const offer = creditOffer(st);
  const [amount, setAmount] = useState(0);
  const [repay, setRepay] = useState<Record<string, number>>({});
  const cash = balance(st, PLAYER);
  return (
    <div className="grid g2">
      <Panel title="Outstanding debt" tight actions={<span className="dim small">{money(monthlyDebtService(st))}/mo total payments</span>}>
        {st.loans.length ? (
          st.loans.map((l) => (
            <div key={l.id} className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 10 }}>
              <div className="row between" style={{ width: '100%' }}>
                <div>
                  <div>{l.lender}</div>
                  <div className="dim tiny">
                    {l.kind} · {pct(l.annualRate, 2)} APR · {money(l.monthlyPayment)}/mo
                    {l.missedPayments > 0 && <span className="neg"> · {l.missedPayments} missed</span>}
                  </div>
                </div>
                <span className="neg num" style={{ fontSize: 16 }}>
                  {money(l.principal)}
                </span>
              </div>
              <div className="row" style={{ width: '100%' }}>
                <div className="grow">
                  <MoneyInput value={repay[l.id] ?? 0} onChange={(v) => setRepay({ ...repay, [l.id]: v })} max={Math.min(cash, l.principal)} placeholder="Extra repayment" />
                </div>
                <button className="btn outline sm" disabled={!(repay[l.id] > 0)} onClick={() => store.act((s) => repayLoan(s, l.id, repay[l.id])).ok && setRepay({ ...repay, [l.id]: 0 })}>
                  Repay
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty small">You are debt free.</div>
        )}
        <div className="list-item dim tiny">Payments are taken automatically from your personal cash on the 1st of each month. Missed payments add interest and a late fee, and damage your reputation.</div>
      </Panel>
      <Panel title="Bank credit">
        <div className="col" style={{ gap: 14 }}>
          {offer.available ? (
            <>
              <div className="kv">
                <span>Maximum loan</span>
                <span>{money(offer.maxAmount)}</span>
                <span>Interest rate</span>
                <span>{pct(offer.annualRate, 2)} APR</span>
                <span>Term</span>
                <span>{offer.termMonths} months</span>
                <span>Market base rate</span>
                <span>{pct(st.economy.interestRate, 2)}</span>
              </div>
              <div className="field">
                <label>Amount to borrow</label>
                <MoneyInput value={amount} onChange={setAmount} max={offer.maxAmount} />
              </div>
              <button className="btn primary" disabled={amount <= 0 || amount > offer.maxAmount} onClick={() => store.act((s) => takeLoan(s, amount)).ok && setAmount(0)} data-testid="take-loan">
                Borrow {amount > 0 ? money(amount) : ''}
              </button>
            </>
          ) : (
            <Notice kind="warn">{offer.reason}</Notice>
          )}
          <div className="dim tiny">Credit depends on reputation, missed payments and collateral (60% of property value, 25% of company equity, 30% of cash), less existing debt.</div>
        </div>
      </Panel>
    </div>
  );
}
