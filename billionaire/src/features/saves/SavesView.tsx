import { Panel } from '../../components/ui';
import { SaveSlots } from './SaveSlots';

export function SavesView() {
  return (
    <div className="page" data-testid="saves-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">Persistence</div>
          <h1>Save & Load</h1>
        </div>
      </div>
      <Panel tight>
        <SaveSlots mode="manage" />
      </Panel>
    </div>
  );
}
