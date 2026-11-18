// ===================== example athlete (clearly labelled demo data) =====================
// Generates ~7 months of plausible data for a fictional guard so every view can be explored before real data exists.
// All records carry demo:true and the athlete is named "Example Athlete (demo)". Deleting the athlete removes it all.
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function makeDemoAthlete() {
  const r = seeded(20261117), gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 1.2; };
  const aid = uid('ath'), today = isoDate(), start = addDays(today, -210);
  const a = { id: aid, demo: true, name: 'Example Athlete (demo)', sport: 'Basketball', pos: 'PG', height: 72, weight: 162, birth: addDays(today, -Math.round(16.4 * 365.25)),
    exp: 3, hand: 'R', foot: 'L', goals: ['power', 'shooting', 'finishing'], goalText: 'Make varsity as a starting point guard. Dunk by summer.', created: Date.now() };
  const recs = [], shots = [], drills = [], games = [];
  const ts = Date.now();
  // Testing sessions every ~3 weeks with gradual improvement and noise.
  const plan = {
    sprint10: [1.86, -0.07, 0.025], sprint20: [3.18, -0.1, 0.03], sprint34: [3.52, -0.12, 0.03], step5: [1.12, -0.05, 0.02], sprint40: [5.2, -0.12, 0.05],
    vstand: [21.5, 2.5, 0.6], vmax: [25, 4, 0.8], broad: [92, 6, 2], lane: [11.9, -0.5, 0.15], proagility: [4.85, -0.18, 0.06], ttest: [10.4, -0.4, 0.15],
    pullups: [7, 4, 0.8], pushups: [32, 8, 2], yoyo: [1080, 360, 60], beep: [9.2, 1.1, 0.25],
  };
  const sessionsDates = []; for (let d = 0; d <= 200; d += 21 + Math.floor(r() * 6)) sessionsDates.push(addDays(start, d));
  sessionsDates.forEach((date, i) => {
    const prog = i / (sessionsDates.length - 1);
    for (const [test, [base, gain, noise]] of Object.entries(plan)) {
      if (['sprint40', 'ttest', 'beep'].includes(test) && i % 2) continue;
      // Standing vertical deliberately plateaus (shows a "stagnant" read); lane agility gets noisy.
      const p = test === 'vstand' ? Math.min(prog, 0.35) : prog;
      const noiseMul = test === 'lane' ? 2.6 : 1;
      const t = TEST[test]; let v = base + gain * p + gauss() * noise * noiseMul; v = Number(v.toFixed(t.dec));
      const rec = { id: uid('rec'), aid, demo: true, test, date, ts, cond: { timing: test.startsWith('sprint') || test === 'step5' ? 'electronic' : '', surface: 'Gym hardwood' }, notes: '' };
      if (t.input === 'attempts') rec.attempts = [v - Math.abs(gauss()) * noise, v, v - Math.abs(gauss()) * noise].map((x) => Number(x.toFixed(t.dec)));
      else rec.value = v;
      recs.push(rec);
    }
    // repeated jumps & sprint ability
    const rj = 18 + 3 * prog; recs.push({ id: uid('rec'), aid, demo: true, test: 'rjump', date, ts, attempts: [0, 1, 2, 3, 4].map((k) => Number((rj - k * 0.5 + gauss() * 0.7).toFixed(1))), cond: {}, notes: '' });
    if (i % 2 === 0) recs.push({ id: uid('rec'), aid, demo: true, test: 'rsa', date, ts, attempts: [0, 1, 2, 3, 4, 5].map((k) => Number((4.62 - 0.12 * prog + k * 0.05 + gauss() * 0.03).toFixed(2))), cond: { timing: 'electronic' }, notes: '' });
    // lifts: heavy sets of 3–5 (estimated 1RM)
    for (const [test, base, gain] of [['bench', 135, 30], ['squat', 185, 70], ['deadlift', 205, 70]]) {
      const reps = 3 + Math.floor(r() * 3), e1 = base + gain * prog + gauss() * 5, load = Math.round(e1 / (1 + reps / 30) / 5) * 5;
      recs.push({ id: uid('rec'), aid, demo: true, test, date, ts, load, reps, bw: Math.round(158 + 6 * prog), cond: {}, notes: '' });
    }
  });
  // Shooting: workouts 3×/week with shots on the court, plus free throws.
  const spots = [[-22, 3, 'spotup'], [22, 3, 'spotup'], [-17, 17, 'catch'], [17, 17, 'catch'], [0, 26, 'pullup'], [-11, 19, 'pullup'], [11, 19, 'dribble'], [-6, 12, 'pullup'], [6, 13, 'screen'], [0, 7, 'layup'], [-2, 9, 'floater'], [-19, 21, 'screen']];
  const pBase = { spotup: 0.41, catch: 0.39, screen: 0.36, pullup: 0.37, dribble: 0.34, layup: 0.66, floater: 0.46 };
  for (let d = 0; d <= 205; d += 3 + Math.floor(r() * 2)) {
    const date = addDays(start, d), prog = d / 205;
    for (let k = 0; k < 18; k++) {
      const [sx, sy, type] = spots[Math.floor(r() * spots.length)];
      const x = Number((sx + gauss() * 1.4).toFixed(1)), y = Number(clamp(sy + gauss() * 1.4, 0.5, 40).toFixed(1));
      const z = zoneOf(x, y), three = ZONES[z].pts === 3;
      let p = pBase[type] + 0.07 * prog - (three ? 0.02 : 0) + (x < -4 && !three && type === 'pullup' ? -0.08 : 0);
      const pressure = r() < 0.3 ? 'contested' : r() < 0.5 ? 'light' : 'open'; if (pressure === 'contested') p -= 0.08;
      const made = r() < p;
      shots.push({ id: uid('s'), aid, demo: true, date, x, y, type, ctx: 'workout', pressure, makes: made ? 1 : 0, att: 1 });
    }
    const fta = 20, ftp = 0.68 + 0.08 * prog; let ftm = 0; for (let k = 0; k < fta; k++) if (r() < ftp) ftm++;
    shots.push({ id: uid('sh'), aid, demo: true, date, ts, type: 'ft', ctx: 'workout', pressure: 'open', makes: ftm, att: fta });
  }
  // Ball handling: 2×/week; weak hand lags.
  for (let d = 1; d <= 205; d += 3 + Math.floor(r() * 2)) {
    const date = addDays(start, d), prog = d / 205;
    for (const dr of ['cross', 'btl', 'combo', 'cone']) for (const hand of dr === 'combo' || dr === 'cone' ? ['both'] : ['strong', 'weak']) {
      const dur = 45, rate = (dr === 'combo' ? 26 : dr === 'cone' ? 18 : 40) * (hand === 'weak' ? 0.7 + 0.12 * prog : 1) * (0.92 + 0.12 * prog);
      const reps = Math.round((rate * dur) / 60 + gauss() * 1.5), tov = Math.max(0, Math.round((hand === 'weak' ? 2.2 : 1) * (1.4 - prog) + gauss() * 0.8));
      drills.push({ id: uid('dr'), aid, demo: true, kind: 'handle', date, ts, drill: dr, hand, dur, reps, tov, done: tov <= 2 });
    }
    // Finishing: left hand lags.
    for (const [type, hand, p] of [['layup', 'R', 0.74], ['layup', 'L', 0.52], ['contact', 'R', 0.5], ['contact', 'L', 0.36], ['floater', 'R', 0.46], ['reverse', 'L', 0.42], ['traffic', 'R', 0.4]]) {
      const att = 8; let makes = 0; for (let k = 0; k < att; k++) if (r() < p + 0.08 * prog) makes++;
      drills.push({ id: uid('dr'), aid, demo: true, kind: 'finish', date, ts, type, hand, makes, att, ctx: 'workout' });
    }
  }
  // Games: last 10 weeks, twice a week.
  const opps = ['North', 'Central', 'Westview', 'Lakeside', 'Eastridge', 'Valley', 'Summit', 'Riverside', 'Oak Hill', 'Pine Creek'];
  for (let g = 0; g < 18; g++) {
    const date = addDays(today, -70 + g * 4), prog = g / 17;
    const fga = 9 + Math.floor(r() * 7), tpa = Math.floor(fga * 0.45), tpm = Math.round(tpa * (0.31 + 0.05 * prog + gauss() * 0.08)), fgm = clamp(Math.round(fga * (0.42 + 0.04 * prog + gauss() * 0.08)), tpm, fga);
    const fta = Math.floor(r() * 7), ftm = clamp(Math.round(fta * (0.72 + gauss() * 0.1)), 0, fta);
    games.push({ id: uid('gm'), aid, demo: true, date, ts, opp: opps[g % opps.length], min: 22 + Math.floor(r() * 10), pts: 2 * (fgm - tpm) + 3 * tpm + ftm, reb: 2 + Math.floor(r() * 4), ast: 3 + Math.floor(r() * 5 + prog * 2), stl: Math.floor(r() * 3), blk: Math.floor(r() * 1.4), tov: 1 + Math.floor(r() * 4 - prog), fgm, fga, tpm: clamp(tpm, 0, tpa), tpa, ftm, fta, pm: Math.round(gauss() * 8) });
  }
  return { a, recs, shots, drills, games };
}
function loadDemo() {
  const D = makeDemoAthlete(), A = doc('athletes');
  A.list.push(D.a); A.current = D.a.id; persist('athletes');
  doc('records').list.push(...D.recs); persist('records');
  doc('shots').list.push(...D.shots); persist('shots');
  doc('drills').list.push(...D.drills); persist('drills');
  doc('games').list.push(...D.games); persist('games');
  const m = doc('meta');
  m.blocks.push({ id: uid('blk'), aid: D.a.id, demo: true, name: 'Off-season strength block', from: addDays(isoDate(), -210), to: addDays(isoDate(), -120), focus: 'Strength & power' });
  m.blocks.push({ id: uid('blk'), aid: D.a.id, demo: true, name: 'Pre-season speed block', from: addDays(isoDate(), -119), to: addDays(isoDate(), -60), focus: 'Speed & conditioning' });
  m.blocks.push({ id: uid('blk'), aid: D.a.id, demo: true, name: 'In-season', from: addDays(isoDate(), -59), to: isoDate(), focus: 'Maintenance & skill' });
  m.groups.push({ id: uid('grp'), aid: D.a.id, demo: true, name: 'Varsity guards (example)', test: 'vmax', entries: [{ name: 'Teammate A', value: 31.5 }, { name: 'Teammate B', value: 28 }, { name: 'Teammate C', value: 26.5 }, { name: 'Teammate D', value: 33 }] });
  persist('meta');
  return D.a;
}
/** Remove an athlete and every record that belongs to them. */
function deleteAthlete(aid) {
  for (const k of ['records', 'shots', 'drills', 'games']) { const d = doc(k); d.list = d.list.filter((x) => x.aid !== aid); persist(k); }
  const m = doc('meta'); for (const k of ['blocks', 'groups', 'reports']) m[k] = m[k].filter((x) => x.aid !== aid); persist('meta');
  const A = doc('athletes'); A.list = A.list.filter((x) => x.id !== aid); if (A.current === aid) A.current = A.list[0]?.id || null; persist('athletes');
}
