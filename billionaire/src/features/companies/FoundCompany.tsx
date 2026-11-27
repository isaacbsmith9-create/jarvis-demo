import { useMemo, useState } from 'react';
import { store, useStore } from '../../app/store';
import { Modal, MoneyInput, Notice } from '../../components/ui';
import { DISTRICTS } from '../../data/cities/miami';
import { INDUSTRIES, SUBTYPES, SUBTYPES_BY_INDUSTRY } from '../../data/companies/industries';
import { foundCompany, quoteFounding, type FoundingPlan } from '../../simulation/companies/companies';
import { balance, PLAYER } from '../../simulation/finance/ledger';
import { isOwnedByPlayer, leaseRent } from '../../simulation/properties/properties';
import type { IndustryId, SubtypeId } from '../../types/core';
import { money, moneyFull } from '../../utils/format';

const NAME_IDEAS: Record<SubtypeId, string[]> = {
  brokerage: ['Meridian Realty', 'Bayfront Property Group', 'Keystone Estates'],
  agency: ['Northbeam Labs', 'Coral Code Studio', 'Atlas Digital'],
  saas: ['Lumen Cloud', 'Tidal Software', 'Vantage Apps'],
  restaurant: ['Casa Dorada', 'The Copper Table', 'Bistro Palma'],
  hotel: ['The Marlowe', 'Hotel Solace', 'Coralina Suites'],
  nightclub: ['Club Obsidian', 'Lantern Room', 'Velvet Hour'],
  foodtruck: ['Fuego Wheels', 'Street Croqueta', 'Bayside Bites'],
  boutique: ['Maison Coral', 'Thread & Tide', 'Linen House'],
  convenience: ['Corner Market', 'Esquina Express', 'Daily Bodega'],
  online: ['Palmline Goods', 'Shoreline Supply', 'Boxed & Co.'],
};

export function FoundCompanyModal() {
  const s = useStore();
  const st = s.state!;
  const preset = s.modal?.propertyId ? st.properties[s.modal.propertyId] : null;
  const presetSubtypes = preset ? (Object.keys(SUBTYPES) as SubtypeId[]).filter((k) => SUBTYPES[k].propertyTypes.includes(preset.type)) : null;
  const [subtype, setSubtype] = useState<SubtypeId>(presetSubtypes?.[0] ?? 'agency');
  const [locationId, setLocationId] = useState<string | null>(preset?.id ?? null);
  const [name, setName] = useState('');
  const [capital, setCapital] = useState<number>(0);
  const sub = SUBTYPES[subtype];
  const cash = balance(st, PLAYER);

  const options = useMemo(() => {
    const list = Object.values(st.properties).filter((p) => sub.propertyTypes.includes(p.type) && p.use.kind === 'vacant');
    const owned = list.filter((p) => isOwnedByPlayer(st, p));
    const lease = list.filter((p) => !isOwnedByPlayer(st, p) && p.forLease);
    return { owned, lease };
  }, [st, sub]);

  const locProp = locationId ? st.properties[locationId] : null;
  const mode: FoundingPlan['locationMode'] = !locProp ? 'none' : isOwnedByPlayer(st, locProp) ? 'own' : 'lease';
  const validLocation = !locProp || sub.propertyTypes.includes(locProp.type);
  const plan: FoundingPlan = { subtype, locationId: validLocation ? locationId : null, locationMode: validLocation ? mode : 'none' };
  const q = quoteFounding(st, plan);
  const cap = capital || Math.min(q.recommended, Math.max(q.minimum, cash));
  const canAfford = cash >= cap;
  const nameOk = name.trim().length >= 2;

  const chooseSubtype = (k: SubtypeId) => {
    setSubtype(k);
    setCapital(0);
    const sd = SUBTYPES[k];
    if (locProp && !sd.propertyTypes.includes(locProp.type)) setLocationId(null);
    if (sd.mobile) setLocationId(null);
  };

  const submit = () => {
    const res = store.act((state) => foundCompany(state, name, plan, cap));
    if (res.ok && res.id) {
      store.openModal(null);
      store.openCompany(res.id);
    }
  };

  return (
    <Modal
      title="Found a company"
      onClose={() => store.openModal(null)}
      size="wide"
      footer={
        <>
          <span className="dim small" style={{ marginRight: 'auto' }}>
            Your cash: {money(cash)}
          </span>
          <button className="btn ghost" onClick={() => store.openModal(null)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!nameOk || q.errors.length > 0 || cap < q.minimum || !canAfford} onClick={submit} data-testid="confirm-found">
            Found {name.trim() || 'company'} · {money(cap)}
          </button>
        </>
      }
    >
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', gap: 24 }}>
        <div className="col" style={{ gap: 18 }}>
          {(Object.keys(SUBTYPES_BY_INDUSTRY) as IndustryId[]).map((ind) => (
            <div key={ind} className="col" style={{ gap: 8 }}>
              <div className="row between">
                <span className="eyebrow" style={{ color: INDUSTRIES[ind].color }}>
                  {INDUSTRIES[ind].name}
                </span>
                <span className="dim tiny">{INDUSTRIES[ind].description}</span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {SUBTYPES_BY_INDUSTRY[ind].map((k) => {
                  const sd = SUBTYPES[k];
                  const disabled = !!presetSubtypes && !presetSubtypes.includes(k);
                  const minQ = quoteFounding(st, { subtype: k, locationId: null, locationMode: 'none' });
                  return (
                    <button key={k} className={`choice ${subtype === k ? 'on' : ''}`} disabled={disabled} onClick={() => chooseSubtype(k)} data-testid={`subtype-${k}`}>
                      <h4>{sd.name}</h4>
                      <p>{sd.model}</p>
                      <span className="tiny dim">{sd.mobile ? `Mobile · from ${money(minQ.minimum)}` : sd.locationOptional ? `Home-based from ${money(minQ.minimum)}` : 'Needs a location'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="panel">
            <div className="panel-b col" style={{ gap: 6 }}>
              <div className="display" style={{ fontSize: 22 }}>
                {sub.name}
              </div>
              <div className="muted small">{sub.description}</div>
            </div>
          </div>
          <div className="field">
            <label>Location</label>
            <select className="select" value={locationId ?? ''} onChange={(e) => setLocationId(e.target.value || null)} data-testid="location-select">
              {(sub.locationOptional || sub.mobile) && <option value="">{sub.mobile ? 'Mobile — moves to the best district daily' : 'Home-based (no property, limited size)'}</option>}
              {!sub.locationOptional && !locationId && <option value="">Select a property…</option>}
              {options.owned.length > 0 && (
                <optgroup label="Your vacant properties">
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
                      {p.name} — {DISTRICTS[p.district].name}, {money(leaseRent(p))}/mo
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {sub.mobile ? null : options.owned.length + options.lease.length === 0 && <span className="dim tiny">No suitable vacant properties right now. Buy one in the City view or wait for new lease listings.</span>}
            {locProp && (
              <span className="dim tiny">
                {DISTRICTS[locProp.district].name}: {DISTRICTS[locProp.district].demographics}. Fit for this business: ×{(DISTRICTS[locProp.district].affinity[subtype] ?? 1).toFixed(2)}
              </span>
            )}
          </div>
          <div className="field">
            <label>Company name</label>
            <input className="input" value={name} maxLength={40} placeholder={NAME_IDEAS[subtype][0]} onChange={(e) => setName(e.target.value)} data-testid="company-name" />
            <div className="row wrap" style={{ gap: 6 }}>
              {NAME_IDEAS[subtype].map((n) => (
                <button key={n} className="btn sm ghost" onClick={() => setName(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-h">
              <h3>Startup costs</h3>
            </div>
            <div className="panel-b kv">
              <span>Setup & equipment</span>
              <span>{moneyFull(q.setup)}</span>
              {q.inventory > 0 && (
                <>
                  <span>Opening inventory</span>
                  <span>{moneyFull(q.inventory)}</span>
                </>
              )}
              {q.deposit > 0 && (
                <>
                  <span>Lease deposit (first month)</span>
                  <span>{moneyFull(q.deposit)}</span>
                  <span>Ongoing rent</span>
                  <span>{moneyFull(q.monthlyRent)}/mo</span>
                </>
              )}
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Minimum capital</span>
              <span style={{ fontWeight: 600 }}>{moneyFull(q.minimum)}</span>
              <span>Recommended (with working capital)</span>
              <span>{moneyFull(q.recommended)}</span>
            </div>
          </div>
          <div className="field">
            <label>Starting capital you invest</label>
            <MoneyInput value={cap} onChange={setCapital} max={cash} />
            <span className="dim tiny">Anything above startup costs stays in the company as working capital for payroll and expenses.</span>
          </div>
          {q.errors.map((e) => (
            <Notice key={e} kind="warn">
              {e}
            </Notice>
          ))}
          {!canAfford && <Notice kind="neg">You only have {money(cash)}. Lower the capital or raise money first.</Notice>}
          {cap < q.minimum && canAfford && <Notice kind="warn">Capital must cover at least {money(q.minimum)}.</Notice>}
        </div>
      </div>
    </Modal>
  );
}
