import { useState } from 'react';
import { store, useStore } from '../../app/store';
import { Modal } from '../../components/ui';
import { roleDef, SUBTYPES } from '../../data/companies/industries';
import { PhaserInterior } from '../../game/PhaserInterior';
import { maxStaffAt } from '../../simulation/companies/companies';
import { branchLabel, unitFor } from '../../simulation/companies/units';
import { companyStaff } from '../../simulation/employees/employees';
import { EmployeeDrawer } from '../employees/StaffView';

export function InteriorModal() {
  const s = useStore();
  const st = s.state!;
  const c = s.modal?.companyId ? st.companies[s.modal.companyId] : null;
  const [branchId, setBranchId] = useState<string | null>(null);
  if (!c) return null;
  const branch = c.branches.find((b) => b.id === branchId) ?? c.branches[0];
  const unit = unitFor(st, c, branch);
  const staff = companyStaff(st, unit);
  const data = {
    companyName: c.name,
    kind: (c.industry === 'hospitality' ? 'hospitality' : c.industry === 'retail' ? 'retail' : 'office') as 'office' | 'hospitality' | 'retail',
    staff: staff.map((e) => ({ id: e.id, name: e.name, title: roleDef(c.subtype, e.role)?.title ?? e.role, role: e.role, performance: e.performance })),
    owner: unit.ownerOperated ? st.player.name : null,
    capacity: maxStaffAt(st, c, branch),
  };
  const selected = s.selection.employeeId ? st.employees[s.selection.employeeId] : null;
  return (
    <Modal title={`${c.name} — ${branch.locationId ? branchLabel(st, c, branch) : SUBTYPES[c.subtype].mobile ? 'Mobile kitchen' : 'Home office'}`} onClose={() => store.openModal(null)} size="wide">
      <div className="grid" style={{ gridTemplateColumns: selected && selected.companyId === c.id ? 'minmax(0,1fr) 320px' : '1fr', gap: 16 }}>
        <div className="col" style={{ gap: 8 }}>
          {c.branches.length > 1 && (
            <div className="seg">
              {c.branches.map((b) => (
                <button key={b.id} className={b.id === branch.id ? 'on' : ''} onClick={() => setBranchId(b.id)}>
                  {branchLabel(st, c, b)}
                </button>
              ))}
            </div>
          )}
          <PhaserInterior data={data} onSelectEmployee={(id) => store.select({ employeeId: id })} />
          <div className="dim small">
            Every figure is a real employee of {c.name}. Click someone to see their profile. {staff.length === 0 && 'No staff yet — hire from the Staff tab.'}
          </div>
        </div>
        {selected && selected.companyId === c.id && (
          <div className="panel" style={{ alignSelf: 'start' }}>
            <EmployeeDrawer e={selected} onClose={() => store.select({ employeeId: null })} />
          </div>
        )}
      </div>
    </Modal>
  );
}
