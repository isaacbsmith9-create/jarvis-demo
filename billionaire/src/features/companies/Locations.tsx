import { useMemo, useState } from 'react';
import { store, useGame, useStore } from '../../app/store';
import { Modal, Notice, Panel } from '../../components/ui';
import { DISTRICTS } from '../../data/cities/miami';
import { SUBTYPES } from '../../data/companies/industries';
import { canHaveBranches, closeBranch, maxStaffAt, openBranch, quoteBranch, quoteRelocation, relocateBranch } from '../../simulation/companies/companies';
import { companyDailyRent } from '../../simulation/companies/industryRules';
import { branchLabel, branchStaffIds, unitFor } from '../../simulation/companies/units';
import { balance, companyAccount, PLAYER } from '../../simulation/finance/ledger';
import { isOwnedByPlayer, leaseRent } from '../../simulation/properties/properties';
import type { Branch, Company } from '../../types/core';
import { formatDate } from '../../utils/date';
import { money, moneyFull, num } from '../../utils/format';

function branchStat(c: Company, b: Branch): string {
  const o = b.ops;
  if (o.kind === 'hospitality') return `${num(o.lastCustomers)} served / ${num(o.lastCapacity)} capacity · demand ${num(o.lastDemand)}`;
  if (o.kind === 'retail') return `${num(o.lastCustomers)} ${c.subtype === 'online' ? 'orders' : 'shoppers'} · ${num(o.inventory)} units in stock`;
  if (o.kind === 'technology') return c.subtype === 'saas' ? `${num(o.users)} subscribers` : `${Math.round(o.utilization * 100)}% utilization`;
  return `${num(o.dealsClosed)} deals closed`;
}

export function Locations({ c }: { c: Company }) {
  const st = useGame();
  const sub = SUBTYPES[c.subtype];
  const can = canHaveBranches(c.subtype);
  return (
    <div className="col" style={{ gap: 18 }} data-testid="locations">
      <Panel
        title={`${c.branches.length} location${c.branches.length > 1 ? 's' : ''}`}
        tight
        actions={
          can ? (
            <button className="btn sm primary" onClick={() => store.openModal({ kind: 'branch', companyId: c.id })} data-testid="open-branch">
              Open a new location
            </button>
          ) : undefined
        }
      >
        {c.branches.map((b, i) => {
          const unit = unitFor(st, c, b);
          const prop = b.locationId ? st.properties[b.locationId] : null;
          const rent = companyDailyRent(st, unit);
          const staff = branchStaffIds(st, c, b).length;
          return (
            <div key={b.id} className="list-item" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }} data-testid={`branch-${b.id}`}>
              <div className="col grow" style={{ gap: 3, minWidth: 220 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <strong>{branchLabel(st, c, b)}</strong>
                  {i === 0 && <span className="tag gold">Flagship</span>}
                  {prop && <span className="tag">{DISTRICTS[prop.district].name}</span>}
                  {prop && <span className="tag">{isOwnedByPlayer(st, prop) ? 'Owned' : 'Leased'}</span>}
                </div>
                <span className="small muted">{branchStat(c, b)}</span>
                <span className="small dim">
                  {staff} / {maxStaffAt(st, c, b)} staff{unit.ownerOperated ? ' + you' : ''} · {rent ? `${money(Math.round((rent * 365) / 12))}/mo rent` : prop ? 'no rent' : 'no premises'} · opened {formatDate(Math.max(0, b.openedDay))}
                </span>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                {prop && (
                  <button className="btn sm ghost" onClick={() => store.openProperty(prop.id, true)}>
                    Map
                  </button>
                )}
                {!sub.mobile && (
                  <button className="btn sm" onClick={() => store.openModal({ kind: 'branch', companyId: c.id, branchId: b.id })} data-testid={`move-${b.id}`}>
                    Move
                  </button>
                )}
                {c.branches.length > 1 && (
                  <button
                    className="btn sm danger"
                    onClick={() =>
                      store.openModal({
                        kind: 'confirm',
                        title: `Close ${branchLabel(st, c, b)}?`,
                        body: `Its staff move to your other locations where there is room; anyone else is let go with two weeks' severance. Equipment sells for 25% of book value and the space goes back on the market.`,
                        confirmLabel: 'Close location',
                        onConfirm: () => store.act((s) => closeBranch(s, c.id, b.id)),
                      })
                    }
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </Panel>
      {can ? (
        <Notice>
          Each location has its own staff, customers and costs. New locations cost {Math.round(60)}% of a first fit-out because the brand and systems already exist, and are paid from company cash. Marketing is one budget that helps every location.
        </Notice>
      ) : (
        <Notice>A SaaS company is one product, so it runs from a single office. You can still move to a bigger one.</Notice>
      )}
    </div>
  );
}

/** Modal to open a new location (no branchId) or move an existing one (branchId). */
export function BranchModal() {
  const s = useStore();
  const st = s.state!;
  const m = s.modal!;
  const c = st.companies[m.companyId!];
  const moving = m.branchId ? c.branches.find((b) => b.id === m.branchId) : undefined;
  const sub = SUBTYPES[c.subtype];
  const [locationId, setLocationId] = useState<string | null>(m.propertyId ?? null);
  const options = useMemo(() => {
    const list = Object.values(st.properties).filter((p) => sub.propertyTypes.includes(p.type) && p.use.kind === 'vacant');
    return { owned: list.filter((p) => isOwnedByPlayer(st, p)), lease: list.filter((p) => !isOwnedByPlayer(st, p) && p.forLease) };
  }, [st, sub]);
  if (!c) return null;
  const mobileNew = sub.mobile && !moving;
  const q = moving ? (locationId ? quoteRelocation(st, c.id, locationId) : null) : quoteBranch(st, c.id, mobileNew ? null : locationId);
  const companyCash = balance(st, companyAccount(c.id));
  const reachable = companyCash + (c.settings.autoFund ? Math.max(0, balance(st, PLAYER)) : 0);
  const prop = locationId ? st.properties[locationId] : null;
  const close = () => s.openModal(null);
  const submit = () => {
    const res = moving ? store.act((x) => relocateBranch(x, c.id, moving.id, locationId!)) : store.act((x) => openBranch(x, c.id, mobileNew ? null : locationId));
    if (res.ok) close();
  };
  const title = moving ? `Move ${branchLabel(st, c, moving)}` : mobileNew ? `Add a truck to ${c.name}` : `New location for ${c.name}`;
  return (
    <Modal
      title={title}
      onClose={close}
      footer={
        <>
          <span className="dim small" style={{ marginRight: 'auto' }}>
            Company cash {money(companyCash)}
            {c.settings.autoFund ? ` · auto-funding from your ${money(balance(st, PLAYER))}` : ''}
          </span>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" disabled={!q || q.errors.length > 0 || q.minimum > reachable || (!mobileNew && !locationId)} onClick={submit} data-testid="confirm-branch">
            {moving ? 'Move here' : 'Open location'}
            {q ? ` · ${money(q.minimum)}` : ''}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        {!mobileNew && (
          <div className="field">
            <label>{moving ? 'New premises' : 'Premises'}</label>
            <select className="select" value={locationId ?? ''} onChange={(e) => setLocationId(e.target.value || null)} data-testid="branch-location">
              <option value="">Select a property…</option>
              {options.owned.length > 0 && (
                <optgroup label="Your vacant properties (no rent)">
                  {options.owned.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {DISTRICTS[p.district].name}, {p.sqft.toLocaleString()} sq ft
                    </option>
                  ))}
                </optgroup>
              )}
              {options.lease.length > 0 && (
                <optgroup label="Available to lease">
                  {options.lease.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {DISTRICTS[p.district].name}, {p.sqft.toLocaleString()} sq ft, {money(leaseRent(p))}/mo
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {options.owned.length + options.lease.length === 0 && <span className="dim tiny">No suitable vacant properties right now. Buy one in the City view, or wait for new lease listings (they change weekly).</span>}
            {prop && (
              <span className="dim tiny">
                {DISTRICTS[prop.district].name}: {DISTRICTS[prop.district].demographics}. Fit for this business ×{(DISTRICTS[prop.district].affinity[c.subtype] ?? 1).toFixed(2)}. Room for {Math.max(4, Math.floor(prop.sqft / (c.industry === 'hospitality' ? 180 : 150)))} staff.
              </span>
            )}
          </div>
        )}
        {mobileNew && <div className="muted">A second truck parks in whichever district has the best demand each day. Hire a cook for it after it opens.</div>}
        {q && (
          <div className="panel">
            <div className="panel-b kv">
              <span>{moving ? 'Moving & new fit-out work' : 'Fit-out & equipment'}</span>
              <span>{moneyFull(q.setup)}</span>
              {q.inventory > 0 && (
                <>
                  <span>Opening stock</span>
                  <span>{moneyFull(q.inventory)}</span>
                </>
              )}
              {q.deposit > 0 && (
                <>
                  <span>Lease deposit</span>
                  <span>{moneyFull(q.deposit)}</span>
                  <span>Ongoing rent</span>
                  <span>{moneyFull(q.monthlyRent)}/mo</span>
                </>
              )}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>Total now</span>
              <span style={{ fontWeight: 600 }}>{moneyFull(q.minimum)}</span>
            </div>
          </div>
        )}
        {moving && <div className="dim small">Staff, equipment, stock and customers' goodwill move with you. The old space goes back on the market{moving.locationId && st.properties[moving.locationId] && isOwnedByPlayer(st, st.properties[moving.locationId]) ? ' (you keep owning it, vacant)' : ''}.</div>}
        {q?.errors.map((e) => (
          <Notice key={e} kind="warn">
            {e}
          </Notice>
        ))}
        {q && q.errors.length === 0 && q.minimum > reachable && <Notice kind="neg">Not enough cash. Add capital to {c.name} or turn on auto-funding.</Notice>}
      </div>
    </Modal>
  );
}
