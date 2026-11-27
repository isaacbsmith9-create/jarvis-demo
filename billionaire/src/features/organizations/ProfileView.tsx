import { store, useGame } from '../../app/store';
import { Panel, Progress, Stat } from '../../components/ui';
import { scenarioById } from '../../data/scenarios/scenarios';
import { balanceSheet } from '../../simulation/finance/valuation';
import { objectiveProgress } from '../../simulation/objectives';
import { formatDate } from '../../utils/date';
import { money } from '../../utils/format';

export function ProfileView() {
  const st = useGame();
  const sc = scenarioById(st.player.scenarioId);
  const bs = balanceSheet(st);
  const prog = objectiveProgress(st);
  return (
    <div className="page" data-testid="profile-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">{sc.title}</div>
          <h1>{st.player.name}</h1>
        </div>
        <button
          className="btn ghost"
          onClick={() =>
            store.openModal({
              kind: 'confirm',
              title: 'Quit to main menu?',
              body: 'Unsaved progress since your last save will be lost. The game autosaves on the 1st of every month.',
              confirmLabel: 'Quit to menu',
              onConfirm: () => store.quitToMenu(),
            })
          }
          data-testid="quit-menu"
        >
          Quit to main menu
        </button>
      </div>
      <section className="panel">
        <div className="kpis">
          <Stat label="Business reputation" value={Math.round(st.player.reputation)} sub={<Progress ratio={st.player.reputation / 100} />} />
          <Stat label="Street credibility" value={Math.round(st.player.streetCred)} sub={<Progress ratio={st.player.streetCred / 100} />} />
          <Stat label="Business skill" value={st.player.businessSkill} sub="Your output when working in a company" />
          <Stat label="Net worth" value={money(bs.netWorth)} />
        </div>
      </section>
      <div className="grid g2">
        <Panel title="Background">
          <p className="muted" style={{ marginTop: 0 }}>
            {sc.story}
          </p>
          <div className="kv">
            <span>Campaign started</span>
            <span>{formatDate(0)}</span>
            <span>Days played</span>
            <span>{st.stats.daysPlayed}</span>
            <span>Companies founded</span>
            <span>{st.stats.companiesFounded}</span>
            <span>Properties bought</span>
            <span>{st.stats.propertiesBought}</span>
            <span>Hires</span>
            <span>{st.stats.hires}</span>
            <span>World seed</span>
            <span>{st.seed}</span>
          </div>
        </Panel>
        <Panel title={`Objective — ${st.objective.title}`}>
          <div className="col" style={{ gap: 10 }}>
            <div className="muted">{st.objective.description}</div>
            <Progress ratio={prog.ratio} />
            <div className="small">{prog.label}</div>
            <div className="dim small">{st.objective.deadlineDay !== null ? `Deadline: ${formatDate(st.objective.deadlineDay)}` : 'No deadline'}</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
