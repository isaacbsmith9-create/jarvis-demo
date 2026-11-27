import { useState } from 'react';
import { store } from '../../app/store';
import { Difficulty, Notice } from '../../components/ui';
import { DISTRICTS } from '../../data/cities/miami';
import { SUBTYPES } from '../../data/companies/industries';
import { PROPERTY_DEFS } from '../../data/properties/miami';
import { SCENARIOS, type ScenarioDef } from '../../data/scenarios/scenarios';
import { moneyFull } from '../../utils/format';

function balanceSheet(s: ScenarioDef) {
  const debt = s.loans.reduce((a, l) => a + l.principal, 0);
  return { debt };
}

function ScenarioCard({ s, on, onClick }: { s: ScenarioDef; on: boolean; onClick: () => void }) {
  const { debt } = balanceSheet(s);
  return (
    <button className={`scn ${on ? 'on' : ''}`} onClick={onClick} data-testid={`scenario-${s.id}`}>
      <div className="row between">
        <span className={`tag ${s.track === 'underground' ? 'neg' : 'gold'}`}>{s.track === 'underground' ? 'Underground' : 'Legitimate'}</span>
        <Difficulty level={s.difficulty} underground={s.track === 'underground'} />
      </div>
      <h3>{s.title}</h3>
      <p>{s.summary}</p>
      <div className="row" style={{ marginTop: 'auto', gap: 14 }}>
        <span className="small">
          <span className="dim">Cash </span>
          {moneyFull(s.cash * 100)}
        </span>
        {debt > 0 && (
          <span className="small neg">
            <span className="dim">Debt </span>
            {moneyFull(debt * 100)}
          </span>
        )}
      </div>
    </button>
  );
}

export function NewCampaign() {
  const [selected, setSelected] = useState<string>('entrepreneur');
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const s = SCENARIOS.find((x) => x.id === selected)!;
  const legit = SCENARIOS.filter((x) => x.track === 'legitimate');
  const under = SCENARIOS.filter((x) => x.track === 'underground');
  const nameOk = name.trim().length >= 2 && name.trim().length <= 28;

  const start = () => {
    if (!nameOk) return;
    store.startNewGame({ playerName: name.trim(), scenarioId: selected, seed: seed.trim() || undefined });
  };

  const props = s.properties.map((p) => PROPERTY_DEFS.find((d) => d.id === p.id)!);

  return (
    <div className="newgame">
      <div className="newgame-h">
        <div>
          <div className="eyebrow">New campaign · Miami</div>
          <h1 className="display" style={{ fontSize: 34, marginTop: 4 }}>
            Choose your background
          </h1>
        </div>
        <button className="btn ghost" onClick={() => store.setScreen('menu')}>
          ← Main menu
        </button>
      </div>
      <div className="newgame-body">
        <div className="scenario-list">
          <section className="col" style={{ gap: 10 }}>
            <div className="eyebrow">Legitimate</div>
            <div className="scenario-grid">
              {legit.map((x) => (
                <ScenarioCard key={x.id} s={x} on={x.id === selected} onClick={() => setSelected(x.id)} />
              ))}
            </div>
          </section>
          <section className="col" style={{ gap: 10 }}>
            <div className="eyebrow">Underground</div>
            <div className="scenario-grid">
              {under.map((x) => (
                <ScenarioCard key={x.id} s={x} on={x.id === selected} onClick={() => setSelected(x.id)} />
              ))}
            </div>
          </section>
        </div>
        <aside className="scenario-detail" data-testid="scenario-detail">
          <div>
            <div className="row between">
              <span className={`tag ${s.track === 'underground' ? 'neg' : 'gold'}`}>{s.track}</span>
              <Difficulty level={s.difficulty} underground={s.track === 'underground'} />
            </div>
            <h2 style={{ marginTop: 12 }}>{s.title}</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              {s.story}
            </p>
          </div>
          <div className="panel">
            <div className="panel-h">
              <h3>Starting balance sheet</h3>
            </div>
            <div className="panel-b kv">
              <span>Cash</span>
              <span>{moneyFull(s.cash * 100)}</span>
              {props.map((p) => (
                <FragmentRow key={p.id} label={`Property: ${p.name}`} value={DISTRICTS[p.district].name} />
              ))}
              {s.companies.map((c) => (
                <FragmentRow key={c.name} label={`Company: ${c.name}`} value={`${SUBTYPES[c.subtype].name}, ${c.employees.length} staff`} />
              ))}
              {s.organization && <FragmentRow label={`Organization: ${s.organization.name}`} value={`${moneyFull(s.organization.treasury * 100)} treasury`} />}
              {s.loans.map((l) => (
                <FragmentRow key={l.lender} label={`Liability: ${l.lender}`} value={<span className="neg">−{moneyFull(l.principal * 100)}</span>} />
              ))}
              {s.loans.length > 0 && <FragmentRow label="Monthly debt payments" value={<span className="neg">{moneyFull(s.loans.reduce((a, l) => a + l.monthlyPayment, 0) * 100)}</span>} />}
            </div>
          </div>
          <div className="grid g2" style={{ gap: 14 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Advantages
              </div>
              <ul className="plist">
                {s.advantages.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Disadvantages
              </div>
              <ul className="plist minus">
                {s.disadvantages.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Starting relationships
            </div>
            <div className="col" style={{ gap: 6 }}>
              {s.contacts.map((c) => (
                <div key={c.name} className="row between small">
                  <span>
                    {c.name} <span className="dim">· {c.title}, {c.affiliation}</span>
                  </span>
                  <span className={c.relationship >= 0 ? 'pos' : 'neg'}>{c.relationship > 0 ? `+${c.relationship}` : c.relationship}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel" style={{ borderColor: 'var(--gold-dim)' }}>
            <div className="panel-b">
              <div className="eyebrow gold">Objective — {s.objective.title}</div>
              <div style={{ marginTop: 6 }}>
                {s.objective.description}
                {s.objective.days ? <span className="dim"> Within {s.objective.days} days.</span> : null}
              </div>
            </div>
          </div>
          {s.futureNotes?.map((n) => (
            <Notice key={n} kind="future">
              <strong>Future gameplay.</strong> {n}
            </Notice>
          ))}
        </aside>
      </div>
      <div className="newgame-f">
        <div className="field" style={{ width: 260 }}>
          <label>Your name</label>
          <input className="input" value={name} maxLength={28} placeholder="e.g. Alex Rivera" onChange={(e) => setName(e.target.value)} data-testid="player-name" onKeyDown={(e) => e.key === 'Enter' && start()} />
        </div>
        <div className="field" style={{ width: 180 }}>
          <label>World seed (optional)</label>
          <input className="input" value={seed} maxLength={24} placeholder="random" onChange={(e) => setSeed(e.target.value)} />
        </div>
        <button className="btn primary lg" disabled={!nameOk} onClick={start} style={{ alignSelf: 'flex-end' }} data-testid="start-campaign">
          Begin as {s.title}
        </button>
      </div>
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span>{label}</span>
      <span>{value}</span>
    </>
  );
}
