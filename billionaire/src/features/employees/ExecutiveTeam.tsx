import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { Avatar, Panel, SkillBar } from '../../components/ui';
import { TRAITS } from '../../data/employees/names';
import { EXEC_ORDER, EXEC_ROLES, fireExecutive, getExec, hireExecutive, raiseExecutive, setCashSweep } from '../../simulation/executives/executives';
import type { ExecRole } from '../../types/core';
import { money } from '../../utils/format';

/** Empire-level officers: three seats, a monthly candidate pool, and the CFO's cash sweep. */
export function ExecutiveTeam() {
  const st = useGame();
  const [open, setOpen] = useState<ExecRole | null>(null);
  const payroll = st.executives.reduce((s, e) => s + e.salary, 0);
  return (
    <Panel title="Executive team" actions={<span className="dim small">{payroll ? `${money(payroll)}/yr from your personal cash` : 'Officers who run the whole empire'}</span>} tight>
      <div className="exec-grid" data-testid="exec-team">
        {EXEC_ORDER.map((role) => {
          const e = getExec(st, role);
          const def = EXEC_ROLES[role];
          const cands = st.execCandidates.filter((x) => x.role === role);
          return (
            <div key={role} className="exec-seat" data-testid={`exec-${role}`}>
              <div className="row between">
                <span className="eyebrow gold">{def.short}</span>
                <span className="dim tiny">{def.title}</span>
              </div>
              {e ? (
                <>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={e.name} size={34} />
                    <div className="col" style={{ gap: 1 }}>
                      <strong>{e.name}</strong>
                      <span className="dim tiny">
                        {money(e.salary)}/yr · age {e.age}
                        {e.traits.length ? ` · ${e.traits.map((t) => TRAITS[t].label).join(', ')}` : ''}
                      </span>
                    </div>
                  </div>
                  <SkillBar label="Skill" value={e.skill} />
                  <SkillBar label="Loyalty" value={e.loyalty} />
                  <div className="small pos">{def.effect(e.skill)}</div>
                  {role === 'cfo' && (
                    <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={st.settings.cashSweep} onChange={(ev) => store.act((s) => setCashSweep(s, ev.target.checked))} />
                      <span>Weekly cash sweep to you</span>
                    </label>
                  )}
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm grow" onClick={() => store.act((s) => raiseExecutive(s, e.id))}>
                      Raise 10%
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() =>
                        store.openModal({
                          kind: 'confirm',
                          title: `Let ${e.name} go?`,
                          body: `One month's salary (${money(Math.round(e.salary / 12))}) as severance. The ${def.short} seat will be empty until you hire again.`,
                          confirmLabel: 'Let go',
                          onConfirm: () => store.act((s) => fireExecutive(s, e.id)),
                        })
                      }
                    >
                      Let go
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="muted small">{def.description}</div>
                  {open === role ? (
                    <div className="col" style={{ gap: 8 }}>
                      {cands.length ? (
                        cands.map((x) => (
                          <div key={x.id} className="exec-cand">
                            <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                              <span>
                                {x.name} <span className="dim tiny">age {x.age}</span>
                              </span>
                              <span className="dim tiny">
                                Skill {x.skill} · {money(x.salary)}/yr{x.traits.length ? ` · ${x.traits.map((t) => TRAITS[t].label).join(', ')}` : ''}
                              </span>
                              <span className="tiny pos">{def.effect(x.skill)}</span>
                            </div>
                            <button className="btn sm primary" onClick={() => store.act((s) => hireExecutive(s, x.id))} data-testid="hire-exec">
                              Hire
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="dim small">No candidates this month. New ones arrive on the 1st.</span>
                      )}
                    </div>
                  ) : (
                    <button className="btn sm outline" onClick={() => setOpen(role)} data-testid={`find-${role}`}>
                      See {cands.length} candidate{cands.length === 1 ? '' : 's'}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
