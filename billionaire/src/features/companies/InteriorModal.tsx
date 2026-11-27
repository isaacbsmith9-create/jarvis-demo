import { store, useStore } from '../../app/store';
import { Modal } from '../../components/ui';
import { roleDef, SUBTYPES } from '../../data/companies/industries';
import { PhaserInterior } from '../../game/PhaserInterior';
import { maxStaff } from '../../simulation/companies/companies';
import { companyStaff } from '../../simulation/employees/employees';
import { EmployeeDrawer } from '../employees/StaffView';

export function InteriorModal() {
  const s = useStore();
  const st = s.state!;
  const c = s.modal?.companyId ? st.companies[s.modal.companyId] : null;
  if (!c) return null;
  const staff = companyStaff(st, c);
  const data = {
    companyName: c.name,
    kind: (c.industry === 'hospitality' ? 'hospitality' : c.industry === 'retail' ? 'retail' : 'office') as 'office' | 'hospitality' | 'retail',
    staff: staff.map((e) => ({ id: e.id, name: e.name, title: roleDef(c.subtype, e.role)?.title ?? e.role, role: e.role, performance: e.performance })),
    owner: c.ownerOperated ? st.player.name : null,
    capacity: maxStaff(st, c),
  };
  const selected = s.selection.employeeId ? st.employees[s.selection.employeeId] : null;
  return (
    <Modal title={`${c.name} — ${c.locationId ? st.properties[c.locationId].name : SUBTYPES[c.subtype].mobile ? 'Mobile kitchen' : 'Home office'}`} onClose={() => store.openModal(null)} size="wide">
      <div className="grid" style={{ gridTemplateColumns: selected && selected.companyId === c.id ? 'minmax(0,1fr) 320px' : '1fr', gap: 16 }}>
        <div className="col" style={{ gap: 8 }}>
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
