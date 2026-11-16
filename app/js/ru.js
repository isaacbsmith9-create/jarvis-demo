// ReadyUp data: ru:core {settings} and ru:day-ISO {checkin, sessions}. Same scoring as ReadyUp.
import { rd, mut } from './store.js';
import { todayIso, shiftIso, toMin, r1, clamp } from './util.js';

export const LABELS = {
  quality: ['Awful', 'Poor', 'OK', 'Good', 'Great'],
  soreness: ['None', 'A little', 'Some', 'Very sore', 'Can barely move'],
  energy: ['Drained', 'Low', 'OK', 'Good', 'Charged'],
  stress: ['Calm', 'A little', 'Some', 'High', 'Very high'],
};
export const AREAS = ['Legs', 'Hips', 'Back', 'Shoulders', 'Arms', 'Knees', 'Ankles/feet'];
export const TYPES = ['Practice', 'Game', 'Lifting', 'Conditioning', 'Skill work', 'Pickup', 'Other'];
export const ZONE = { go: { label: 'GO', head: 'Ready to push', color: 'var(--good)' }, caution: { label: 'STEADY', head: 'Good to train, keep it smart', color: 'var(--warn)' }, rest: { label: 'RECOVER', head: 'Your body needs a lighter day', color: 'var(--bad)' } };

export const core = () => rd('ru:core') || { settings: { wake: '06:45', goal: 9, sport: '' } };
export const settings = () => ({ wake: '06:45', goal: 9, ...(core().settings || {}) });
export const day = (iso) => rd('ru:day-' + iso);
export const saveDay = (iso, fn) => mut('ru:day-' + iso, (d) => { d.sessions ||= []; fn(d); }, () => ({ checkin: null, sessions: [] }));
export const saveCore = (fn) => mut('ru:core', (c) => { c.settings ||= {}; fn(c); }, () => ({ settings: { wake: '06:45', goal: 9, sport: '' } }));

export function sleepHours(bed, wake) { if (!bed || !wake) return null; let m = toMin(wake) - toMin(bed); if (m <= 0) m += 1440; return r1(m / 60); }
export const dayLoad = (iso) => (day(iso)?.sessions || []).reduce((a, s) => a + (Number(s.mins) || 0) * (Number(s.rpe) || 0), 0);
const hasData = (iso) => { const d = day(iso); return !!(d && (d.checkin || (d.sessions || []).length)); };
export function loadRatio(iso) {
  const days28 = Array.from({ length: 28 }, (_, i) => shiftIso(iso, -(i + 1)));
  if (days28.filter(hasData).length < 14) return null;
  const acute = days28.slice(0, 7).reduce((a, d) => a + dayLoad(d), 0) / 7, chronic = days28.reduce((a, d) => a + dayLoad(d), 0) / 28;
  if (chronic < 1) return null;
  return { ratio: r1(acute / chronic) || 0, acute: Math.round(acute), chronic: Math.round(chronic) };
}
function rhrBaseline(iso) {
  const vals = Array.from({ length: 14 }, (_, i) => day(shiftIso(iso, -(i + 1)))?.checkin?.rhr).filter((v) => v > 0);
  return vals.length >= 5 ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null;
}
export function scoreFor(iso) {
  const c = day(iso)?.checkin; if (!c) return null;
  const goal = Number(settings().goal) || 9;
  const parts = {
    sleep: Math.round(clamp((c.sleepH - (goal - 3.5)) / 3.5, 0, 1) * 30), quality: Math.round(((c.quality - 1) / 4) * 15),
    soreness: Math.round(((5 - c.soreness) / 4) * 20), energy: Math.round(((c.energy - 1) / 4) * 15), stress: Math.round(((5 - c.stress) / 4) * 10),
  };
  const lr = loadRatio(iso);
  parts.load = lr == null ? 8 : lr.ratio > 1.5 ? 0 : lr.ratio > 1.3 ? 5 : lr.ratio < 0.8 ? 8 : 10;
  let total = Object.values(parts).reduce((a, b) => a + b, 0);
  const base = rhrBaseline(iso); let rhrDiff = null;
  if (base && c.rhr) { rhrDiff = c.rhr - base; if (rhrDiff >= 7) total -= 8; else if (rhrDiff >= 4) total -= 4; }
  total = clamp(Math.round(total), 0, 100);
  return { total, zone: total >= 75 ? 'go' : total >= 55 ? 'caution' : 'rest', parts, lr, rhrDiff, base, c, goal };
}
export function planFor(s) {
  const c = s.c, out = [];
  if (s.zone === 'go') out.push({ cls: 'good', t: 'Green light: go hard', p: 'Good day for max-effort lifts, sprints, jump work and extra conditioning after practice.' });
  else if (s.zone === 'caution') out.push({ cls: 'warn', t: 'Train normally, skip the extras', p: 'Full effort at practice, but keep any lift moderate. Put extra time into skill work and shooting instead of conditioning.' });
  else out.push({ cls: 'bad', t: 'Recovery day', p: 'Practice as planned if your coach expects you, but skip extra workouts. Form shooting or light skill work, 15 minutes of mobility, and bed early.' });
  if (c.sleepH < s.goal - 1.5) out.push({ cls: 'warn', t: `Short on sleep (${c.sleepH} h)`, p: 'A 20-minute nap before 3 PM helps. Go to bed earlier tonight instead of sleeping in all weekend.' });
  if (c.quality <= 2) out.push({ cls: 'warn', t: 'Rough sleep', p: 'Tonight: phone away 30 minutes before bed, room cool (65-68°F) and dark. Try the wind-down routine.' });
  if (c.soreness >= 4) out.push({ cls: 'warn', t: `Very sore${c.areas?.length ? ': ' + c.areas.join(', ').toLowerCase() : ''}`, p: 'Do the 10-minute leg mobility routine and light movement. No heavy lifting for those muscles today. Protein at every meal.' });
  else if (c.soreness === 3 && c.areas?.length) out.push({ cls: '', t: `Some soreness: ${c.areas.join(', ').toLowerCase()}`, p: 'Warm up longer today. Foam roll those areas for a minute each after practice.' });
  if (c.stress >= 4) out.push({ cls: 'warn', t: 'High stress', p: 'Stress hurts recovery as much as bad sleep. Two minutes of box breathing, then write down the one thing you need to get done today.' });
  if (c.energy <= 2 && c.sleepH >= s.goal - 1) out.push({ cls: 'warn', t: 'Low energy despite decent sleep', p: 'Check that you ate enough yesterday, especially carbs on a practice day, and drink water now. If it lasts several days, tell a parent or your doctor.' });
  if (s.rhrDiff != null && s.rhrDiff >= 4) out.push({ cls: s.rhrDiff >= 7 ? 'bad' : 'warn', t: `Resting heart rate ${s.rhrDiff} bpm above normal`, p: 'Can mean fatigue, dehydration or getting sick. Take it easier and drink more.' });
  if (s.lr && s.lr.ratio > 1.5) out.push({ cls: 'bad', t: `Training spike: ${s.lr.ratio}x your normal`, p: 'This week\'s load is much higher than your 4-week average. Keep extra workouts light for a few days.' });
  else if (s.lr && s.lr.ratio > 1.3) out.push({ cls: 'warn', t: `Load creeping up (${s.lr.ratio}x)`, p: 'You\'re training more than usual. Fine for now; don\'t add more on top.' });
  out.push({ cls: '', t: 'Fuel and hydrate', p: s.zone === 'rest' ? 'Recovery days still need full meals: protein at every meal, fruit and vegetables, and water all day.' : 'Real meal 3 hours before practice and a snack 45 minutes before.' });
  return out;
}
export function bedtimeFor(zone) { const st = settings(), goal = Number(st.goal) || 9; return toMin(st.wake || '06:45') - goal * 60 - 15 - (zone === 'rest' ? 30 : 0); }
export function streakDays() { let n = 0, d = todayIso(); if (!day(d)?.checkin) d = shiftIso(d, -1); while (day(d)?.checkin && n < 999) { n++; d = shiftIso(d, -1); } return n; }

export const ROUTINES = [
  { name: 'Leg mobility', mins: 10, when: 'Sore legs, before bed, or recovery days', steps: [
    ['Couch stretch, left', 45, 'Back knee on the floor against a wall or couch, squeeze that glute.'], ['Couch stretch, right', 45, 'Same on the other side.'],
    ["World's greatest stretch", 60, 'Lunge, hand down inside the front foot, rotate the chest open. Alternate sides, 5 each.'],
    ['90/90 hip switches', 45, 'Sit with both knees bent at 90°, rotate side to side slowly.'],
    ['Calf stretch, left', 30, 'Hands on a wall, back leg straight, heel down.'], ['Calf stretch, right', 30, 'Other side.'],
    ['Hamstring floss', 45, 'On your back, hold behind one knee and straighten the leg 10 times. Switch.'],
    ['Glute bridges', 45, '2 sets of 10, squeeze and hold 2 seconds at the top.'],
    ['Deep squat hold', 45, 'Sit into a deep squat, heels down, elbows pushing knees out.'],
    ['Ankle rocks', 40, 'Half kneeling, drive the front knee over the toes 10 times each side.']] },
  { name: 'Foam roll', mins: 8, when: 'After practice or games', steps: [
    ['Quads', 60, 'Face down, roll from hip to just above the knee. Pause on tight spots.'], ['Hamstrings', 60, 'Sit on the roller, roll from glute to knee.'],
    ['Calves', 60, 'Cross one leg over the other for more pressure. Switch halfway.'], ['Glutes', 60, 'Sit on the roller, ankle over the opposite knee, lean into that side.'],
    ['Upper back', 60, 'Hands behind your head, roll between the shoulder blades. Not the low back.'], ['Lats', 60, 'Lie on your side with the arm overhead, roll the side of your back.'],
    ['Hip flexors', 60, 'Face down, roller just below the hip bone. Small movements.'], ['Easy breathing', 60, 'Lie flat, slow breaths, let your heart rate come down.']] },
  { name: 'Box breathing', mins: 2, when: 'Stressed, before a game, or can\'t sleep', breath: true, steps: [['Box breathing', 120, 'Breathe in 4, hold 4, out 4, hold 4. Follow the circle.']] },
  { name: 'Wind-down for sleep', mins: 30, when: '30 minutes before lights out', check: true, steps: [
    ['Phone away', 0, 'Charge it outside your room or across the room.'], ['Set the room', 0, 'Cool (65-68°F), dark, quiet.'],
    ['Pack for tomorrow', 0, 'Bag, shoes and water bottle by the door.'], ['Shower', 0, 'A warm shower helps your body cool down after, which makes you sleepy.'],
    ['Read or stretch', 0, 'Paper book or light stretching. No screens.'], ['Lights out on time', 0, 'Same time every night, weekends within an hour.']] },
  { name: 'Post-game reset', mins: 15, when: 'Right after a game or hard practice', check: true, steps: [
    ['Cool down', 0, '5 minutes of easy walking or free throws.'], ['Drink', 0, '16-24 oz of fluid in the first hour.'],
    ['Recovery meal', 0, '25-40 g protein and carbs within an hour. Chocolate milk works in a pinch.'], ['Legs up the wall', 0, '3-5 minutes lying with your legs up a wall.'],
    ['Log the session', 0, 'Add it in Train so tomorrow\'s score knows.'], ['Screens off early', 0, 'Games leave you wired. Start winding down 30 minutes early.']] },
];
