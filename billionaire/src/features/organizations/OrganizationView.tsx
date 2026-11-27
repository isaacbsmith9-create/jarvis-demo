import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { Avatar, MoneyInput, Notice, Panel, Progress, Stat } from '../../components/ui';
import { DISTRICTS } from '../../data/cities/miami';
import { balance, orgAccount } from '../../simulation/finance/ledger';
import { playerOrganization, setPosture, transferFromOrg, weeklyOrgIncome, weeklyOrgUpkeep } from '../../simulation/organizations/organizations';
import { money } from '../../utils/format';

/** Network: relationships plus (for underground backgrounds) the player's organization. */
export function OrganizationView() {
  const st = useGame();
  const org = playerOrganization(st);
  const npcs = Object.values(st.organizations).filter((o) => o.controlledBy === 'npc');
  const [amount, setAmount] = useState(0);
  return (
    <div className="page" data-testid="org-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Relationships & the underground</div>
          <h1>Network</h1>
        </div>
      </div>

      {org ? (
        <>
          <section className="panel">
            <div className="kpis">
              <Stat label={org.name} value={money(balance(st, orgAccount(org.id)))} sub="Treasury" />
              <Stat label="Influence" value={Math.round(org.influence)} sub={<Progress ratio={org.influence / 100} />} />
              <Stat label="Heat" value={<span className={org.heat > 65 ? 'neg' : org.heat > 40 ? 'warn' : ''}>{Math.round(org.heat)}</span>} sub={<Progress ratio={org.heat / 100} tone={org.heat > 65 ? 'neg' : undefined} />} />
              <Stat label="Weekly (est.)" value={money(weeklyOrgIncome(org) - weeklyOrgUpkeep(org))} sub={`${money(weeklyOrgIncome(org))} in · ${money(weeklyOrgUpkeep(org))} member cuts`} />
            </div>
          </section>
          <div className="grid g-main-side">
            <Panel title="Members" tight>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Rank</th>
                    <th className="r">Loyalty</th>
                    <th className="r">Weekly cut</th>
                  </tr>
                </thead>
                <tbody>
                  {org.members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <Avatar name={m.name} size={26} />
                          {m.name}
                        </div>
                      </td>
                      <td className="muted" style={{ textTransform: 'capitalize' }}>
                        {m.rank}
                      </td>
                      <td className={`r ${m.loyalty < 30 ? 'neg' : ''}`}>{Math.round(m.loyalty)}</td>
                      <td className="r">{m.weeklyCut ? money(m.weeklyCut) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <div className="col" style={{ gap: 18 }}>
              <Panel title="Posture">
                <div className="col" style={{ gap: 12 }}>
                  <div className="seg">
                    <button className={org.posture === 'active' ? 'on' : ''} onClick={() => store.act((s) => setPosture(s, org.id, 'active'))}>
                      Active
                    </button>
                    <button className={org.posture === 'low' ? 'on' : ''} onClick={() => store.act((s) => setPosture(s, org.id, 'low'))} data-testid="posture-low">
                      Low profile
                    </button>
                  </div>
                  <div className="dim small">Active operations earn more but raise heat every week. A low profile cuts income by about two thirds and lets heat cool. Above 70 heat, investigations can seize funds.</div>
                  <div className="kv">
                    <span>Territory</span>
                    <span>{org.territory.map((d) => DISTRICTS[d].name).join(', ')}</span>
                  </div>
                </div>
              </Panel>
              <Panel title="Move money to personal cash">
                <div className="col" style={{ gap: 10 }}>
                  <MoneyInput value={amount} onChange={setAmount} max={Math.max(0, balance(st, orgAccount(org.id)))} />
                  <button className="btn outline" disabled={amount <= 0} onClick={() => store.act((s) => transferFromOrg(s, org.id, amount)).ok && setAmount(0)}>
                    Transfer
                  </button>
                  <div className="dim tiny">Large transfers draw attention and raise heat.</div>
                </div>
              </Panel>
            </div>
          </div>
          <Notice kind="future">
            <strong>Future gameplay.</strong> Missions, territory expansion, alliances, internal disputes and investigations as story arcs are planned for later releases. In Alpha 0.1 the organization is an abstract, fictional system: it earns weekly income from its influence, pays its members, accumulates heat and faces consequences.
          </Notice>
        </>
      ) : (
        <Notice kind="future">
          <strong>No organization.</strong> Your background is legitimate. Founding or joining an underground organization is planned gameplay for a future release; underground backgrounds start with one.
        </Notice>
      )}

      <div className="grid g2">
        <Panel title="Contacts" tight>
          {st.contacts.map((c) => (
            <div key={c.id} className="list-item">
              <Avatar name={c.name} />
              <div className="grow">
                <div>
                  {c.name} {c.underworld && <span className="tag neg" style={{ marginLeft: 6 }}>Underworld</span>}
                </div>
                <div className="dim small">
                  {c.title}, {c.affiliation}
                </div>
                <div className="muted small" style={{ marginTop: 3 }}>
                  {c.note}
                </div>
              </div>
              <div className="right" style={{ width: 70 }}>
                <div className={c.relationship >= 0 ? 'pos' : 'neg'}>{c.relationship > 0 ? `+${c.relationship}` : c.relationship}</div>
                <div className="dim tiny">relationship</div>
              </div>
            </div>
          ))}
          <div className="list-item dim tiny">Relationship events and character interactions are planned for a future release.</div>
        </Panel>
        <Panel title="Known organizations" tight>
          {npcs.map((o) => (
            <div key={o.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div>{o.name}</div>
                <div className="dim small">
                  Led by {o.leader} · {o.territory.map((d) => DISTRICTS[d].name).join(', ')}
                </div>
                <div className="muted small" style={{ marginTop: 3 }}>
                  {o.description}
                </div>
              </div>
              <div style={{ width: 110 }} className="col">
                <span className="tiny dim">Influence {Math.round(o.influence)}</span>
                <Progress ratio={o.influence / 100} />
                <span className="tiny dim">Heat {Math.round(o.heat)}</span>
                <Progress ratio={o.heat / 100} tone="neg" />
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
