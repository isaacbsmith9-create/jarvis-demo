import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { Avatar, MoneyInput, Notice, Panel, Progress, Stat } from '../../components/ui';
import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import { balance, orgAccount, PLAYER } from '../../simulation/finance/ledger';
import {
  atWar,
  busyMembers,
  DISTRICT_WEALTH,
  FOUNDING_COST,
  foundOrganization,
  launchOperation,
  OP_ORDER,
  OPS,
  playerOrganization,
  promoteMember,
  proposeAlliance,
  proposeTruce,
  quoteOperation,
  relationOf,
  resolveSituation,
  sendGift,
  setPosture,
  shareOf,
  totalTurf,
  transferFromOrg,
  transferToOrg,
  unclaimed,
  weeklyOrgIncome,
  weeklyOrgUpkeep,
  type OpPlan,
} from '../../simulation/organizations/organizations';
import type { DistrictId, GameState, OpKind, Organization } from '../../types/core';
import { formatShortDate } from '../../utils/date';
import { dollars, money, pct } from '../../utils/format';

const ORG_COLORS: Record<string, string> = { 'player-org': '#d8b260', ceiba: '#c97b63', tidebreakers: '#7ea6c9', northside: '#a08ac2' };
const orgColor = (id: string) => ORG_COLORS[id] ?? '#8fb07a';

/** Network: relationships plus the underground — turf, operations, decisions, rivals. */
export function OrganizationView() {
  const st = useGame();
  const org = playerOrganization(st);
  return (
    <div className="page" data-testid="org-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Relationships & the underground · fictional</div>
          <h1>Network</h1>
        </div>
      </div>
      {org ? <PlayerOrg o={org} /> : <FoundOrg />}
      <TerritoryPanel />
      <div className="grid g2">
        <RivalOrgs />
        <Contacts />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FoundOrg() {
  const st = useGame();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState<DistrictId>('littlehavana');
  const cash = balance(st, PLAYER);
  return (
    <Panel title="Start an organization">
      <div className="col" style={{ gap: 12 }}>
        <div className="muted">
          Your background is legitimate, but nothing stops you building something in the shadows. A new organization starts with two associates and a small foothold. Turf brings weekly income; operations, heat and rivals come with it. Heat from the underground can damage your public reputation.
        </div>
        <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label>Name</label>
            <input id="org-name" className="input" value={name} maxLength={32} placeholder="e.g. The Coral Circle" onChange={(e) => setName(e.target.value)} data-testid="org-name" />
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Home district</label>
            <select id="org-district" className="select" value={district} onChange={(e) => setDistrict(e.target.value as DistrictId)}>
              {DISTRICT_ORDER.map((d) => (
                <option key={d} value={d}>
                  {DISTRICTS[d].name} ({Math.round(unclaimed(st, d))}% unclaimed)
                </option>
              ))}
            </select>
          </div>
          <button className="btn primary" disabled={name.trim().length < 3 || cash < FOUNDING_COST} onClick={() => store.act((s) => foundOrganization(s, name, district))} data-testid="found-org">
            Start · {money(FOUNDING_COST)}
          </button>
        </div>
        {cash < FOUNDING_COST && <span className="dim small">You need {money(FOUNDING_COST)} in personal cash.</span>}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function PlayerOrg({ o }: { o: Organization }) {
  const st = useGame();
  const treasury = balance(st, orgAccount(o.id));
  const net = weeklyOrgIncome(st, o) - weeklyOrgUpkeep(o);
  return (
    <>
      <section className="panel">
        <div className="kpis">
          <Stat label={o.name} value={money(treasury)} sub="Treasury" />
          <Stat label="Turf" value={`${Math.round(totalTurf(st, o.id))} pts`} sub={`${o.territory.length} district${o.territory.length === 1 ? '' : 's'} with 10%+`} />
          <Stat label="Influence" value={Math.round(o.influence)} sub={<Progress ratio={o.influence / 100} />} />
          <Stat label="Heat" value={<span className={o.heat > 65 ? 'neg' : o.heat > 40 ? 'warn' : ''}>{Math.round(o.heat)}</span>} sub={<Progress ratio={o.heat / 100} tone={o.heat > 65 ? 'neg' : undefined} />} />
          <Stat label="Case against you" value={<span className={o.investigation > 70 ? 'neg' : ''}>{Math.round(o.investigation)}%</span>} sub={<Progress ratio={o.investigation / 100} tone="neg" />} />
          <Stat label="Weekly, passive (est.)" value={<span className={net >= 0 ? 'pos' : 'neg'}>{money(net, { sign: true })}</span>} sub={`${money(weeklyOrgIncome(st, o))} turf · ${money(weeklyOrgUpkeep(o))} cuts`} />
        </div>
      </section>
      {o.investigation > 70 && <Notice kind="neg">The case is close to complete. At 100% there will be a raid: 30% of the treasury seized, members arrested, turf lost. Retain lawyers or keep a low profile.</Notice>}
      {o.situations.length > 0 && <Situations o={o} />}
      <div className="grid g-main-side">
        <OperationsPanel o={o} />
        <div className="col" style={{ gap: 18 }}>
          <ActiveOps o={o} />
          <Posture o={o} />
        </div>
      </div>
      <Members o={o} />
    </>
  );
}

function Situations({ o }: { o: Organization }) {
  return (
    <Panel title={`Decisions (${o.situations.length})`} tight>
      <div data-testid="situations">
        {o.situations.map((s) => (
          <div key={s.id} className="list-item" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div className="col grow" style={{ gap: 4, minWidth: 240 }}>
              <strong>{s.title}</strong>
              <span className="muted small">{s.body}</span>
              <span className="dim tiny">Decide by {formatShortDate(s.expiresDay)} or the default applies ({s.options.find((x) => x.id === s.defaultOption)?.label}).</span>
            </div>
            <div className="col" style={{ gap: 6, minWidth: 220 }}>
              {s.options.map((opt) => (
                <button key={opt.id} className="btn sm outline" style={{ justifyContent: 'flex-start', height: 'auto', padding: '6px 10px', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => store.act((x) => resolveSituation(x, s.id, opt.id))} data-testid={`sit-${opt.id}`}>
                  <span>
                    <strong>{opt.label}</strong>
                    <br />
                    <span className="dim tiny">{opt.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function OperationsPanel({ o }: { o: Organization }) {
  const st = useGame();
  const [kind, setKind] = useState<OpKind>('expand');
  const [crew, setCrew] = useState<string[]>([]);
  const [district, setDistrict] = useState<DistrictId | null>(o.territory[0] ?? 'littlehavana');
  const [targetOrg, setTargetOrg] = useState<string | null>(null);
  const [targetRival, setTargetRival] = useState<string | null>(null);
  const def = OPS[kind];
  const busy = busyMembers(o);
  const free = o.members.filter((m) => m.rank !== 'boss');
  const plan: OpPlan = { kind, crew, district: def.target && def.target !== 'rival-company' ? district : null, targetOrgId: kind === 'turf' ? targetOrg : null, targetRivalId: kind === 'sabotage' ? targetRival : null };
  const q = quoteOperation(st, o, plan);
  const npcs = Object.values(st.organizations).filter((x) => x.controlledBy === 'npc');
  const districts = def.target === 'own-district' ? DISTRICT_ORDER.filter((d) => shareOf(st, o.id, d) > 0) : def.target === 'org-district' && targetOrg ? DISTRICT_ORDER.filter((d) => shareOf(st, targetOrg, d) > 0) : DISTRICT_ORDER;
  const toggle = (id: string) => setCrew((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= def.crewMax ? [...c.slice(1), id] : [...c, id]));
  const launch = () => {
    const r = store.act((s) => launchOperation(s, plan));
    if (r.ok) setCrew([]);
  };
  return (
    <Panel title="Plan an operation">
      <div className="col" style={{ gap: 14 }} data-testid="op-planner">
        <div className="op-kinds">
          {OP_ORDER.map((k) => (
            <button key={k} className={`choice ${k === kind ? 'on' : ''}`} onClick={() => (setKind(k), setCrew([]))} data-testid={`op-${k}`}>
              <h4>{OPS[k].name}</h4>
              <p>{OPS[k].description}</p>
            </button>
          ))}
        </div>
        {kind === 'turf' && (
          <div className="field">
            <label>Rival organization</label>
            <select className="select" value={targetOrg ?? ''} onChange={(e) => setTargetOrg(e.target.value || null)} data-testid="op-target-org">
              <option value="">Choose…</option>
              {npcs.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} (influence {Math.round(n.influence)}){o.pacts[n.id] ? ` · ${o.pacts[n.id]}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {kind === 'sabotage' && (
          <div className="field">
            <label>Competitor</label>
            <select className="select" value={targetRival ?? ''} onChange={(e) => setTargetRival(e.target.value || null)} data-testid="op-target-rival">
              <option value="">Choose…</option>
              {Object.values(st.rivals)
                .filter((r) => r.status === 'active')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        {def.target && def.target !== 'rival-company' && (
          <div className="field">
            <label>District</label>
            <select className="select" value={district ?? ''} onChange={(e) => setDistrict((e.target.value || null) as DistrictId | null)} data-testid="op-district">
              <option value="">Choose…</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {DISTRICTS[d].name} · you hold {Math.round(shareOf(st, o.id, d))}% · {Math.round(unclaimed(st, d))}% unclaimed
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>
            Crew ({crew.length}/{def.crewMax}, at least {def.crewMin})
          </label>
          <div className="row wrap" style={{ gap: 6 }}>
            {free.map((m) => (
              <button key={m.id} className={`btn sm ${crew.includes(m.id) ? 'outline' : 'ghost'}`} disabled={busy.has(m.id)} onClick={() => toggle(m.id)} title={busy.has(m.id) ? 'On another operation' : ''} data-testid="crew-pick">
                {m.name} · {m.skill}
                {busy.has(m.id) ? ' · busy' : ''}
              </button>
            ))}
            {!free.length && <span className="dim small">No members to send. Recruit first.</span>}
          </div>
        </div>
        <div className="op-quote">
          <div className="kv">
            <span>Cost from treasury</span>
            <span>{money(q.cost)}</span>
            <span>Takes</span>
            <span>{q.days} days</span>
            <span>Chance of full success</span>
            <span className={q.chance >= 0.6 ? 'pos' : q.chance < 0.35 ? 'neg' : 'warn'}>{pct(q.chance)}</span>
          </div>
          {q.preview && <div className="small muted" style={{ marginTop: 8 }}>{q.preview}</div>}
          {q.errors.length > 0 && <div className="small warn" style={{ marginTop: 6 }}>{q.errors[0]}</div>}
        </div>
        <button className="btn primary" disabled={q.errors.length > 0} onClick={launch} data-testid="launch-op">
          Launch {def.name.toLowerCase()}
        </button>
        <div className="dim tiny">Odds improve with crew skill, more crew, influence and allies nearby; heat lowers them. A failed operation can raise heat, cost turf or lose a member.</div>
      </div>
    </Panel>
  );
}

function ActiveOps({ o }: { o: Organization }) {
  const st = useGame();
  return (
    <Panel title="Operations" tight>
      {o.operations.length ? (
        o.operations.map((op) => {
          const names = op.crew.map((id) => o.members.find((m) => m.id === id)?.name ?? '—').join(', ');
          const left = op.endDay - st.day;
          return (
            <div key={op.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div className="row between">
                <strong>{OPS[op.kind].name}</strong>
                <span className="dim small">{left <= 0 ? 'Finishing' : `${left} day${left === 1 ? '' : 's'} left`}</span>
              </div>
              <Progress ratio={(st.day - op.startDay) / Math.max(1, op.endDay - op.startDay)} />
              <span className="dim tiny">
                {op.district ? `${DISTRICTS[op.district].name} · ` : ''}
                {op.targetOrgId ? `vs ${st.organizations[op.targetOrgId]?.name} · ` : ''}
                {op.targetRivalId ? `${st.rivals[op.targetRivalId]?.name} · ` : ''}
                {names} · {pct(op.chance)} odds
              </span>
            </div>
          );
        })
      ) : (
        <div className="empty small">Nothing under way.</div>
      )}
      {st.opReports.length > 0 && (
        <>
          <div className="list-item eyebrow" style={{ borderBottom: 0 }}>
            Recent results
          </div>
          {st.opReports.slice(0, 5).map((r) => (
            <div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <span className={`tag ${r.outcome === 'success' ? 'pos' : r.outcome === 'failure' ? 'neg' : 'warn'}`}>{r.outcome}</span>
              <span className="small">
                <strong>{OPS[r.kind].name}</strong> <span className="muted">{r.summary}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </Panel>
  );
}

function Posture({ o }: { o: Organization }) {
  const st = useGame();
  const [out, setOut] = useState(0);
  const [inn, setIn] = useState(0);
  const treasury = balance(st, orgAccount(o.id));
  return (
    <Panel title="Posture & money">
      <div className="col" style={{ gap: 12 }}>
        <div className="seg">
          <button className={o.posture === 'active' ? 'on' : ''} onClick={() => store.act((s) => setPosture(s, o.id, 'active'))}>
            Active
          </button>
          <button className={o.posture === 'low' ? 'on' : ''} onClick={() => store.act((s) => setPosture(s, o.id, 'low'))} data-testid="posture-low">
            Low profile
          </button>
        </div>
        <div className="dim small">Low profile cuts turf income by about two thirds and lets heat cool each week.</div>
        <div className="divider" style={{ margin: 0 }} />
        <div className="field">
          <label>Withdraw to personal cash (raises heat)</label>
          <div className="row">
            <div className="grow">
              <MoneyInput value={out} onChange={setOut} max={Math.max(0, treasury)} />
            </div>
            <button className="btn sm outline" disabled={out <= 0} onClick={() => store.act((s) => transferFromOrg(s, o.id, out)).ok && setOut(0)}>
              Withdraw
            </button>
          </div>
          <span className="dim tiny">The quieter route is the “Move funds through a front” operation.</span>
        </div>
        <div className="field">
          <label>Fund the treasury from personal cash</label>
          <div className="row">
            <div className="grow">
              <MoneyInput value={inn} onChange={setIn} max={Math.max(0, balance(st, PLAYER))} />
            </div>
            <button className="btn sm outline" disabled={inn <= 0} onClick={() => store.act((s) => transferToOrg(s, inn)).ok && setIn(0)}>
              Fund
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Members({ o }: { o: Organization }) {
  const busy = busyMembers(o);
  return (
    <Panel title={`Members (${o.members.length})`} tight>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Rank</th>
            <th className="r">Skill</th>
            <th className="r">Loyalty</th>
            <th className="r">Weekly cut</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {o.members.map((m) => (
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
              <td className="r">{m.skill}</td>
              <td className={`r ${m.loyalty < 30 ? 'neg' : ''}`}>{Math.round(m.loyalty)}</td>
              <td className="r">{m.weeklyCut ? money(m.weeklyCut) : '—'}</td>
              <td className="small muted">{m.rank === 'boss' ? 'You' : busy.has(m.id) ? 'On an operation' : 'Available'}</td>
              <td className="r">
                {(m.rank === 'associate' || m.rank === 'lieutenant') && (
                  <button className="btn sm ghost" onClick={() => store.act((s) => promoteMember(s, m.id))}>
                    Promote
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="list-item dim tiny">Promotions raise a member's cut and loyalty. Lieutenants need skill 50, the underboss 60. Members whose loyalty falls under 20 may walk away.</div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function TerritoryPanel() {
  const st = useGame();
  const holders = (d: DistrictId) => Object.entries(st.territory[d] ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <Panel title="Turf by district" tight>
      <div data-testid="territory">
        {DISTRICT_ORDER.map((d) => (
          <div key={d} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <div className="row between">
              <span>{DISTRICTS[d].name}</span>
              <span className="dim tiny">Passive take up to {money(dollars(DISTRICT_WEALTH[d] * 0.6))}/week at full control</span>
            </div>
            <div className="turf-bar">
              {holders(d).map(([id, v]) => (
                <i key={id} style={{ width: `${v}%`, background: orgColor(id) }} title={`${st.organizations[id]?.name ?? id}: ${Math.round(v)}%`} />
              ))}
            </div>
            <div className="row wrap" style={{ gap: 10 }}>
              {holders(d).map(([id, v]) => (
                <span key={id} className="tiny row" style={{ gap: 5 }}>
                  <span className="dot" style={{ background: orgColor(id) }} />
                  {st.organizations[id]?.name ?? id} {Math.round(v)}%
                </span>
              ))}
              <span className="tiny dim">Unclaimed {Math.round(unclaimed(st, d))}%</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function relationLabel(o: Organization | null, id: string, st: GameState): { text: string; cls: string } {
  if (!o) return { text: 'No dealings', cls: 'dim' };
  if (o.pacts[id] === 'alliance') return { text: 'Allied', cls: 'pos' };
  if (o.pacts[id] === 'truce') return { text: 'Truce', cls: 'blue' };
  if (atWar(o, id)) return { text: 'Open conflict', cls: 'neg' };
  const r = relationOf(o, id);
  void st;
  return r > 20 ? { text: 'Friendly', cls: 'pos' } : r < -20 ? { text: 'Hostile', cls: 'warn' } : { text: 'Neutral', cls: '' };
}

function RivalOrgs() {
  const st = useGame();
  const o = playerOrganization(st);
  const npcs = Object.values(st.organizations).filter((x) => x.controlledBy === 'npc');
  return (
    <Panel title="Rival organizations" tight>
      {npcs.map((n) => {
        const rel = o ? relationOf(o, n.id) : 0;
        const label = relationLabel(o, n.id, st);
        return (
          <div key={n.id} className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }} data-testid={`rival-org-${n.id}`}>
            <div className="row between" style={{ width: '100%' }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="dot" style={{ background: orgColor(n.id) }} />
                <strong>{n.name}</strong>
              </div>
              <span className={`tag ${label.cls}`}>{label.text}</span>
            </div>
            <span className="dim small">
              Led by {n.leader} · influence {Math.round(n.influence)} · {Math.round(totalTurf(st, n.id))} turf pts across {n.territory.map((d) => DISTRICTS[d].name).join(', ') || 'no district'}
            </span>
            <span className="muted small">{n.description}</span>
            {o && (
              <>
                <div className="row" style={{ gap: 8, width: '100%' }}>
                  <span className="tiny dim" style={{ width: 60 }}>
                    Relations
                  </span>
                  <div className="grow rel-bar">
                    <i style={{ left: rel >= 0 ? '50%' : `${50 + rel / 2}%`, width: `${Math.abs(rel) / 2}%`, background: rel >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
                  </div>
                  <span className="tiny num" style={{ width: 30, textAlign: 'right' }}>
                    {Math.round(rel)}
                  </span>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <button className="btn sm ghost" onClick={() => store.act((s) => sendGift(s, n.id, dollars(5000)))}>
                    Gift $5K
                  </button>
                  <button className="btn sm ghost" onClick={() => store.act((s) => sendGift(s, n.id, dollars(20000)))}>
                    Gift $20K
                  </button>
                  {!o.pacts[n.id] && (
                    <button className="btn sm outline" onClick={() => store.act((s) => proposeTruce(s, n.id))} data-testid={`truce-${n.id}`}>
                      Propose truce
                    </button>
                  )}
                  {o.pacts[n.id] === 'truce' && (
                    <button className="btn sm outline" onClick={() => store.act((s) => proposeAlliance(s, n.id))}>
                      Propose alliance · $20K
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
      <div className="list-item dim tiny">Rivals expand into open turf and push into yours, more often when relations are bad. Below −50 it's open conflict, and your legitimate businesses in contested districts can be hit. Truces stop them moving on you; allies improve your odds where they hold turf.</div>
    </Panel>
  );
}

function Contacts() {
  const st = useGame();
  return (
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
      <div className="list-item dim tiny">Relationship events with contacts are planned for a future release.</div>
    </Panel>
  );
}
