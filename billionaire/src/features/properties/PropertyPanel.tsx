import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { Notice, Progress } from '../../components/ui';
import { DISTRICTS } from '../../data/cities/miami';
import { SUBTYPES } from '../../data/companies/industries';
import { PROPERTY_TYPE_LABEL } from '../../data/properties/miami';
import { balance, PLAYER } from '../../simulation/finance/ledger';
import { CLOSING_COST_RATE, dailyUpkeep, isOwnedByPlayer, leaseRent, monthlyMarketRent, renovationCost } from '../../simulation/properties/properties';
import { buyProperty, purchaseTotal, rentOut, renovateProperty, saleProceeds, sellProperty, stopRenting, transferProperty } from '../../simulation/properties/propertyActions';
import type { Property, SubtypeId } from '../../types/core';
import { money, moneyFull, pct } from '../../utils/format';

export function suitableSubtypes(p: Property): SubtypeId[] {
  return (Object.keys(SUBTYPES) as SubtypeId[]).filter((s) => SUBTYPES[s].propertyTypes.includes(p.type));
}

function ownerLabel(state: ReturnType<typeof useGame>, p: Property): string {
  if (p.owner === 'player') return 'You';
  if (p.owner.startsWith('co:')) return state.companies[p.owner.slice(3)]?.name ?? 'Your company';
  if (p.owner.startsWith('rival:')) return state.rivals[p.owner.slice(6)]?.name ?? 'Competitor';
  return 'Private owner';
}

export function PropertyPanel({ id, onClose, compact }: { id: string; onClose?: () => void; compact?: boolean }) {
  const state = useGame();
  const p = state.properties[id];
  const [buyer, setBuyer] = useState<string>('player');
  if (!p) return null;
  const owned = isOwnedByPlayer(state, p);
  const prof = DISTRICTS[p.district];
  const rent = monthlyMarketRent(p);
  const upkeepMonth = dailyUpkeep(p) * 30;
  const capRate = ((rent * 12 * 0.9 - upkeepMonth * 12) / p.value) || 0;
  const occupant = p.use.kind === 'company' ? state.companies[p.use.companyId] : null;
  const reCompanies = Object.values(state.companies).filter((c) => c.status !== 'closed' && c.industry === 'realestate');
  const cash = balance(state, PLAYER);
  const buyerCash = buyer === 'player' ? cash : balance(state, `co:${buyer}`);
  const total = purchaseTotal(p);
  const suit = suitableSubtypes(p);
  const reno = renovationCost(p);
  const sale = saleProceeds(p);

  const confirm = (title: string, body: string, label: string, fn: () => void) => store.openModal({ kind: 'confirm', title, body, confirmLabel: label, onConfirm: fn });

  let status: { text: string; cls: string };
  if (owned) status = { text: 'Owned', cls: 'gold' };
  else if (p.owner.startsWith('rival:')) status = { text: 'Competitor', cls: 'neg' };
  else if (p.forSale !== null) status = { text: 'For sale', cls: 'pos' };
  else if (p.forLease) status = { text: 'For lease', cls: 'blue' };
  else status = { text: 'Off market', cls: '' };

  return (
    <div className="col" style={{ gap: 0, height: '100%' }} data-testid="property-panel">
      <div className="insp-h">
        <div className="row between">
          <div className="row" style={{ gap: 6 }}>
            <span className={`tag ${status.cls}`}>{status.text}</span>
            <span className="tag">{PROPERTY_TYPE_LABEL[p.type]}</span>
          </div>
          {onClose && (
            <button className="close-x" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <h2>{p.name}</h2>
        <div className="muted small" style={{ marginTop: 4 }}>
          {prof.name} · {p.sqft.toLocaleString()} sq ft · Tier {p.tier} of 5
        </div>
      </div>
      <div className="inspector-scroll">
        <div className="insp-sec">
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div className="stat">
              <span className="label">{p.forSale !== null && !owned ? 'Asking price' : 'Estimated value'}</span>
              <span className="value lg" data-testid="property-price">
                {money(p.forSale !== null && !owned ? p.forSale : p.value)}
              </span>
            </div>
            <div className="right small">
              <div className="dim">Market value</div>
              <div>{money(p.value)}</div>
            </div>
          </div>
        </div>
        <div className="insp-sec">
          <h4>Economics</h4>
          <div className="kv">
            <span>Owner</span>
            <span>{ownerLabel(state, p)}</span>
            <span>Value per sq ft</span>
            <span>${Math.round(p.value / 100 / p.sqft)}</span>
            <span>Market rent (whole property)</span>
            <span>{money(rent)}/mo</span>
            <span>Ownership costs (tax, insurance, upkeep)</span>
            <span>{money(upkeepMonth)}/mo</span>
            <span>Est. net yield if rented</span>
            <span className={capRate >= 0 ? '' : 'neg'}>{pct(capRate, 1)}</span>
            {p.purchasePrice !== null && owned && (
              <>
                <span>Purchase price</span>
                <span>{money(p.purchasePrice)}</span>
                <span>Unrealized gain</span>
                <span className={p.value - p.purchasePrice >= 0 ? 'pos' : 'neg'}>{money(p.value - p.purchasePrice, { sign: true })}</span>
              </>
            )}
            {p.forLease && !owned && (
              <>
                <span>Lease for a business</span>
                <span>{money(leaseRent(p))}/mo</span>
              </>
            )}
          </div>
        </div>
        <div className="insp-sec">
          <h4>Current use</h4>
          {p.use.kind === 'vacant' && <div className="muted">Vacant.</div>}
          {p.use.kind === 'rented' && (
            <div className="col" style={{ gap: 6 }}>
              <div className="row between">
                <span className="muted">Leased to tenants</span>
                <span className="num">{pct(p.use.occupancy)} occupied</span>
              </div>
              <Progress ratio={p.use.occupancy} />
              {owned && <div className="dim small">Earning ≈ {money(rent * p.use.occupancy)}/mo before costs.</div>}
            </div>
          )}
          {occupant && (
            <div className="row between">
              <span>
                <span className="muted">Operated by </span>
                {occupant.name}
              </span>
              {occupant.owner === 'player' && occupant.status !== 'closed' && (
                <button className="btn sm outline" onClick={() => store.openCompany(occupant.id)}>
                  Manage
                </button>
              )}
            </div>
          )}
          {p.lease && <div className="dim small" style={{ marginTop: 6 }}>Lease: {money(p.lease.monthlyRent)}/mo paid to {p.owner === 'private' ? 'the landlord' : ownerLabel(state, p)}.</div>}
        </div>
        {!compact && (
          <div className="insp-sec">
            <h4>Suitable businesses</h4>
            {suit.length ? (
              <div className="row wrap" style={{ gap: 6 }}>
                {suit.map((s) => (
                  <span key={s} className="tag">
                    {SUBTYPES[s].name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="dim small">Residential: rent to tenants for income.</div>
            )}
          </div>
        )}
        <div className="insp-sec">
          <h4>{prof.name}</h4>
          <div className="muted small">{prof.tagline}. {prof.demographics}.</div>
        </div>
        <div className="insp-sec">
          <div className="dim tiny">Fictional property for gameplay. Not a real listing.</div>
        </div>
      </div>

      <div className="insp-actions">
        {!owned && p.forSale !== null && (
          <>
            {reCompanies.length > 0 && (
              <select className="select" value={buyer} onChange={(e) => setBuyer(e.target.value)}>
                <option value="player">Buy personally ({money(cash)} cash)</option>
                {reCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    Buy through {c.name} ({money(balance(state, `co:${c.id}`))})
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn primary block"
              disabled={buyerCash < total}
              data-testid="buy-property"
              onClick={() =>
                confirm(
                  `Buy ${p.name}?`,
                  `Price ${moneyFull(p.forSale!)} plus ${Math.round(CLOSING_COST_RATE * 100)}% closing costs (${moneyFull(total - p.forSale!)}). Total ${moneyFull(total)}. Ongoing ownership costs ≈ ${money(upkeepMonth)}/month.`,
                  'Buy property',
                  () => store.act((s) => buyProperty(s, p.id, buyer)),
                )
              }
            >
              Buy for {money(total)}
            </button>
            {buyerCash < total && <div className="dim small">You need {money(total - buyerCash)} more (price + closing costs).</div>}
          </>
        )}
        {!owned && p.forLease && p.use.kind === 'vacant' && suit.length > 0 && (
          <button className="btn outline block" data-testid="lease-property" onClick={() => store.openModal({ kind: 'found-company', propertyId: p.id })}>
            Lease & open a business · {money(leaseRent(p))}/mo
          </button>
        )}
        {!owned && p.forSale === null && !p.forLease && <div className="dim small">{p.owner.startsWith('rival:') ? `${ownerLabel(state, p)} is not selling.` : 'Not currently on the market. Listings change weekly.'}</div>}
        {owned && (
          <>
            {p.use.kind === 'vacant' && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn primary grow" onClick={() => store.act((s) => rentOut(s, p.id))} data-testid="rent-out">
                  Rent to tenants
                </button>
                {suit.length > 0 && (
                  <button className="btn outline grow" onClick={() => store.openModal({ kind: 'found-company', propertyId: p.id })} data-testid="start-company-here">
                    Start a company here
                  </button>
                )}
              </div>
            )}
            {p.use.kind === 'rented' && (
              <button className="btn block" onClick={() => store.act((s) => stopRenting(s, p.id))}>
                End tenant leases
              </button>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn grow"
                disabled={p.tier >= 5 || balance(state, p.owner) < reno}
                title={p.tier >= 5 ? 'Already top tier' : ''}
                onClick={() =>
                  confirm(`Renovate ${p.name}?`, `Upgrade from tier ${p.tier} to ${p.tier + 1} for ${moneyFull(reno)}. Raises market value and rent; renovation returns vary by district.`, 'Renovate', () =>
                    store.act((s) => renovateProperty(s, p.id)),
                  )
                }
              >
                {p.tier >= 5 ? 'Top tier' : `Renovate · ${money(reno)}`}
              </button>
              <button
                className="btn danger grow"
                disabled={!!occupant && occupant.status !== 'closed'}
                title={occupant ? `${occupant.name} operates here` : ''}
                data-testid="sell-property"
                onClick={() =>
                  confirm(`Sell ${p.name}?`, `Sell at market value ${moneyFull(sale.gross)} less 5% broker and closing costs. You receive ${moneyFull(sale.net)}.`, 'Sell property', () => store.act((s) => sellProperty(s, p.id)))
                }
              >
                Sell · {money(sale.net)}
              </button>
            </div>
            {reCompanies.length > 0 && (
              <select
                className="select"
                value={p.owner === 'player' ? 'player' : p.owner.slice(3)}
                onChange={(e) => store.act((s) => transferProperty(s, p.id, e.target.value))}
                title="Which entity holds this property"
              >
                <option value="player">Held personally</option>
                {reCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    Held by {c.name}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function DistrictPanel({ id, onClose }: { id: keyof typeof DISTRICTS; onClose: () => void }) {
  const state = useGame();
  const prof = DISTRICTS[id];
  const ds = state.economy.districts[id];
  const props = Object.values(state.properties).filter((p) => p.district === id);
  const rivals = Object.values(state.rivals).filter((r) => r.status === 'active' && r.districts.includes(id));
  const forSale = props.filter((p) => p.forSale !== null && !isOwnedByPlayer(state, p));
  const mine = props.filter((p) => isOwnedByPlayer(state, p));
  const bars: [string, number][] = [
    ['Foot traffic', prof.footTraffic / 1.6],
    ['Affluence', prof.affluence / 1.8],
    ['Tourism', prof.tourism / 1.7],
    ['Nightlife', prof.nightlife / 1.7],
    ['Tech scene', prof.techScene / 1.5],
  ];
  return (
    <div className="col" style={{ gap: 0, height: '100%' }} data-testid="district-panel">
      <div className="insp-h">
        <div className="row between">
          <span className="tag gold">District</span>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>
        <h2>{prof.name}</h2>
        <div className="muted small" style={{ marginTop: 4 }}>
          {prof.tagline}
        </div>
      </div>
      <div className="inspector-scroll">
        <div className="insp-sec">
          <p className="muted small" style={{ margin: 0 }}>
            {prof.description}
          </p>
          <div className="dim small" style={{ marginTop: 8 }}>
            Customers: {prof.demographics}.
          </div>
        </div>
        <div className="insp-sec">
          <h4>Market conditions</h4>
          <div className="kv">
            <span>Current demand</span>
            <span className={ds.demand >= 1 ? 'pos' : 'neg'}>{pct(ds.demand - 1, 1).replace(/^(?!-)/, '+')}</span>
            <span>Property price index</span>
            <span>{ds.priceIndex.toFixed(3)}</span>
            <span>Annual appreciation trend</span>
            <span>{pct(ds.trend * 365, 1)}</span>
            <span>Typical value</span>
            <span>${Math.round(prof.valuePsf * ds.priceIndex)}/sq ft</span>
            <span>Typical rent</span>
            <span>${prof.rentPsf}/sq ft/yr</span>
            <span>Operating cost level</span>
            <span>{pct(prof.costFactor)}</span>
          </div>
        </div>
        <div className="insp-sec">
          <h4>Profile</h4>
          <div className="col" style={{ gap: 7 }}>
            {bars.map(([l, v]) => (
              <div key={l} className="row" style={{ gap: 10 }}>
                <span className="small muted" style={{ width: 90 }}>
                  {l}
                </span>
                <div className="grow">
                  <Progress ratio={v} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="insp-sec">
          <h4>Best fits</h4>
          <div className="row wrap" style={{ gap: 6 }}>
            {(Object.entries(prof.affinity) as [SubtypeId, number][])
              .filter(([, v]) => v >= 1.15)
              .sort((a, b) => b[1] - a[1])
              .map(([k]) => (
                <span key={k} className="tag pos">
                  {SUBTYPES[k].name}
                </span>
              ))}
          </div>
        </div>
        <div className="insp-sec">
          <h4>Properties ({props.length})</h4>
          {props.map((p) => (
            <div key={p.id} className="row between small" style={{ padding: '4px 0', cursor: 'pointer' }} onClick={() => store.openProperty(p.id, true)}>
              <span className="ellipsis">{p.name}</span>
              <span className={isOwnedByPlayer(state, p) ? 'gold' : p.owner.startsWith('rival:') ? 'neg' : p.forSale !== null ? 'pos' : 'dim'}>
                {isOwnedByPlayer(state, p) ? 'Owned' : p.owner.startsWith('rival:') ? 'Rival' : p.forSale !== null ? money(p.forSale) : p.forLease ? 'Lease' : '—'}
              </span>
            </div>
          ))}
          <div className="dim tiny" style={{ marginTop: 8 }}>
            {mine.length} owned · {forSale.length} for sale
          </div>
        </div>
        <div className="insp-sec">
          <h4>Competitors present</h4>
          {rivals.length ? (
            rivals.map((r) => (
              <div key={r.id} className="row between small" style={{ padding: '3px 0' }}>
                <span>{r.name}</span>
                <span className="dim">{SUBTYPES[r.subtype].name}</span>
              </div>
            ))
          ) : (
            <div className="dim small">None.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export { Notice };
