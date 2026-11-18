// ===================== Suite signals =====================
// Each app in the bundle publishes one small weekly summary that the other apps may read (never write).
// Athlete OS owns "aos-signals". Gameplan owns "gp-sig". See athleteos/CONTRACT.md.
BLANK['aos-signals'] = () => ({});
function aosSignals() {
  const t = todayIso(), mon = mondayOf(t), wk = Array.from({ length: 7 }, (_, i) => shiftIso(mon, i)), past = wk.filter((d) => d <= t), ls = loadStats(t);
  let rd = null; try { rd = readiness(t)?.score ?? null; } catch {}
  const planned = wk.map((d) => itemsOn(d).filter((x) => x.type !== 'routine').length);
  return {
    v: 1, app: 'aos', week: mon, updated: t,
    acuteLoad: ls.acute, chronicLoad: ls.chronic, acwr: ls.acwr, readiness: rd,
    trainDays: past.filter(isActive).length, trainMins: sum(past.flatMap((d) => exList(d).map((x) => Number(x.mins) || 0))),
    plannedByDay: Object.fromEntries(wk.map((d, i) => [d, planned[i]])),
    nextGame: aos().profile?.nextGame || (core().game?.date >= t ? core().game.date : null),
  };
}
function writeSignals() {
  try {
    const s = aosSignals(), cur = doc('aos-signals') || {};
    if (JSON.stringify({ ...cur, updated: 0 }) === JSON.stringify({ ...s, updated: 0 })) return;
    cache['aos-signals'] = s; persist('aos-signals');
  } catch (e) { console.error(e); }
}
/** Read another app's summary (read-only). */
const suiteSignal = (key) => doc(key) || null;
