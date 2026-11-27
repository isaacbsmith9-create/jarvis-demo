import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { Panel, Stat } from '../../components/ui';
import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import { PROPERTY_TYPE_LABEL } from '../../data/properties/miami';
import { dailyUpkeep, isOwnedByPlayer, leaseRent, monthlyMarketRent } from '../../simulation/properties/properties';
import type { DistrictId, Property, PropertyType } from '../../types/core';
import { money, pct } from '../../utils/format';
import { PropertyPanel } from './PropertyPanel';

type SortKey = 'name' | 'district' | 'price' | 'sqft' | 'yield';

export function PropertiesView() {
  const st = useGame();
  const [tab, setTab] = useState<'portfolio' | 'sale' | 'lease'>('portfolio');
  const [district, setDistrict] = useState<DistrictId | 'all'>('all');
  const [type, setType] = useState<PropertyType | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'price', dir: 1 });
  const sel = store.selection.propertyId;
  const all = Object.values(st.properties);
  const owned = all.filter((p) => isOwnedByPlayer(st, p));
  const forSale = all.filter((p) => !isOwnedByPlayer(st, p) && p.forSale !== null);
  const forLease = all.filter((p) => !isOwnedByPlayer(st, p) && p.forLease && p.use.kind === 'vacant');
  const base = tab === 'portfolio' ? owned : tab === 'sale' ? forSale : forLease;
  const yieldOf = (p: Property) => (monthlyMarketRent(p) * 12 * 0.9 - dailyUpkeep(p) * 365) / p.value;
  const price = (p: Property) => (tab === 'sale' ? p.forSale ?? p.value : tab === 'lease' ? leaseRent(p) : p.value);
  const rows = base
    .filter((p) => (district === 'all' || p.district === district) && (type === 'all' || p.type === type))
    .sort((a, b) => {
      const k = sort.key;
      const v = k === 'name' ? a.name.localeCompare(b.name) : k === 'district' ? a.district.localeCompare(b.district) : k === 'price' ? price(a) - price(b) : k === 'sqft' ? a.sqft - b.sqft : yieldOf(a) - yieldOf(b);
      return v * sort.dir;
    });
  const totalValue = owned.reduce((s, p) => s + p.value, 0);
  const rentIncome = owned.reduce((s, p) => s + (p.use.kind === 'rented' ? monthlyMarketRent(p) * p.use.occupancy : 0), 0);
  const upkeep = owned.reduce((s, p) => s + dailyUpkeep(p) * 30, 0);
  const th = (k: SortKey, label: string, r = false) => (
    <th className={`sortable ${r ? 'r' : ''}`} onClick={() => setSort({ key: k, dir: sort.key === k ? ((-sort.dir) as 1 | -1) : 1 })}>
      {label}
      {sort.key === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="page" data-testid="properties-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Real estate</div>
          <h1>Property</h1>
        </div>
        <button className="btn outline" onClick={() => store.setView('city')}>
          Open city map
        </button>
      </div>
      <section className="panel">
        <div className="kpis">
          <Stat label="Portfolio value" value={money(totalValue)} sub={`${owned.length} properties`} />
          <Stat label="Rental income" value={`${money(rentIncome)}/mo`} sub="At current occupancy" />
          <Stat label="Ownership costs" value={`${money(upkeep)}/mo`} sub="Tax, insurance, maintenance" />
          <Stat label="Market" value={`${forSale.length} for sale`} sub={`${forLease.length} available to lease`} />
        </div>
      </section>
      <div className="row between wrap">
        <div className="tabs" style={{ borderBottom: 0 }}>
          <button className={tab === 'portfolio' ? 'on' : ''} onClick={() => setTab('portfolio')}>
            Portfolio ({owned.length})
          </button>
          <button className={tab === 'sale' ? 'on' : ''} onClick={() => setTab('sale')} data-testid="tab-for-sale">
            For sale ({forSale.length})
          </button>
          <button className={tab === 'lease' ? 'on' : ''} onClick={() => setTab('lease')}>
            For lease ({forLease.length})
          </button>
        </div>
        <div className="row">
          <select className="select" style={{ width: 190 }} value={district} onChange={(e) => setDistrict(e.target.value as DistrictId | 'all')}>
            <option value="all">All districts</option>
            {DISTRICT_ORDER.map((d) => (
              <option key={d} value={d}>
                {DISTRICTS[d].name}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 160 }} value={type} onChange={(e) => setType(e.target.value as PropertyType | 'all')}>
            <option value="all">All types</option>
            {(Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: sel ? 'minmax(0,1fr) 380px' : '1fr' }}>
        <Panel tight>
          {rows.length ? (
            <table className="table" data-testid="property-table">
              <thead>
                <tr>
                  {th('name', 'Property')}
                  {th('district', 'District')}
                  <th>Type</th>
                  {th('sqft', 'Sq ft', true)}
                  {th('price', tab === 'sale' ? 'Asking' : tab === 'lease' ? 'Rent / mo' : 'Value', true)}
                  {th('yield', 'Net yield', true)}
                  <th>{tab === 'portfolio' ? 'Use' : 'Owner'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={`click ${sel === p.id ? 'sel' : ''}`} onClick={() => store.openProperty(p.id)}>
                    <td>{p.name}</td>
                    <td className="muted">{DISTRICTS[p.district].name}</td>
                    <td className="muted">{PROPERTY_TYPE_LABEL[p.type]}</td>
                    <td className="r">{p.sqft.toLocaleString()}</td>
                    <td className="r">{money(price(p))}</td>
                    <td className="r">{pct(yieldOf(p), 1)}</td>
                    <td className="muted small">
                      {tab === 'portfolio'
                        ? p.use.kind === 'rented'
                          ? `Rented ${Math.round(p.use.occupancy * 100)}%`
                          : p.use.kind === 'company'
                            ? st.companies[p.use.companyId]?.name
                            : 'Vacant'
                        : p.owner.startsWith('rival:')
                          ? st.rivals[p.owner.slice(6)]?.name
                          : 'Private owner'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              <h4>{tab === 'portfolio' ? 'You do not own any properties' : 'Nothing matches'}</h4>
              <span className="small">{tab === 'portfolio' ? 'Browse the For sale tab or the city map.' : 'Try another district or type. Listings refresh weekly.'}</span>
            </div>
          )}
        </Panel>
        {sel && st.properties[sel] && (
          <div className="panel" style={{ alignSelf: 'start', position: 'sticky', top: 0, maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <PropertyPanel id={sel} onClose={() => store.select({ propertyId: null })} compact />
          </div>
        )}
      </div>
    </div>
  );
}
