// ===================== catalog: categories, tests, reference ranges =====================
// ref.floor = result that scores 0, ref.elite = result that scores 100 on the benchmark scale (see Methodology).
// They are default reference points for a high-school / early-college basketball athlete, editable in Methodology.
// input: value (single number) | time (accepts m:ss) | lift (load × reps → estimated 1RM) | attempts (several trials).

const CATS = {
  speed: { name: 'Speed', group: 'physical' },
  power: { name: 'Jump & power', group: 'physical' },
  strength: { name: 'Strength', group: 'physical' },
  agility: { name: 'Agility', group: 'physical' },
  conditioning: { name: 'Conditioning', group: 'physical' },
  shooting: { name: 'Shooting', group: 'skill' },
  handling: { name: 'Ball handling', group: 'skill' },
  finishing: { name: 'Finishing', group: 'skill' },
  game: { name: 'Game impact', group: 'skill' },
};
const CAT_IDS = Object.keys(CATS);
const PHYS = CAT_IDS.filter((c) => CATS[c].group === 'physical');
const SKILL = CAT_IDS.filter((c) => CATS[c].group === 'skill');

const SPRINT_GUIDE = 'Electronic timing (gates) is most reliable. Hand timing usually reads 0.1–0.2 s fast; log the method in conditions so results are compared like-for-like. Same surface and footwear each time.';
const TESTS = [
  // ---- speed
  { id: 'sprint10', name: '10-yard sprint', cat: 'speed', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 2.05, elite: 1.55 },
    inst: 'Two-point stance, front foot on the line. Sprint through the 10-yard mark. Best of 2–3 trials with full rest (2+ min).', guide: SPRINT_GUIDE },
  { id: 'sprint20', name: '20-yard sprint', cat: 'speed', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 3.4, elite: 2.75 },
    inst: 'Two-point stance. Sprint through 20 yards. Best of 2–3 trials, full rest between.', guide: SPRINT_GUIDE },
  { id: 'sprint40', name: '40-yard sprint', cat: 'speed', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 5.6, elite: 4.5 },
    inst: 'Two- or three-point stance (log which). Sprint through 40 yards. Best of 2 trials with 3+ min rest.', guide: SPRINT_GUIDE },
  { id: 'sprint34', name: '¾-court sprint', cat: 'speed', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 3.75, elite: 3.05 },
    inst: 'Start on the baseline, sprint to the far free-throw line (75 ft). Best of 2 trials.', guide: SPRINT_GUIDE },
  { id: 'step5', name: 'First-step acceleration (5 yd)', cat: 'speed', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 1.25, elite: 0.95 },
    inst: 'Athletic stance, no false step allowed. Time from first movement to 5 yards. Best of 3.', guide: 'Use gates or slow-motion video (240 fps): count frames from first movement to crossing. Hand timing is not precise enough at this distance.' },
  // ---- power
  { id: 'vstand', name: 'Standing vertical jump', cat: 'power', unit: 'in', dir: 'higher', dec: 1, input: 'attempts', agg: 'max', ref: { floor: 18, elite: 32 },
    inst: 'Measure standing reach first. Feet planted, no step: countermovement and jump, touch as high as possible. Result = touch height − standing reach. 3 attempts.', guide: 'Use a Vertec, jump mat or wall-mark method consistently. Jump mats estimate height from flight time and can differ from reach-based tools.' },
  { id: 'vmax', name: 'Max vertical (approach)', cat: 'power', unit: 'in', dir: 'higher', dec: 1, input: 'attempts', agg: 'max', ref: { floor: 22, elite: 38 },
    inst: 'Free approach (any steps), one- or two-foot takeoff (note which). Result = touch height − standing reach. 3 attempts.', guide: 'Log takeoff style in conditions. Same tool as standing vertical.' },
  { id: 'broad', name: 'Broad jump', cat: 'power', unit: 'in', dir: 'higher', dec: 0, input: 'attempts', agg: 'max', ref: { floor: 80, elite: 115 },
    inst: 'Toes behind the line, two-foot takeoff and landing. Measure to the back of the rearmost heel. Must stick the landing. 3 attempts.', guide: 'Measure in inches. A fall backward is a no-jump.' },
  { id: 'rjump', name: 'Repeated jumps (5 reps)', cat: 'power', unit: 'in', dir: 'higher', dec: 1, input: 'attempts', agg: 'mean', ref: { floor: 15, elite: 28 },
    inst: 'Five consecutive max-effort countermovement jumps with minimal ground contact. Enter each jump height. Result = average of the five.', guide: 'A jump mat makes this practical. The spread of the five jumps is reported as jump consistency (CV).' },
  // ---- strength
  { id: 'bench', name: 'Bench press', cat: 'strength', unit: 'lb', dir: 'higher', dec: 0, input: 'lift', ref: { floor: 95, elite: 255 }, rel: { floor: 0.6, elite: 1.4 },
    inst: 'Work up to a heavy set of 1–5 reps with full range (bar to chest, no bounce). Enter load and reps.', guide: 'Sets above 1 rep give an estimated 1RM (Epley). Estimates are less accurate above 5 reps. Always use a spotter.' },
  { id: 'squat', name: 'Back squat', cat: 'strength', unit: 'lb', dir: 'higher', dec: 0, input: 'lift', ref: { floor: 135, elite: 365 }, rel: { floor: 0.9, elite: 2.0 },
    inst: 'Hip crease below the top of the knee. Heavy set of 1–5 reps. Enter load and reps.', guide: 'Depth must be the same every test. Estimated 1RM above 1 rep.' },
  { id: 'deadlift', name: 'Deadlift', cat: 'strength', unit: 'lb', dir: 'higher', dec: 0, input: 'lift', ref: { floor: 155, elite: 415 }, rel: { floor: 1.0, elite: 2.3 },
    inst: 'Conventional or trap bar (note which, they are not comparable). Heavy set of 1–5 reps.', guide: 'Log bar type in conditions.' },
  { id: 'pullups', name: 'Pull-ups (max reps)', cat: 'strength', unit: 'reps', dir: 'higher', dec: 0, input: 'value', ref: { floor: 3, elite: 18 },
    inst: 'Dead hang, palms away. Chin over the bar, full lockout at the bottom. Max consecutive reps.', guide: 'No kipping. Stop when form breaks.' },
  { id: 'pushups', name: 'Push-ups (max reps)', cat: 'strength', unit: 'reps', dir: 'higher', dec: 0, input: 'value', ref: { floor: 15, elite: 55 },
    inst: 'Chest to a fist-height target, full lockout, body straight. Max consecutive reps without resting.', guide: 'Use the same depth target each time.' },
  // ---- agility
  { id: 'lane', name: 'Lane agility', cat: 'agility', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 12.8, elite: 10.4 },
    inst: 'Combine drill around the lane: sprint baseline → defensive slide → backpedal → slide, then reverse. Best of 2.', guide: 'Any foot crossover on slides is a re-run. Same court each time.' },
  { id: 'proagility', name: 'Pro agility (5-10-5)', cat: 'agility', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 5.4, elite: 4.2 },
    inst: 'Straddle the middle line. Sprint 5 yd, touch line, 10 yd, touch line, 5 yd through the start. Run both directions; record the best.', guide: 'Hand must touch each line. Note starting direction.' },
  { id: 'ttest', name: 'T-test', cat: 'agility', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 11.5, elite: 9.0 },
    inst: 'Sprint 10 yd forward, shuffle 5 yd left, 10 yd right, 5 yd left, backpedal 10 yd. Touch each cone.', guide: 'No crossing feet on shuffles.' },
  { id: 'cod505', name: '505 change of direction', cat: 'agility', unit: 's', dir: 'lower', dec: 2, input: 'value', ref: { floor: 2.8, elite: 2.2 },
    inst: 'Fly in from 10 m, time the 5 m in and 5 m out around a 180° turn. Test each turning foot; enter the better one and note the foot.', guide: 'Comparing left vs right turns reveals change-of-direction asymmetry.' },
  // ---- conditioning
  { id: 'yoyo', name: 'Yo-Yo IR1', cat: 'conditioning', unit: 'm', dir: 'higher', dec: 0, input: 'value', ref: { floor: 600, elite: 2200 }, vo2: 'yoyo',
    inst: '2 × 20 m shuttles at increasing speed with 10 s active recovery. Stop at the second missed line. Result = total distance.', guide: 'Use the official audio track. Estimated VO₂max = distance × 0.0084 + 36.4 (Bangsbo et al., 2008).' },
  { id: 'beep', name: 'Beep test (20 m shuttle)', cat: 'conditioning', unit: 'level', dir: 'higher', dec: 1, input: 'value', ref: { floor: 6, elite: 13 }, vo2: 'beep',
    inst: '20 m shuttles to the beep, speed rising each level. Result = last level completed, written as level.shuttle (e.g. 10.4).', guide: 'Estimated VO₂max uses the Léger (1988) equation with age, so it needs age in the profile.' },
  { id: 'mile', name: 'Mile run', cat: 'conditioning', unit: 's', dir: 'lower', dec: 0, input: 'time', ref: { floor: 480, elite: 330 },
    inst: '4 laps of a 400 m track (or 1609 m measured). Enter time as m:ss.', guide: 'Note weather and surface.' },
  { id: 'rsa', name: 'Repeated sprint (6 × 30 m)', cat: 'conditioning', unit: 's', dir: 'lower', dec: 2, input: 'attempts', agg: 'mean', ref: { floor: 5.0, elite: 4.2 },
    inst: 'Six 30 m sprints, one starting every 20 s. Enter each time. Result = mean time; fatigue index = (slowest − fastest) / fastest.', guide: 'Same timing method for all six.' },
];
const TEST = Object.fromEntries(TESTS.map((t) => [t.id, t]));

/** Epley estimated 1RM. Exact when reps = 1. */
const epley = (load, reps) => (reps <= 1 ? load : load * (1 + reps / 30));
/** VO₂max estimates (ml·kg⁻¹·min⁻¹). Always flagged as estimates. */
function vo2Estimate(test, value, age) {
  if (test.vo2 === 'yoyo') return value * 0.0084 + 36.4;
  if (test.vo2 === 'beep' && age) { const lvl = Math.floor(value), sh = Math.round((value - lvl) * 10); const speed = 8 + 0.5 * (lvl + Math.min(sh, 15) / 16); return 31.025 + 3.238 * speed - 3.248 * age + 0.1536 * age * speed; }
  return null;
}

// ---- basketball vocab ----
const SHOT_TYPES = {
  spotup: { name: 'Spot-up', group: 'catch' }, catch: { name: 'Catch & shoot (moving)', group: 'catch' }, screen: { name: 'Off a screen', group: 'catch' },
  pullup: { name: 'Pull-up', group: 'dribble' }, dribble: { name: 'Other off-dribble (step-back, side-step)', group: 'dribble' },
  layup: { name: 'Layup / finish', group: 'rim' }, floater: { name: 'Floater', group: 'rim' }, post: { name: 'Post / hook', group: 'rim' },
};
const PRESSURE = { open: 'Open', light: 'Light pressure', contested: 'Contested' };
const CTX = { workout: 'Workout', game: 'Game' };
const FINISH_TYPES = { layup: 'Layup', floater: 'Floater', contact: 'Contact finish', reverse: 'Reverse', traffic: 'Through traffic' };
const DRILLS = [
  { id: 'pound', name: 'Pound dribbles', kind: 'stationary' }, { id: 'cross', name: 'Crossovers', kind: 'stationary' },
  { id: 'btl', name: 'Between the legs', kind: 'stationary' }, { id: 'btb', name: 'Behind the back', kind: 'stationary' },
  { id: 'combo', name: 'Combination series (e.g. cross–BTL–BTB)', kind: 'combo' }, { id: 'twoball', name: 'Two-ball series', kind: 'combo' },
  { id: 'cone', name: 'Cone change-of-direction', kind: 'cod' }, { id: 'zigzag', name: 'Zig-zag attack', kind: 'cod' },
  { id: 'fullcourt', name: 'Full-court speed dribble', kind: 'fullcourt' }, { id: 'tennis', name: 'Tennis-ball reaction', kind: 'combo' },
];
const DRILL = Object.fromEntries(DRILLS.map((d) => [d.id, d]));
const POSITIONS = { PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward', C: 'Center', G: 'Guard (combo)', F: 'Forward', NA: 'Other / not basketball' };
const GOALS = { speed: 'Get faster', power: 'Jump higher', strength: 'Get stronger', agility: 'Move better laterally', conditioning: 'Better conditioning', shooting: 'Shoot better', handling: 'Tighter handle', finishing: 'Finish better', game: 'Bigger game impact' };
/** Position weights for the Athlete Intelligence Score (documented in Methodology). */
const POS_WEIGHTS = {
  guard: { speed: 1.2, power: 1.0, strength: 0.8, agility: 1.2, conditioning: 1.0, shooting: 1.4, handling: 1.4, finishing: 1.1, game: 1.2 },
  wing: { speed: 1.1, power: 1.1, strength: 0.9, agility: 1.1, conditioning: 1.0, shooting: 1.4, handling: 1.0, finishing: 1.2, game: 1.2 },
  big: { speed: 0.9, power: 1.2, strength: 1.3, agility: 0.9, conditioning: 1.0, shooting: 0.9, handling: 0.6, finishing: 1.4, game: 1.2 },
  any: { speed: 1, power: 1, strength: 1, agility: 1, conditioning: 1, shooting: 1, handling: 1, finishing: 1, game: 1 },
};
const posGroup = (p) => (['PG', 'SG', 'G'].includes(p) ? 'guard' : ['SF', 'F'].includes(p) ? 'wing' : ['PF', 'C'].includes(p) ? 'big' : 'any');

/** Court zones for the shot chart (feet: x −25..25, y 0 = baseline, hoop at (0, 5.25)). */
const HOOP = { x: 0, y: 5.25 };
const ZONES = {
  ra: { name: 'Restricted area', pts: 2, exp: 0.6 }, paint: { name: 'Paint (non-RA)', pts: 2, exp: 0.42 },
  midL: { name: 'Left baseline mid', pts: 2, exp: 0.4 }, midLW: { name: 'Left elbow mid', pts: 2, exp: 0.4 }, midC: { name: 'Top mid', pts: 2, exp: 0.4 },
  midRW: { name: 'Right elbow mid', pts: 2, exp: 0.4 }, midR: { name: 'Right baseline mid', pts: 2, exp: 0.4 },
  c3L: { name: 'Left corner 3', pts: 3, exp: 0.38 }, w3L: { name: 'Left wing 3', pts: 3, exp: 0.35 }, t3: { name: 'Top 3', pts: 3, exp: 0.35 },
  w3R: { name: 'Right wing 3', pts: 3, exp: 0.35 }, c3R: { name: 'Right corner 3', pts: 3, exp: 0.38 },
};
function zoneOf(x, y) {
  const d = Math.hypot(x - HOOP.x, y - HOOP.y);
  const three = (Math.abs(x) >= 22 && y <= 14.2) || (y > 14.2 && d >= 23.75);
  const ang = (Math.atan2(y - HOOP.y, x - HOOP.x) * 180) / Math.PI; // 0 = right, 90 = straight out
  if (three) { if (y <= 14.2) return x < 0 ? 'c3L' : 'c3R'; return ang > 112 ? 'w3L' : ang < 68 ? 'w3R' : 't3'; }
  if (d <= 4) return 'ra';
  if (Math.abs(x) <= 8 && y <= 19) return 'paint';
  if (y <= 14.2) return x < 0 ? 'midL' : 'midR';
  return ang > 112 ? 'midLW' : ang < 68 ? 'midRW' : 'midC';
}
const distFt = (x, y) => Math.hypot(x - HOOP.x, y - HOOP.y);
