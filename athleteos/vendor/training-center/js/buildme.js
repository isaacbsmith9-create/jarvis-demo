/* ==================== Build for me: time-based, variable sessions ====================
   Who + hoop + up to 3 areas + optional specifics → a session in sections, every drill in minutes,
   swap any drill, start now, add to today, favorite, or edit first in the Workout Writer.
   Drills are original, written around variable, game-like (CLA) training. */
var BM_PRINCIPLES = {
  variable: ['No two reps the same', 'Change the footwork, angle, speed or finish every rep. Your body learns to solve, not copy.'],
  balance: ['Score from imperfect positions', 'Games aren’t balanced. Train catching off target, leaning, landing ugly, then recovering.'],
  reactive: ['React, don’t script', 'Decide late off a call, a cue or a defender. The read is the skill.'],
  speed: ['Game speed', 'Full speed approaches and quick releases. Slow reps only on purpose.'],
  fatigue: ['Tired legs', 'Shoot and finish after sprints, like the 4th quarter.'],
  athletic: ['Play above the rim', 'Explosive takeoffs, high catches, finishing at your highest point.'],
  touch: ['Touch', 'Soft hands from every angle and both sides of the rim.'],
  tight: ['Tight spaces', 'Small areas force quick, strong decisions.'],
  mental: ['Mental reps', 'See it before you do it. Visualizing a rep makes the real one sharper.'],
  volume: ['Rhythm volume', 'Simple, high-make reps that keep the shot feeling good.'],
};
var BM_AREAS = {
  Shooting: { ic: 'crosshair', subs: [['range', 'Range shooting'], ['form', 'Form / fluidity'], ['mid', 'Mid-range shooting'], ['catch', 'Shooting off the catch'], ['footwork', 'Footwork shooting'], ['volume', 'Volume shooting'], ['dribble', 'Shooting off the dribble'], ['cond', 'Conditioning shooting']] },
  'Ball Handling': { ic: 'activity', subs: [['pressure', 'Handling under pressure'], ['creative', 'Creativity / freestyle'], ['change', 'Change of pace & direction'], ['weak', 'Weak hand'], ['score', 'Handle into scoring'], ['strong', 'Strong ball']] },
  Finishing: { ic: 'flame', subs: [['footwork', 'Footwork around the rim'], ['speed', 'Finishing at speed'], ['float', 'Floaters'], ['athletic', 'Athletic finishing'], ['touch', 'Finishing touch'], ['pickups', 'Pickups around the rim']] },
};
/* [slug, name, area, subs, mins, flags (h=needs hoop, p=needs partner), principle, how, cue, shotType] */
var BM_SEED = [
  ['bm-angle-layups', 'Every-Angle Layup Warm-up', 'Finishing', 'warm', 4, 'h', 'variable', 'Non-stop layups from every angle: baseline, wing, middle, both hands. Change your gather every rep: hop, 1-2, inside foot, outside foot.', 'Never the same layup twice in a row.', 'layup'],
  ['bm-handle-wake', 'Handle Wake-Up', 'Ball Handling', 'warm', 3, '', 'variable', '30 seconds each: pounds both hands, crosses, between, behind, then freestyle. Speed up each round.', 'Stay low, eyes up by the last round.'],
  ['bm-form-late', 'Close Swishes, Late Eyes', 'Shooting', 'warm form', 3, 'h', 'volume', 'From 5–8 feet, one-motion shots. Look at the rim late, right as you start the shot. Step back after 3 swishes in a row.', 'Feel it, don’t aim it.', 'catch'],
  ['bm-offrhythm', 'Off-Rhythm Jumpers', 'Shooting', 'footwork catch', 3, 'h', 'variable', 'Self-toss and shoot, but change the rhythm every rep: hop, 1-2, quick-quick, slow-fast, step-in, step-out. Never repeat the same footwork twice.', 'Same release, different feet.', 'catch'],
  ['bm-turn-fire', 'Sprint, Turn, Fire', 'Shooting', 'cond catch', 3.5, 'h', 'fatigue', 'Sprint toward half court, plant and turn back at the line, sprint to your spot, catch your self-pass and shoot. Every rep starts with the sprint.', 'Brake hard, then sit into the shot.', 'catch'],
  ['bm-base-mix', 'Wide Base, Narrow Base', 'Shooting', 'form footwork', 3, 'h', 'balance', 'Alternate your stance every shot: wide, narrow, staggered left, staggered right. Find a shot that works from any base.', 'Adjust the legs, not the arms.', 'catch'],
  ['bm-lean-recover', 'Lean, Recover, Shoot', 'Shooting', 'catch form', 4, 'h', 'balance', 'Toss the ball slightly off target (high, low, wide). Reach for it outside your body, get back to your balance in one move, shoot.', 'Catch ugly, shoot pretty.', 'catch'],
  ['bm-hold-landing', 'Hold the Landing', 'Shooting', 'form mid', 3, 'h', 'balance', 'Every shot, hold your landing for 2 seconds. If you wobble or drift, it doesn’t count, even if it went in.', 'Land where you took off.', 'catch'],
  ['bm-see-it', 'See It, Then Shoot It', 'Shooting', 'form range mid', 4, 'h', 'mental', 'Pick a game situation (late clock, corner kick-out). Close your eyes and see 3 reps of it going in, then take 3 live reps. Repeat with a new situation.', 'See the whole play, not just the shot.', 'catch'],
  ['bm-step-line', 'Step-Back the Line', 'Shooting', 'range', 4, 'h', 'variable', 'Start at the elbow. Make 2 in a row: take a step back. Miss 2 in a row: step in. How far can you get?', 'Range comes from the legs.', 'catch'],
  ['bm-deep-catch', 'Deep Catch Range Builder', 'Shooting', 'range catch', 4, 'h', 'speed', 'Self-pass and catch 1–3 steps behind the line, on the move. Quick shot, no extra dip.', 'Load on the catch, not after.', 'catch'],
  ['bm-elbow-reads', 'Elbow Pull-Up Reads', 'Shooting', 'mid dribble', 4, 'h', 'reactive', 'From the top, attack an elbow. Decide left or right on a late call (partner, or flip a coin on the catch). One or two dribbles, pull up.', 'Decide late, rise early.', 'move'],
  ['bm-short-turn', 'Short-Corner Turn & Rise', 'Shooting', 'mid footwork', 3, 'h', 'variable', 'Catch in the short corner. Pivot baseline or middle, your choice each rep, and rise. Add a pump fake every third rep.', 'Shoulders square before the rise.', 'turn'],
  ['bm-selfpass-3s', 'Self-Pass Movement Threes', 'Shooting', 'catch volume', 4, 'h', 'speed', 'Throw a self-pass to the side, run onto it and shoot in rhythm. Move to a new spot every shot.', 'Feet ready before the ball lands.', 'catch'],
  ['bm-speed-round', 'Two-Minute Speed Round', 'Shooting', 'volume cond', 3, 'h', 'fatigue', 'Two minutes: as many makes as you can, moving to a new spot after every shot. Record your makes and beat them next time.', 'Fast, but every shot is a real shot.', 'catch'],
  ['bm-make-count', 'Make-Count Rhythm Round', 'Shooting', 'volume form', 6, 'h', 'volume', 'Easy rhythm: 10 makes mid, 10 makes three, 10 makes mid, 10 makes three. Count makes, not shots.', 'Smooth and repeatable.', 'catch'],
  ['bm-pull-menu', 'Two-Dribble Pull-Up Menu', 'Shooting', 'dribble', 4, 'h', 'variable', 'Hesi, cross, between, in-and-out, then the pull-up. A different move every rep, both directions.', 'Last dribble hard, then up.', 'move'],
  ['bm-bump-fade', 'Bump-and-Fade Series', 'Shooting', 'dribble mid', 3, 'h', 'balance', 'Drive into a pad, wall or partner, bump, create a step of space and fade. Alternate shoulders.', 'Create space with the bump, not the lean.', 'bump'],
  ['bm-push-pull', 'Push-and-Pull Transition Jumpers', 'Shooting', 'dribble cond', 3.5, 'h', 'speed', 'Push the ball full speed from half court, stop on a dime at a different spot each rep, pull up.', 'Two-foot stop, no drifting.', 'trans-pull'],
  ['bm-tired-3s', 'Tired-Legs Threes', 'Shooting', 'cond range', 3, 'h', 'fatigue', 'Sprint baseline to free throw line and back, then two threes. Repeat for the whole block.', 'Legs into the shot when tired.', 'catch'],
  ['bm-bad-passes', 'Bad-Pass Catch & Shoot', 'Shooting', 'catch footwork', 4, 'hp', 'variable', 'Partner throws on purpose: high, low, wide, behind you. Catch, get your feet under you, shoot.', 'The pass decides your footwork.', 'catch'],
  ['bm-eyes-closed', 'Eyes-Closed Feel Shots', 'Shooting', 'form', 2, 'h', 'mental', 'From close, set your feet, look, close your eyes, shoot. Feel the release and the follow-through.', 'Trust the motion.', 'catch'],
  ['bm-two-foot-options', 'Two-Foot Option Finishes', 'Finishing', 'footwork pickups', 3, 'h', 'reactive', 'Drive, jump stop. On the stop, pick: power, pump-and-go, up-and-under or spin. Mix them; with a partner they call it.', 'Chin the ball, stay strong.', 'layup'],
  ['bm-tempo-finishes', 'Change-of-Tempo Finishes', 'Finishing', 'speed footwork', 3, 'h', 'variable', 'Approach slow, then explode on the last two steps. Next rep: fast approach, slow gather. Finish through a raised hand or pad.', 'The speed change beats the defender.', 'layup'],
  ['bm-pivot-out', 'Pivot Out of Trouble', 'Finishing', 'footwork', 4, 'h', 'variable', 'Pick up in traffic (cone or chair in front), front or reverse pivot into open space, finish. Different pivot each rep.', 'Low pivot, ball protected.', 'layup'],
  ['bm-one-foot-launch', 'Explosive One-Foot Takeoffs', 'Finishing', 'athletic', 3, 'h', 'athletic', 'Attack from the left lane, middle and right lane. Max height off one foot, finish high off the glass. Rest 20 seconds between rounds.', 'Big last step, knee drive.', 'layup'],
  ['bm-jump-basics', 'Jump-and-Finish Basics', 'Finishing', 'athletic', 4, 'h', 'athletic', 'Rim or backboard touches off two feet, then off one foot, then the same takeoffs with a finish. Quality jumps only.', 'Quick off the floor.', 'layup'],
  ['bm-one-dribble-range', 'One-Dribble Range Finishing', 'Finishing', 'speed athletic', 3, 'h', 'athletic', 'One dribble, then finish. Start close. Every make, start a step farther out. How far can you score from on one dribble?', 'Long, low first step.', 'layup'],
  ['bm-baseline-escape', 'Baseline Escape Finishes', 'Finishing', 'footwork touch', 3, 'h', 'variable', 'Drive baseline, then finish on the far side, a reverse, or a jump-back finish away from the rim. Change it every rep.', 'Use the rim as a shield.', 'layup'],
  ['bm-glass-flow', 'Continuous Glass Flow', 'Finishing', 'athletic touch', 4, 'h', 'variable', 'Toss off the glass, finish right; catch it out of the net in the air, finish left; keep it going with no resets. Change the variation every round.', 'Catch it at its highest point.', 'layup'],
  ['bm-high-lobs', 'High-Point Self-Lobs', 'Finishing', 'athletic', 4, 'h', 'athletic', 'Throw it high off the backboard or into the air, attack it, catch at your peak, finish. Off one foot, then two.', 'Two hands on the catch.', 'layup'],
  ['bm-float-call', 'Floater on the Call', 'Finishing', 'float', 3, 'h', 'reactive', 'Attack the paint. At the gather, a partner (or random voice note) calls “float” or “rim”. Do what they call.', 'Decide at the gather.', 'float'],
  ['bm-float-ladder', 'Floater Range Ladder', 'Finishing', 'float touch', 3, 'h', 'touch', 'Floaters from short, medium and long. Two makes at each distance, both sides, off one and two feet.', 'High and soft.', 'float'],
  ['bm-runners', 'Runners Off Either Foot', 'Finishing', 'float speed', 3, 'h', 'speed', 'At full speed, runner off the left foot, then the right. No gather step: let it go on the move.', 'Push it high, don’t throw it.', 'runner'],
  ['bm-lane-1v1', 'Lane-Width 1v1', 'Finishing', 'speed footwork', 4, 'hp', 'tight', 'Play 1v1 inside the lane lines only. Score in 3 dribbles. Make it, take it.', 'Strong and quick, no wasted moves.', 'layup'],
  ['bm-contact', 'Contact Gathers', 'Finishing', 'touch footwork', 3, 'h', 'balance', 'Pad, wall or partner bumps you on the gather. Absorb, stay square, finish soft.', 'Finish with your eyes on the rim.', 'layup'],
  ['bm-touch-circle', 'Soft-Touch Circle', 'Finishing', 'touch', 3, 'h', 'touch', 'Work around the rim: every angle, both sides, off glass and straight in. One minute right hand, one left, one either.', 'Let it roll off your fingertips.', 'layup'],
  ['bm-pickup-menu', 'Pickup Menu', 'Finishing', 'pickups', 4, 'h', 'variable', 'Inside-foot, outside-foot, hop, 1-2 and crossover pickups. A different pickup every rep, both sides.', 'Pick up early when they’re close.', 'layup'],
  ['bm-wrong-foot', 'Wrong-Foot Pickups', 'Finishing', 'pickups footwork', 3, 'h', 'variable', 'Finish off the “wrong” foot on purpose: right-hand layup off the right foot, and the other way round.', 'It throws off the shot-blocker’s timing.', 'layup'],
  ['bm-half-speed', 'Full-Speed Finishes from Half', 'Finishing', 'speed', 3.5, 'h', 'speed', 'Start at half court, full speed, finish. Alternate sides and hands. Walk back, go again.', 'Control at speed.', 'layup'],
  ['bm-euro-hop', 'Euro, Hop, or Straight', 'Finishing', 'speed footwork', 3, 'h', 'reactive', 'Attack a cone or chair. At the last second choose euro, hop or straight line, randomly or on a call.', 'Sell the first direction.', 'layup'],
  ['bm-tennis-chaos', 'Tennis-Ball Chaos', 'Ball Handling', 'creative pressure', 4, '', 'variable', 'Dribble while tossing and catching a tennis ball with the other hand. Add moves between tosses.', 'Eyes up, ball stays alive.'],
  ['bm-cuff-strength', 'Pound & Cuff Strength', 'Ball Handling', 'strong', 3, '', 'balance', 'Hard pound dribbles, cuff the ball with your wrist over the top, power crosses. Low and strong.', 'Make it loud.'],
  ['bm-weak-flow', 'Weak-Hand Only Flow', 'Ball Handling', 'weak creative', 3, '', 'variable', 'Weak hand only: pounds, in-and-outs, wraps, freestyle. Change speed and height every few seconds.', 'Push the ball, don’t pat it.'],
  ['bm-speed-line', 'Speed-Change Line', 'Ball Handling', 'change', 3, '', 'speed', 'Down a line: slow, explode, slow, explode. Change hands on every speed change.', 'The change is the move.'],
  ['bm-retreat', 'Retreat & Re-Attack', 'Ball Handling', 'change pressure', 3, '', 'reactive', 'Attack, two retreat dribbles under imaginary pressure, re-attack the other way. Add a move on the re-attack.', 'Retreat with your eyes up.'],
  ['bm-pressure-box', 'Pressure Box', 'Ball Handling', 'pressure strong', 4, 'p', 'tight', '30 seconds in a small box with a partner reaching, bumping and swiping. Keep the dribble alive.', 'Body between the ball and the hand.'],
  ['bm-combo-pull', 'Combo into Pull-Up', 'Ball Handling', 'score', 4, 'h', 'variable', 'Two-move combo into a pull-up. New combo every rep.', 'Last move sets up the shot.', 'move'],
  ['bm-combo-finish', 'Combo into Finish', 'Ball Handling', 'score', 4, 'h', 'speed', 'Combo at the top, explode downhill, finish with whatever the angle gives you.', 'Get downhill after the move.', 'layup'],
  ['bm-freestyle', 'Freestyle 30s', 'Ball Handling', 'creative', 3, '', 'variable', '30 seconds of moves with no script, 15 seconds rest. Link 3–5 moves and change speed.', 'Be creative, stay under control.'],
  ['bm-number-calls', 'Eyes-Up Number Calls', 'Ball Handling', 'change creative', 3, '', 'reactive', 'Watch a partner’s fingers or a random-number timer. Each number is a move. Call it out and do it.', 'Read, then react.'],
  ['bm-two-ball', 'Two-Ball Rhythm', 'Ball Handling', 'weak creative', 4, '', 'variable', 'Same time, alternate, one high one low, then crosses. 30-second rounds.', 'Weak hand sets the pace.'],
  ['bm-wall-bumps', 'Wall-Bump Dribbles', 'Ball Handling', 'strong pressure', 3, '', 'balance', 'Shoulder into a wall or pad while dribbling, push off, change direction. Keep a strong dribble through the bump.', 'Absorb, then explode out.'],
  ['bm-wall-form', 'Wall Form Shots', 'Shooting', 'form footwork', 3, 'n', 'balance', 'No hoop: shoot to a target on a wall or straight up so the ball comes back to you. One motion, hold the follow-through, check your landing.', 'Same release every time.'],
  ['bm-shadow-feet', 'Shot Footwork Shadow Reps', 'Shooting', 'footwork catch', 3, 'n', 'variable', 'No hoop: with the ball, rep your catch footwork at game speed: hop, 1-2, turn-and-face, step-back. Rise into a shot fake every rep.', 'Feet first, ball second.'],
  ['bm-visual-only', 'Visualization Block', 'Shooting', 'form range mid catch', 4, 'n', 'mental', 'Sit or stand still. See 10 game shots in detail: the catch, the defender, your feet, the release, the ball going in. Then 10 slow shadow shots matching what you saw.', 'See it in first person, full speed.'],
  ['bm-takeoffs', 'Takeoff Power Jumps', 'Finishing', 'athletic footwork', 4, 'n', 'athletic', 'No hoop: from a 3-step approach, max jumps off one foot (both sides) then off two. Land soft, reset, repeat. Quality over quantity.', 'Last step big, arms drive up.'],
  ['bm-gather-shadow', 'Gather Footwork Shadow', 'Finishing', 'footwork pickups', 3, 'n', 'variable', 'No hoop: with the ball, rep your gathers at speed: euro, hop, inside foot, outside foot, pivot out. A different one every rep.', 'Protect the ball on every gather.'],
  ['bm-float-angles', 'Floaters from Three Angles', 'Finishing', 'float touch', 3, 'h', 'variable', 'Floaters from the left lane, middle and right lane. Change the takeoff foot and release height each rep.', 'Release before the help arrives.', 'float'],
  ['bm-float-hand', 'Floater Over a Raised Hand', 'Finishing', 'float', 3, 'h', 'balance', 'A partner, chair with a raised stick, or a pad contests every floater. Get it over the hand and soft.', 'High arc, soft wrist.', 'float'],
];
var BM_BAM = [
  ['bam-no-rhythm', 'No Rhythm Jumpers', 'Shooting', 'catch footwork', 2, 'hb', 'variable', 'catch', 'bm-offrhythm'],
  ['bam-sprint-180', 'Full Sprint 180 Shot', 'Shooting', 'catch cond', 3.5, 'hb', 'fatigue', 'catch', 'bm-turn-fire'],
  ['bam-bowl-catch', 'Bowl Catch Jumpers', 'Shooting', 'catch', 3.5, 'hb', 'variable', 'catch', ''],
  ['bam-reach-center', 'Reach And Center Outside Frame', 'Shooting', 'catch form', 4, 'hb', 'balance', 'catch', 'bm-lean-recover'],
  ['bam-toss-balance', 'Toss Back Balance Shooting', 'Shooting', 'form catch', 3, 'hb', 'balance', 'catch', 'bm-hold-landing'],
  ['bam-visualization', 'Visualization Work', 'Shooting', 'form range mid', 5, 'b', 'mental', '', 'bm-see-it'],
  ['bam-2foot-mix', '2 Foot Mix Up', 'Finishing', 'footwork pickups', 3, 'hb', 'reactive', 'layup', 'bm-two-foot-options'],
  ['bam-slow-step', 'Slow Step Tough Finishes', 'Finishing', 'footwork speed', 3, 'hb', 'variable', 'layup', 'bm-tempo-finishes'],
  ['bam-pivot-score', 'Pivot to Score Series', 'Finishing', 'footwork', 5, 'hb', 'variable', 'layup', 'bm-pivot-out'],
  ['bam-3angle-1foot', '3 Angle Explosive 1 Foot Finishes', 'Finishing', 'athletic', 3, 'hb', 'athletic', 'layup', 'bm-one-foot-launch'],
  ['bam-athletic-basics', 'Finishing Athleticism Basics Series', 'Finishing', 'athletic', 5, 'hb', 'athletic', 'layup', 'bm-jump-basics'],
  ['bam-1dribble-dist', '1 Dribble Distance Challenge', 'Finishing', 'speed athletic float', 3, 'hb', 'athletic', 'layup', 'bm-one-dribble-range'],
  ['bam-baseline-jumpback', 'Baseline Jump Back Finishes', 'Finishing', 'footwork touch', 3, 'hb', 'balance', 'layup', 'bm-baseline-escape'],
  ['bam-self-oop', 'Self-Oop Finishing Series', 'Finishing', 'athletic', 5, 'hb', 'athletic', 'layup', 'bm-high-lobs'],
  ['bam-reactive-floaters', 'Cross-Paint Reactive Floaters', 'Finishing', 'float', 3, 'hb', 'reactive', 'float', 'bm-float-call'],
  ['bam-alley-1v1', 'Alley 1-on-1 (Tight Spaces)', 'Finishing', 'speed footwork', 3, 'hpb', 'tight', 'layup', 'bm-lane-1v1'],
  ['bam-crazy-layup', 'Crazy Layup Warmup', 'Finishing', 'warm', 4, 'hb', 'variable', 'layup', 'bm-angle-layups'],
];
BM_BAM.forEach(function (x) { BM_SEED.push([x[0], x[1], x[2], x[3], x[4], x[5], x[6], 'From your BAM Virtual Academy favorites. Follow the coaching video in the BAM app.', '', x[7], x[8]]); });
var BM_DRILLS = BM_SEED.map(function (x) { return { id: 'd-' + x[0], slug: x[0], name: x[1], area: x[2], subs: x[3].split(' '), mins: x[4], hoop: x[5].indexOf('h') >= 0, noHoopOnly: x[5].indexOf('n') >= 0, partner: x[5].indexOf('p') >= 0, bam: x[5].indexOf('b') >= 0, grp: x[10] ? 'd-' + x[10] : 'd-' + x[0], pr: x[6], how: x[7], cue: x[8], shot: x[9] || null }; });
(function () {
  BM_DRILLS.forEach(function (b) {
    if (DRILLS.some(function (d) { return d.id === b.id; })) return;
    var makes = b.area !== 'Ball Handling' || !!b.shot;
    DRILLS.push(DR({ slug: b.slug, name: b.name, cat: b.area, diff: 3, min: Math.ceil(b.mins), sets: 1, att: makes ? Math.round(b.mins * 2.5) : Math.round(b.mins * 60), metric: makes ? 'makes' : 'reps', obj: BM_PRINCIPLES[b.pr][0] + '.', ins: b.how, coach: [b.cue], eq: b.hoop ? ['Ball', 'Hoop'] : ['Ball'], partner: b.partner }));
    if (typeof MODE_MAP === 'object') MODE_MAP[b.id] = b.pr === 'volume' ? ['rhythm'] : b.pr === 'athletic' || b.pr === 'balance' ? ['skill', 'creative'] : ['game', 'skill'];
  });
})();
function bmState() {
  if (!S.bm || typeof S.bm !== 'object') S.bm = { who: 'solo', hoop: true, mins: 60, areas: ['Shooting'], subs: {}, surprise: false, session: null };
  if (!S.bm.subs) S.bm.subs = {}; return S.bm;
}
function bmFree(st, d, used) { if (d.bam && st.bamFav === false) return false; return !used.some(function (id) { var u = bmById(id); return u && (u.id === d.id || u.grp === d.grp); }); }
function bmFavFirst(st, list) { if (st.bamFav === false) return list; return list.filter(function (d) { return d.bam; }).concat(list.filter(function (d) { return !d.bam; })); }
function bmPool(st, area, sub, used) { return bmFavFirst(st, BM_DRILLS.filter(function (d) { return d.area === area && d.subs.indexOf(sub) >= 0 && (st.hoop ? !d.noHoopOnly : !d.hoop) && (st.who === 'partner' || !d.partner) && bmFree(st, d, used); })); }
function bmRand(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function bmBuild(seed) {
  var st = bmState(), rnd = bmRand(seed || Date.now()), areas = st.surprise ? Object.keys(BM_AREAS).sort(function () { return rnd() - 0.5; }).slice(0, 2) : st.areas.slice(0, 3);
  areas = areas.filter(function (a) { return BM_DRILLS.some(function (d) { return d.area === a && (st.hoop ? !d.noHoopOnly : !d.hoop) && (st.who === 'partner' || !d.partner) && d.subs.indexOf('warm') < 0; }); });
  if (!areas.length) areas = ['Ball Handling'];
  var sections = [], used = [];
  if ((st._full || st.mins) >= 45) { var wa = areas.indexOf('Finishing') >= 0 && st.hoop ? 'Finishing' : areas.indexOf('Shooting') >= 0 && st.hoop ? 'Shooting' : 'Ball Handling'; var w = bmPool(st, wa, 'warm', used)[0] || bmPool(st, 'Ball Handling', 'warm', used)[0]; if (w) { sections.push({ key: 'warm', area: wa, name: 'Warm-up', drills: [w.id] }); used.push(w.id); } }
  var picks = [];
  areas.forEach(function (a) { var chosen = (st.subs[a] || []).filter(function (k) { return bmPool(st, a, k, []).length; }); if (!chosen.length) { var all = BM_AREAS[a].subs.map(function (s) { return s[0]; }).filter(function (k) { return bmPool(st, a, k, []).length; }).sort(function () { return rnd() - 0.5; }); chosen = all.slice(0, areas.length > 1 ? 1 : 2); } chosen.forEach(function (k) { picks.push([a, k]); }); });
  var left = st.mins - sum(sections, function (s) { return sum(s.drills, function (id) { return bmById(id).mins; }); });
  picks.forEach(function (p, i) {
    var budget = left / (picks.length - i), sec = { key: p[1], area: p[0], name: BM_AREAS[p[0]].subs.filter(function (s) { return s[0] === p[1]; })[0][1], drills: [] }, t = 0;
    var pool = bmFavFirst(st, bmPool(st, p[0], p[1], used).sort(function () { return rnd() - 0.5; }));
    if (pool.length < 3) pool = pool.concat(BM_DRILLS.filter(function (d) { return d.area === p[0] && (st.hoop ? !d.noHoopOnly : !d.hoop) && (st.who === 'partner' || !d.partner) && bmFree(st, d, used) && pool.indexOf(d) < 0 && d.subs.indexOf('warm') < 0; }).sort(function () { return rnd() - 0.5; }));
    pool.forEach(function (d) { if (bmFree(st, d, used) && (t + d.mins <= budget + 1.5 || !sec.drills.length)) { sec.drills.push(d.id); used.push(d.id); t += d.mins; } });
    /* still short: pull related drills from the same area, then stretch or shrink each timed block to fit */
    if (t < budget * 0.8) BM_DRILLS.filter(function (d) { return d.area === p[0] && (st.hoop ? !d.noHoopOnly : !d.hoop) && (st.who === 'partner' || !d.partner) && bmFree(st, d, used) && d.subs.indexOf('warm') < 0; }).sort(function () { return rnd() - 0.5; }).forEach(function (d) { if (bmFree(st, d, used) && t + d.mins <= budget + 1) { sec.drills.push(d.id); used.push(d.id); t += d.mins; } });
    if (t && Math.abs(t - budget) > 1) { var f = Math.max(0.6, Math.min(2.2, budget / t)); sec.m = {}; sec.drills.forEach(function (id) { sec.m[id] = Math.min(10, Math.max(2, Math.round(bmById(id).mins * f * 2) / 2)); }); t = bmSecMins(sec); }
    left -= t; if (sec.drills.length) sections.push(sec);
  });
  var total = function () { return sum(sections, bmSecMins); };
  /* no hoop and not enough shooting/finishing to fill the time: fill the rest with ball handling */
  if (!st.hoop && total() < st.mins * 0.85 && areas.indexOf('Ball Handling') < 0) {
    var rem = st.mins - total(), fill = { key: 'nohoop', area: 'Ball Handling', name: 'Ball handling (no-hoop fill)', drills: [] }, ft = 0;
    BM_DRILLS.filter(function (d) { return d.area === 'Ball Handling' && !d.hoop && (st.who === 'partner' || !d.partner) && bmFree(st, d, used) && d.subs.indexOf('warm') < 0; }).sort(function () { return rnd() - 0.5; }).forEach(function (d) { if (bmFree(st, d, used) && ft + d.mins <= rem + 1) { fill.drills.push(d.id); used.push(d.id); ft += d.mins; } });
    if (fill.drills.length) sections.push(fill);
  }
  /* final pass: stretch or shrink every timed block evenly so the session lands on your time */
  var warm = sum(sections.filter(function (x) { return x.key === 'warm'; }), bmSecMins), body = total() - warm;
  if (body > 0 && Math.abs(total() - st.mins) > Math.max(2, st.mins * 0.08)) { var f = Math.max(0.6, Math.min(2.5, (st.mins - warm) / body)); sections.forEach(function (x) { if (x.key === 'warm') return; var m = {}; x.drills.forEach(function (id) { m[id] = Math.min(10, Math.max(2, Math.round(bmDur(x, id) * f * 2) / 2)); }); x.m = m; }); }
  return { seed: seed, sections: sections, mins: st.mins, who: st.who, hoop: st.hoop, areas: areas, built: Date.now() };
}
function bmById(id) { return BM_DRILLS.filter(function (d) { return d.id === id; })[0]; }
function bmDur(sec, id) { var d = bmById(id); return sec.m && sec.m[id] ? sec.m[id] : d ? d.mins : 0; }
function bmSecMins(sec) { return Math.round(sum(sec.drills, function (id) { return bmDur(sec, id); }) * 10) / 10; }
function bmTotal(s) { return Math.round(sum(s.sections, bmSecMins)); }
function bmItems(s) {
  var out = []; s.sections.forEach(function (sec) { sec.drills.forEach(function (id) { var d = bmById(id); if (!d) return; var makes = d.area !== 'Ball Handling' || !!d.shot;
    var it = { drillId: d.id, name: d.name, category: d.area, metric: makes ? 'makes' : 'reps', targetSets: 1, targetAttempts: makes ? Math.max(5, Math.round(bmDur(sec, id) * (d.area === 'Finishing' ? 3 : 2.5))) : 1, restSec: 20, timeLimitSec: Math.round(bmDur(sec, id) * 60), layer: bmDur(sec, id) + ' min · ' + bmFmt(d, bmDur(sec, id)) + '. ' + (bmConsText(sec, id) ? 'Harder: ' + bmConsText(sec, id) + '. ' : '') + (d.bam ? ((bmState().notes || {})[d.id] || 'Follow the BAM video.') : d.cue) };
    if (d.shot && makes) it.shotType = d.shot; out.push(it); }); }); return out;
}
function bmName(s) { var a = s.sections.filter(function (x) { return x.key !== 'warm'; }).map(function (x) { return x.name; }); return s.mins + '-Min ' + (a.length ? a.slice(0, 2).join(' + ') : 'Session'); }
/* ---------- views ---------- */
function bmSeg(k, opts, val) { return '<div class="bm-seg">' + opts.map(function (o) { return '<button class="' + (String(val) === String(o[0]) ? 'on' : '') + '" data-a="bm-set" data-k="' + k + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
function viewBuildMe() {
  var st = bmState();
  if (st.session && st.view === 'result') return viewBuildResult(st.session);
  var nSel = st.surprise ? 1 : st.areas.length, summary = [st.mins + ' min', (BM_INT[st.int || 'med'] || BM_INT.med)[0].toLowerCase(), st.who, st.hoop ? 'hoop' : 'no hoop'].concat(st.surprise ? ['Surprise me'] : st.areas.map(function (a) { var s = st.subs[a] || []; return s.length ? s.map(function (k) { return BM_AREAS[a].subs.filter(function (x) { return x[0] === k; })[0][1]; }).join(', ') : a; }));
  return '<div class="bm">' + pageHead('Train', 'Build for me', '') + bmQuickHTML() +
    '<div class="bm-row2"><div><div class="bm-lab">Who</div>' + bmSeg('who', [['solo', 'Solo'], ['partner', 'Partner']], st.who) + '</div><div><div class="bm-lab">Hoop</div>' + bmSeg('hoop', [['1', 'Yes'], ['0', 'No']], st.hoop ? '1' : '0') + '</div></div>' +
    '<div class="bm-lab" style="margin-top:20px">Time</div><div class="bm-time">' + [20, 30, 45, 60, 75, 90].map(function (m) { return '<button class="' + (st.mins === m ? 'on' : '') + '" data-a="bm-set" data-k="mins" data-v="' + m + '">' + m + '<small>min</small></button>'; }).join('') + '</div>' +
    bmIntHTML() + '<div class="bm-lab row" style="margin-top:20px"><span>Work on</span><span class="bm-count"><b>' + nSel + '</b> of 3</span></div><div class="bm-areas">' +
    Object.keys(BM_AREAS).map(function (a) { var on = !st.surprise && st.areas.indexOf(a) >= 0; return '<button class="bm-area' + (on ? ' on' : '') + '" data-a="bm-area" data-v="' + esc(a) + '" aria-pressed="' + on + '">' + ic(BM_AREAS[a].ic, 24) + '<b>' + esc(a === 'Ball Handling' ? 'Ballhandling' : a) + '</b></button>'; }).join('') +
    '<button class="bm-area' + (st.surprise ? ' on' : '') + '" data-a="bm-surprise" aria-pressed="' + !!st.surprise + '">' + ic('sparkles', 24) + '<b>Surprise me</b></button></div>' +
    (st.surprise ? '' : st.areas.map(function (a) { var sel = st.subs[a] || []; return '<div class="bm-lab2">More specific in ' + esc(a === 'Ball Handling' ? 'Ballhandling' : a) + ' <span>(optional)</span></div><div class="bm-subs">' + BM_AREAS[a].subs.map(function (s) { var ok = bmPool(st, a, s[0], []).length > 0; return '<button class="bm-sub' + (sel.indexOf(s[0]) >= 0 ? ' on' : '') + '" data-a="bm-sub" data-ar="' + esc(a) + '" data-v="' + s[0] + '"' + (ok ? '' : ' disabled title="Needs a hoop or partner"') + '>' + esc(s[1]) + '</button>'; }).join('') + '</div>'; }).join('')) +
    '<label class="pg-season bm-favrow"><span><b>Use my BAM favorites</b><small>' + BM_BAM.length + ' drills you picked from BAM. They come first when they fit.</small></span><input type="checkbox" class="pg-switch" data-c="bm-fav" ' + (bmState().bamFav !== false ? 'checked' : '') + ' aria-label="Use my BAM favorites"></label>' +
    '<details class="bm-prin"><summary>' + ic('book-open', 15) + ' How these sessions train</summary><div class="bm-plist">' + Object.keys(BM_PRINCIPLES).map(function (k) { return '<div><b>' + esc(BM_PRINCIPLES[k][0]) + '</b><span>' + esc(BM_PRINCIPLES[k][1]) + '</span></div>'; }).join('') + '</div></details>' +
    '<div class="bm-foot"><div class="tiny">' + esc(summary.join(' · ')) + '</div><button class="btn p bm-go" data-a="bm-build">Build my session</button></div></div>';
}
function viewBuildResult(s) {
  var prins = {}; s.sections.forEach(function (sec) { sec.drills.forEach(function (id) { var d = bmById(id); if (d) prins[d.pr] = 1; }); });
  var dayName = fmtDay(today(), { weekday: 'long' });
  return '<div class="bm">' + '<button class="crumb linkish" data-a="bm-back">' + ic('chevron-left', 14) + ' Change options</button>' + pageHead('Build for me', esc(bmName(s)), '<span class="tag">~' + bmTotal(s) + ' min</span>') +
    '<div class="bm-pchips">' + Object.keys(prins).map(function (k) { return '<span class="bm-pc">' + esc(BM_PRINCIPLES[k][0]) + '</span>'; }).join('') + '</div>' +
    s.sections.map(function (sec, si) { return '<section class="bm-sec"><div class="bm-sh"><span>' + esc(sec.name) + '</span><em>' + bmSecMins(sec) + ' min</em></div>' + sec.drills.map(function (id, di) { var d = bmById(id); if (!d) return ''; var k = si + '-' + di, op = UI.bmOpen === k;
      return '<div class="bm-dr' + (op ? ' open' : '') + '"><div class="bm-dmain"><span class="bm-th" data-area="' + esc(d.area) + '">' + ic(BM_AREAS[d.area].ic, 22) + '</span><button class="bm-dt" data-a="bm-open" data-k="' + k + '" aria-expanded="' + op + '"><b>' + esc(d.name) + (d.bam ? ' <span class="bm-bam">BAM</span>' : '') + '</b><small>' + bmDur(sec, id) + ' min · ' + esc(bmFmt(d, bmDur(sec, id))) + (d.partner ? ' · partner' : '') + '</small></button><button class="bm-ib" data-a="bm-open" data-k="' + k + '" aria-label="Details">' + ic('chevron-right', 16, 'bm-chev') + '</button><button class="bm-ib round hard' + (sec.c && sec.c[id] != null ? ' on' : '') + '" data-a="bm-harder" data-s="' + si + '" data-d="' + di + '" aria-label="Make ' + esc(d.name) + ' harder" title="Make it harder">' + ic('flame', 16) + '</button><button class="bm-ib round" data-a="bm-swap" data-s="' + si + '" data-d="' + di + '" aria-label="Swap ' + esc(d.name) + '">' + ic('repeat', 16) + '</button></div>' +
        bmConsLine(sec, id) + (op ? '<div class="bm-dbody"><p>' + esc(d.how) + '</p>' + (d.cue ? '<p class="bm-cue">' + ic('flame', 13) + ' ' + esc(d.cue) + '</p>' : '') + (d.bam ? '<label class="bm-note"><span class="tiny">My notes (how I do it, what to focus on)</span><textarea data-c="bm-note" data-id="' + d.id + '" rows="2" maxlength="300" placeholder="e.g. 3 spots, catch at the top of the bounce">' + esc((bmState().notes || {})[d.id] || '') + '</textarea></label>' : '') + '<span class="bm-pc">' + esc(BM_PRINCIPLES[d.pr][0]) + '</span></div>' : '') + '</div>'; }).join('') + '</section>'; }).join('') +
    '<div class="bm-foot"><button class="btn p bm-go" data-a="bm-start">' + ic('play', 18) + ' Start now</button><div class="bm-acts"><button class="btn" data-a="bm-today">Add to ' + esc(dayName) + '</button><button class="btn" data-a="bm-fav">' + ic('star', 15) + ' Favorite</button><button class="btn g" data-a="bm-edit">Edit first</button></div><button class="btn sm g" data-a="bm-build" style="margin-top:6px">' + ic('repeat', 14) + ' Build a different one</button></div></div>';
}
/* ---------- actions ---------- */
CHG['bm-fav'] = function (el) { bmState().bamFav = !!el.checked; save(); render(); };
CHG['bm-note'] = function (el) { var st = bmState(); st.notes = st.notes || {}; st.notes[el.dataset.id] = el.value.trim(); save(); toast('Note saved'); };
ACT['bm-set'] = function (el) { var st = bmState(), k = el.dataset.k, v = el.dataset.v; if (k === 'mins') st.mins = +v; else if (k === 'hoop') st.hoop = v === '1'; else st[k] = v; save(); render(); };
ACT['bm-area'] = function (el) { var st = bmState(), a = el.dataset.v, i = st.areas.indexOf(a); st.surprise = false; if (i >= 0) { if (st.areas.length > 1) st.areas.splice(i, 1); } else { if (st.areas.length >= 3) { toast('Up to 3 areas', 'warn'); return; } st.areas.push(a); } save(); render(); };
ACT['bm-surprise'] = function () { var st = bmState(); st.surprise = !st.surprise; save(); render(); };
ACT['bm-sub'] = function (el) { var st = bmState(), a = el.dataset.ar, l = st.subs[a] = st.subs[a] || [], i = l.indexOf(el.dataset.v); if (i >= 0) l.splice(i, 1); else { if (l.length >= 3) { toast('Up to 3 per area', 'warn'); return; } l.push(el.dataset.v); } save(); render(); };
ACT['bm-build'] = function () { var st = bmState(); st.session = bmBuild(Date.now() % 100000 + 1); st.view = 'result'; UI.bmOpen = null; save(); window.scrollTo(0, 0); render(); };
ACT['bm-back'] = function () { bmState().view = 'opts'; save(); render(); };
ACT['bm-open'] = function (el) { UI.bmOpen = UI.bmOpen === el.dataset.k ? null : el.dataset.k; render(); };
ACT['bm-swap'] = function (el) {
  var st = bmState(), s = st.session, sec = s.sections[+el.dataset.s], di = +el.dataset.d, cur = bmById(sec.drills[di]), used = [].concat.apply([], s.sections.map(function (x) { return x.drills; }));
  var pool = sec.key === 'warm' ? bmPool(st, cur.area, 'warm', used) : bmPool(st, sec.area, sec.key, used);
  if (!pool.length) pool = BM_DRILLS.filter(function (d) { return d.area === sec.area && bmFree(st, d, used) && (st.hoop ? !d.noHoopOnly : !d.hoop) && (st.who === 'partner' || !d.partner) && d.subs.indexOf('warm') < 0; });
  if (!pool.length) { toast('No other drill fits here. Try different options.', 'warn'); return; }
  pool.sort(function (a, b) { return Math.abs(a.mins - cur.mins) - Math.abs(b.mins - cur.mins); });
  var nx = pool[Math.floor(Math.random() * Math.min(3, pool.length))], keep = bmDur(sec, cur.id); sec.drills[di] = nx.id; if (sec.m) { delete sec.m[cur.id]; sec.m[nx.id] = keep; } save(); render(); toast('Swapped in ' + nx.name);
};
function bmWorkout(s) { var a = s.areas, wt = a.length === 1 ? ({ Shooting: 'spot-feel', Finishing: 'cla-finish', 'Ball Handling': 'handle' })[a[0]] : 'game'; return { id: 'w-' + uid(), name: bmName(s), category: a[0] || 'Shooting', objective: 'Built for me: ' + s.sections.map(function (x) { return x.name; }).join(', ') + '.', minutes: bmTotal(s), difficulty: 3, warmup: '', notes: '', template: false, custom: true, writer: true, wt: wt, created: Date.now(), items: bmItems(s), bm: JSON.parse(JSON.stringify(s)) }; }
ACT['bm-start'] = function () { var s = bmState().session; if (!s) return; startRun(bmItems(s), bmName(s), null, null); };
ACT['bm-fav'] = function () { var s = bmState().session; if (!s) return; var w = bmWorkout(s); S.workouts.push(w); s.savedId = w.id; save(); toast('Saved to your workouts. It’s in My Week under “Yours”.'); };
ACT['bm-today'] = function () { var s = bmState().session; if (!s) return; var w = s.savedId && S.workouts.find(function (x) { return x.id === s.savedId; }); if (!w) { w = bmWorkout(s); S.workouts.push(w); s.savedId = w.id; } var t = today(), di = Math.round((keyDate(t) - keyDate(weekStart(t))) / 864e5), keep = WK.off; WK.off = 0; var b = wkAdd(di, 'w:' + w.id); WK.off = keep; b.mins = w.minutes; save(); toast('Added to ' + fmtDay(t, { weekday: 'long' }) + ' in My Week and Today'); };
ACT['bm-edit'] = function () {
  var s = bmState().session; if (!s) return; var d = wrNewDraft(bmName(s)); d.wt = bmWorkout(s).wt;
  s.sections.forEach(function (sec) { sec.drills.forEach(function (id) { var x = bmById(id); if (!x) return; d.blocks.push({ id: uid(), kind: 'drill', name: x.name, cat: x.area, metric: 'time', sets: 1, n: 1, goal: 0, mins: Math.round(bmDur(sec, id)), shot: x.shot, zone: null, vars: [], drillId: x.id }); }); });
  wrState().draft = d; save(); location.hash = '#writer-edit'; toast('Change anything, then save it as yours.');
};
/* ---------- wiring ---------- */
(function () {
  bmState();
  var _rv = routeView; routeView = function (r) { if (r === 'build') return viewBuildMe(); return _rv(r); };
  Object.assign(TAB_OF, { build: 'train' });
  var bl = $('.side a[data-r="builder"]'); if (bl) { bl.setAttribute('href', '#build'); bl.dataset.r = 'build'; bl.innerHTML = '<i>' + ic('sparkles', 20) + '</i>Build for me'; }
  var _train = viewTrain; viewTrain = function () { return _train().replace('href="#builder"><span class="bb-ic">', 'href="#build"><span class="bb-ic">').replace('<b>Workout Builder</b>', '<b>Build for me</b>'); };
  var _home = viewHomePro; viewHomePro = function () { return _home().replace('<a class="qt" href="#builder">', '<a class="qt" href="#build">'); };
  render();
})();
