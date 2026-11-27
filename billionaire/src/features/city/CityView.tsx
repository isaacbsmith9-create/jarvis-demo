import { useRef, useState } from 'react';
import { useLayout } from '../../app/layout';
import { store, useStore } from '../../app/store';
import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import { PROPERTY_TYPE_LABEL } from '../../data/properties/miami';
import { PhaserCity, type CityHandle } from '../../game/PhaserCity';
import { isOwnedByPlayer } from '../../simulation/properties/properties';
import type { DistrictId } from '../../types/core';
import { money } from '../../utils/format';
import { DistrictPanel, PropertyPanel } from '../properties/PropertyPanel';

export function CityView({ active }: { active: boolean }) {
  const s = useStore();
  const handle = useRef<CityHandle | null>(null);
  const [hover, setHover] = useState<{ propertyId: string | null; district: DistrictId | null; x: number; y: number } | null>(null);
  const st = s.state!;
  const sel = s.selection;
  const hp = hover?.propertyId ? st.properties[hover.propertyId] : null;
  const phone = useLayout() === 'phone';
  const [hudOpen, setHudOpen] = useState(false);
  const showHud = !phone || hudOpen;

  return (
    <div className="city-wrap" style={{ visibility: active ? 'visible' : 'hidden', pointerEvents: active ? 'auto' : 'none' }} data-testid="city-view">
      <PhaserCity active={active} onHover={setHover} handleRef={handle} />
      {active && (
        <>
          <div className="city-hud">
            <div className="city-title">
              <div className="eyebrow">Florida · Alpha 0.3</div>
              <h2>Miami</h2>
              {phone && (
                <button className="btn sm ghost" style={{ marginTop: 6, marginLeft: -8 }} onClick={() => setHudOpen(!hudOpen)} data-testid="city-hud-toggle">
                  {hudOpen ? 'Hide districts & key' : 'Districts & key'}
                </button>
              )}
            </div>
            {showHud && (
            <div className="filter-box">
              <button className={s.cityFilter === null ? 'on' : ''} onClick={() => s.setCityFilter(null)}>
                All districts
              </button>
              {DISTRICT_ORDER.map((d) => (
                <button
                  key={d}
                  className={s.cityFilter === d ? 'on' : ''}
                  onClick={() => {
                    s.setCityFilter(s.cityFilter === d ? null : d);
                    s.select({ district: d, propertyId: null });
                  }}
                >
                  <span className="dot" style={{ background: DISTRICTS[d].accent }} />
                  {DISTRICTS[d].name}
                </button>
              ))}
            </div>
            )}
            {showHud && (
            <div className="legend-box">
              <span className="row">
                <i className="sw" style={{ background: '#d8b260' }} /> Your property
              </span>
              <span className="row">
                <i className="sw" style={{ background: '#4fc3b0' }} /> For sale
              </span>
              <span className="row">
                <i className="sw" style={{ background: '#7ea6c9' }} /> For lease
              </span>
              <span className="row">
                <i className="sw" style={{ background: '#c65a63' }} /> Competitor-owned
              </span>
              <span className="dim tiny" style={{ marginTop: 4 }}>
                {phone ? 'Drag to pan · pinch to zoom · tap a building' : 'Drag to pan · scroll to zoom · WASD'}
              </span>
            </div>
            )}
          </div>
          <div className="zoom-ctl">
            <button onClick={() => handle.current?.zoom(1.2)} aria-label="Zoom in">
              +
            </button>
            <button onClick={() => handle.current?.zoom(1 / 1.2)} aria-label="Zoom out">
              −
            </button>
          </div>
          {!phone && hover && !sel.propertyId && (hp || hover.district) && (
            <div className="hover-tip" style={{ left: hover.x + 16, top: hover.y + 12 }}>
              {hp ? (
                <>
                  <div>{hp.name}</div>
                  <div className="dim tiny">
                    {PROPERTY_TYPE_LABEL[hp.type]} · {DISTRICTS[hp.district].name} ·{' '}
                    {isOwnedByPlayer(st, hp) ? <span className="gold">Owned</span> : hp.forSale !== null ? <span className="pos">{money(hp.forSale)}</span> : hp.forLease ? 'For lease' : hp.owner.startsWith('rival:') ? 'Competitor' : 'Off market'}
                  </div>
                </>
              ) : (
                <div className="dim">{DISTRICTS[hover.district!].name}</div>
              )}
            </div>
          )}
          {sel.propertyId && st.properties[sel.propertyId] ? (
            <aside className="inspector" key={sel.propertyId}>
              <PropertyPanel id={sel.propertyId} onClose={() => store.select({ propertyId: null })} />
            </aside>
          ) : sel.district ? (
            <aside className="inspector" key={sel.district}>
              <DistrictPanel id={sel.district} onClose={() => store.select({ district: null })} />
            </aside>
          ) : null}
        </>
      )}
    </div>
  );
}
