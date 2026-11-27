import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { Avatar, Panel, SkillBar } from '../../components/ui';
import { roleDef, SUBTYPES } from '../../data/companies/industries';
import { TRAITS } from '../../data/employees/names';
import { fireEmployee, giveRaise, hireEmployee, maxStaff, trainEmployee, trainingCost } from '../../simulation/companies/companies';
import { effectiveness } from '../../simulation/employees/employees';
import type { Company, Employee } from '../../types/core';
import { formatDate } from '../../utils/date';
import { money } from '../../utils/format';

function loyaltyTone(v: number) {
  return v < 30 ? 'neg' : v < 50 ? 'warn' : 'pos';
}

export function StaffTable({ employees, showCompany }: { employees: Employee[]; showCompany: boolean }) {
  const st = useGame();
  const sel = store.selection.employeeId;
  if (!employees.length) return <div className="empty small">No employees.</div>;
  return (
    <table className="table" data-testid="staff-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          {showCompany && <th>Company</th>}
          <th className="r">Salary</th>
          <th className="r">Skill</th>
          <th className="r">Performance</th>
          <th className="r">Loyalty</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((e) => {
          const c = e.companyId ? st.companies[e.companyId] : null;
          return (
            <tr key={e.id} className={`click ${sel === e.id ? 'sel' : ''}`} onClick={() => store.select({ employeeId: sel === e.id ? null : e.id })}>
              <td>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar name={e.name} size={26} />
                  <div>
                    <div>{e.name}</div>
                    <div className="dim tiny">{e.traits.map((t) => TRAITS[t].label).join(' · ') || 'No notable traits'}</div>
                  </div>
                </div>
              </td>
              <td className="muted">{c ? roleDef(c.subtype, e.role)?.title : e.role}</td>
              {showCompany && <td className="muted">{c?.name}</td>}
              <td className="r">{money(e.salary)}</td>
              <td className="r">{Math.round(e.skill)}</td>
              <td className="r">{Math.round(e.performance)}</td>
              <td className={`r ${loyaltyTone(e.loyalty)}`}>{Math.round(e.loyalty)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function EmployeeDrawer({ e, onClose }: { e: Employee; onClose: () => void }) {
  const st = useGame();
  const c = e.companyId ? st.companies[e.companyId] : null;
  if (!c) return null;
  const role = roleDef(c.subtype, e.role);
  const cost = trainingCost(e);
  return (
    <div data-testid="employee-drawer">
      <div className="insp-h">
        <div className="row between">
          <span className="tag">{role?.title}</span>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 10 }}>
          <Avatar name={e.name} size={44} />
          <div>
            <h2 style={{ marginTop: 0 }}>{e.name}</h2>
            <div className="dim small">
              Age {e.age} · {c.name} · since {formatDate(Math.max(0, e.hiredDay))}
            </div>
          </div>
        </div>
      </div>
      <div className="insp-sec col" style={{ gap: 8 }}>
        <SkillBar label="Skill" value={e.skill} />
        <SkillBar label="Performance" value={e.performance} />
        <SkillBar label="Loyalty" value={e.loyalty} />
        <div className="kv" style={{ marginTop: 6 }}>
          <span>Salary</span>
          <span>{money(e.salary)}/yr</span>
          <span>Effectiveness</span>
          <span>{Math.round(effectiveness(e) * 100)}%</span>
        </div>
      </div>
      <div className="insp-sec">
        <h4>Traits</h4>
        {e.traits.length ? (
          e.traits.map((t) => (
            <div key={t} className="small" style={{ marginBottom: 4 }}>
              <span className={TRAITS[t].positive ? 'pos' : 'neg'}>{TRAITS[t].label}</span> <span className="dim">— {TRAITS[t].description}</span>
            </div>
          ))
        ) : (
          <div className="dim small">No notable traits.</div>
        )}
        <div className="dim small" style={{ marginTop: 8 }}>
          {role?.description}
        </div>
      </div>
      <div className="insp-actions">
        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" onClick={() => store.act((s) => giveRaise(s, e.id))}>
            Raise 10%
          </button>
          <button className="btn grow" disabled={e.skill >= 95} onClick={() => store.act((s) => trainEmployee(s, e.id))}>
            Train · {money(cost)}
          </button>
        </div>
        <button
          className="btn danger"
          onClick={() =>
            store.openModal({
              kind: 'confirm',
              title: `Let ${e.name} go?`,
              body: `Severance of ${money(Math.round((e.salary / 52) * 2))} (two weeks). Coworkers' loyalty will dip slightly.`,
              confirmLabel: 'Fire',
              onConfirm: () => {
                store.act((s) => fireEmployee(s, e.id));
                store.select({ employeeId: null });
              },
            })
          }
        >
          Fire
        </button>
      </div>
    </div>
  );
}

export function HiringPanel({ c }: { c: Company }) {
  const st = useGame();
  const [role, setRole] = useState<string>('all');
  const sub = SUBTYPES[c.subtype];
  const full = c.employeeIds.length >= maxStaff(st, c);
  const cands = c.candidates.filter((e) => role === 'all' || e.role === role);
  return (
    <Panel
      title="Hiring pool"
      tight
      actions={
        <>
          <select className="select" style={{ height: 28, width: 190 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All roles</option>
            {sub.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <span className="dim small">New candidates every Monday</span>
        </>
      }
    >
      {full && <div className="notice warn" style={{ margin: 12 }}>This location is at full staff capacity ({maxStaff(st, c)}). Move to a larger property to grow the team.</div>}
      {cands.length === 0 ? (
        <div className="empty small">No candidates for this role right now. Check back next week.</div>
      ) : (
        <table className="table" data-testid="candidates">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Role</th>
              <th className="r">Skill</th>
              <th>Traits</th>
              <th className="r">Salary ask</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cands.map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={e.name} size={26} />
                    <div>
                      {e.name}
                      <div className="dim tiny">Age {e.age}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">
                  {roleDef(c.subtype, e.role)?.title}
                  {roleDef(c.subtype, e.role)?.manager && <span className="tag gold" style={{ marginLeft: 6 }}>Mgr</span>}
                </td>
                <td className="r">
                  <span className={e.skill >= 70 ? 'pos' : e.skill < 35 ? 'neg' : ''}>{e.skill}</span>
                </td>
                <td className="small">
                  {e.traits.map((t) => (
                    <span key={t} className={TRAITS[t].positive ? 'pos' : 'neg'} style={{ marginRight: 8 }}>
                      {TRAITS[t].label}
                    </span>
                  ))}
                </td>
                <td className="r">{money(e.salary)}/yr</td>
                <td className="r">
                  <button className="btn sm primary" disabled={full} onClick={() => store.act((s) => hireEmployee(s, c.id, e.id))} data-testid="hire">
                    Hire
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function StaffView() {
  const st = useGame();
  const [filter, setFilter] = useState<string>('all');
  const companies = Object.values(st.companies).filter((c) => c.status !== 'closed');
  const all = Object.values(st.employees).filter((e) => e.companyId && (filter === 'all' || e.companyId === filter));
  const sel = store.selection.employeeId ? st.employees[store.selection.employeeId] : null;
  const payroll = all.reduce((s, e) => s + e.salary, 0);
  return (
    <div className="page" data-testid="staff-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">People</div>
          <h1>Staff</h1>
        </div>
        <div className="row">
          <select className="select" style={{ width: 220 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: sel ? 'minmax(0,1fr) 340px' : '1fr' }}>
        <Panel title={`${all.length} employees`} actions={<span className="dim small">Annual payroll {money(payroll)}</span>} tight>
          {all.length ? (
            <StaffTable employees={all} showCompany />
          ) : (
            <div className="empty">
              <h4>No employees yet</h4>
              <span className="small">Hire from a company's Staff tab.</span>
            </div>
          )}
        </Panel>
        {sel && (
          <div className="panel" style={{ alignSelf: 'start' }}>
            <EmployeeDrawer e={sel} onClose={() => store.select({ employeeId: null })} />
          </div>
        )}
      </div>
      {companies.length > 0 && (
        <Panel title="Hire for a company" tight>
          {companies.map((c) => (
            <div key={c.id} className="list-item click" onClick={() => store.openCompany(c.id)}>
              <span className="grow">{c.name}</span>
              <span className="dim small">
                {c.employeeIds.length}/{maxStaff(st, c)} staff · {c.candidates.length} candidates
              </span>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
