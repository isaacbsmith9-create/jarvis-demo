// ===================== Team Playbook: data (spots, rules, coverages, starter plays) =====================
// Court feet as in engine.js (hoop at (0, 5.25), y grows away from the basket). Everything here is plain data so the
// offense can grow: plays are lists of steps, rules map a trigger (a pass between two roles, or a called action) to
// movement verbs, and coverages are parameter sets the defense engine reads.

const SPOTS = {
  slotL: [-9, 27.5], slotR: [9, 27.5], wingL: [-20, 17], wingR: [20, 17], cornerL: [-22, 4], cornerR: [22, 4],
  postL: [-7, 8], postR: [7, 8], high: [0, 19], top: [0, 31], elbowL: [-7.5, 19], elbowR: [7.5, 19],
};
const SPOT_ROLE = { slotL: 'slot', slotR: 'slot', wingL: 'wing', wingR: 'wing', cornerL: 'corner', cornerR: 'corner', postL: 'post', postR: 'post', high: 'post', top: 'slot', elbowL: 'post', elbowR: 'post' };
const ROLE_NAMES = { slot: 'Slot', wing: 'Wing', corner: 'Corner', post: 'Post' };
/** Role of a spot on the floor (nearest named spot). */
function roleAt(p) {
  let best = 'wing', bd = 1e9;
  for (const [k, s] of Object.entries(SPOTS)) { const d = dist(p, s); if (d < bd) { bd = d; best = k; } }
  return SPOT_ROLE[best];
}
const spotName = (p) => { let best = 'slotL', bd = 1e9; for (const [k, s] of Object.entries(SPOTS)) { const d = dist(p, s); if (d < bd) { bd = d; best = k; } } return best; };
const SPOT_LABEL = { slotL: 'left slot', slotR: 'right slot', wingL: 'left wing', wingR: 'right wing', cornerL: 'left corner', cornerR: 'right corner', postL: 'left block', postR: 'right block', high: 'high post', top: 'top', elbowL: 'left elbow', elbowR: 'right elbow' };

/** Size class of each offensive slot in the lineup: used to find mismatches after switches (1 = small guard … 5 = big). */
const POS_SIZE = { PG: 1, SG: 2, G: 1.5, SF: 3, F: 3.5, PF: 4, C: 5 };
const POSITIONS_T = { PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward', C: 'Center', G: 'Guard', F: 'Forward' };

// ---------- movement verbs (implemented in team-engine.js) ----------
const VERBS = {
  screenAway: { name: 'Screen away', desc: 'Set a down screen for the teammate on the side away from the ball, then roll or replace.' },
  cutThrough: { name: 'Cut through', desc: 'Basket cut to the rim, then fill out to the open spot on the weak side.' },
  basketCut: { name: 'Basket cut and return', desc: 'Cut to the rim; if not open, return to the same side.' },
  follow: { name: 'Follow for a handoff', desc: 'Follow the pass and take a handoff.' },
  replace: { name: 'Stay / replace', desc: 'Hold the spot and stay spaced.' },
  ballScreen: { name: 'Ball screen', desc: 'Come set a ball screen for the handler, then roll.' },
  backScreen: { name: 'Back screen the roller\'s defender', desc: 'Screen the man guarding the roller, then pop to the three-point line.' },
  postUp: { name: 'Post up', desc: 'Seal your defender on the ball-side block.' },
};
const TRIGGER_ROLES = { slot: 'Slot', wing: 'Wing', corner: 'Corner', post: 'Post', any: 'Anyone' };
const RESP_WHO = { passer: 'Passer', receiver: 'Receiver', post: 'Post player', oppSlot: 'Opposite slot', strongWing: 'Ball-side wing', weakWing: 'Weak-side wing' };

/** The school's starting rules (editable in the Playbook). */
const DEFAULT_RULES = [
  { id: 'r-slot-slot', name: 'Slot to slot: screen away', on: { type: 'pass', from: 'slot', to: 'slot' }, then: [{ who: 'passer', verb: 'screenAway' }], note: 'When the ball goes slot to slot, the passer screens away for the wing on his side, who comes up to the vacated slot.' },
  { id: 'r-slot-wing', name: 'Slot to wing: cut through', on: { type: 'pass', from: 'slot', to: 'wing' }, then: [{ who: 'passer', verb: 'cutThrough' }], note: 'When the slot passes to the wing, the passer basket-cuts and fills out to the weak side. Everyone fills the open spots.' },
  { id: 'r-spain', name: 'Spain pick-and-roll', on: { type: 'call', call: 'spain' }, then: [{ who: 'post', verb: 'ballScreen' }, { who: 'oppSlot', verb: 'backScreen' }], note: 'The big comes to the middle and sets a ball screen; the opposite slot back-screens the big\'s defender and pops.' },
];

// ---------- defensive coverages (parameters for the defense engine) ----------
// ballGap: on-ball distance (ft). deny 0..1: how hard one-pass-away defenders sit in the lane. help 0..1: how far
// two-pass-away defenders sink toward the paint. onBall: ball-screen coverage. offBall: off-ball screen coverage.
const COVERAGES = {
  man: { name: 'Man-to-man', group: 'Man', type: 'man', ballGap: 3.5, deny: 0.35, help: 0.45, onBall: 'over', offBall: 'chase', desc: 'Standard man-to-man: pressure the ball, one pass away in the gap, weak side in help.' },
  pressure: { name: 'Heavy on-ball pressure', group: 'Man', type: 'man', ballGap: 1.8, deny: 0.45, help: 0.4, onBall: 'over', offBall: 'chase', desc: 'Defender crowds the ball handler to stop clean passes and force a dribble.' },
  denial: { name: 'Passing-lane denial', group: 'Man', type: 'man', ballGap: 3, deny: 0.95, help: 0.3, onBall: 'over', offBall: 'topLock', desc: 'Every one-pass-away defender sits in the passing lane with a hand in it. The space behind them is the weakness.' },
  overplay: { name: 'Overplay the perimeter', group: 'Man', type: 'man', ballGap: 2.5, deny: 0.8, help: 0.2, onBall: 'over', offBall: 'topLock', overplay: 1, desc: 'Defenders play high and outside, taking away catches at the three-point line. Back cuts and drives open up.' },
  switch: { name: 'Switch everything', group: 'Man', type: 'man', ballGap: 3.2, deny: 0.4, help: 0.4, onBall: 'switch', offBall: 'switch', desc: 'Every screen is switched. Look for slips and mismatches.' },
  hedge: { name: 'Hedge and recover', group: 'Ball screens', type: 'man', ballGap: 3.2, deny: 0.35, help: 0.45, onBall: 'hedge', offBall: 'chase', desc: 'The screener\'s defender jumps out on ball screens, then recovers.' },
  blitz: { name: 'Blitz / trap', group: 'Ball screens', type: 'man', ballGap: 2.5, deny: 0.4, help: 0.5, onBall: 'blitz', offBall: 'chase', desc: 'Two defenders trap the ball on screens. The rest zone up behind it.' },
  drop: { name: 'Drop coverage', group: 'Ball screens', type: 'man', ballGap: 3.5, deny: 0.3, help: 0.5, onBall: 'drop', offBall: 'chase', desc: 'The big sits back near the paint on ball screens; the guard chases over.' },
  ice: { name: 'Ice', group: 'Ball screens', type: 'man', ballGap: 3, deny: 0.35, help: 0.45, onBall: 'ice', offBall: 'chase', desc: 'Side ball screens are forced away from the middle toward the sideline and the big.' },
  packline: { name: 'Pack-line', group: 'Man', type: 'man', ballGap: 3, deny: 0.05, help: 0.8, onBall: 'under', offBall: 'under', packline: 1, desc: 'Everyone off the ball sits inside an imaginary line about 16 ft from the rim. Drives are crowded; open catches outside are the cost.' },
  zone23: { name: '2-3 zone', group: 'Zone', type: 'zone', shape: '23', ballGap: 4, desc: 'Two guards up top, three across the back. Weak spots: the high post, the short corner, the top gaps.' },
  zone32: { name: '3-2 zone', group: 'Zone', type: 'zone', shape: '32', ballGap: 4, desc: 'Three across the top, two down low. Weak spots: the corners, the short corner, behind the top line.' },
};
const INTENSITY = { 1: 'Low', 2: 'Medium', 3: 'High' };

// ---------- starter plays (templates the user can edit, duplicate or delete) ----------
// steps: each step is a list of actions that happen together: pass {from,to} · dribble {who,to} · cut {who,to}
// · screen {who,for} (screener goes to the screen spot) · move {who,to}. Player ids O1..O5.
const BASE_4OUT = { O1: SPOTS.slotL, O2: SPOTS.slotR, O3: SPOTS.wingL, O4: SPOTS.wingR, O5: SPOTS.postL };
const BASE_ROLES = { O1: { pos: 'PG', resp: 'Left slot. Initiate. Read your defender: pressure means attack or backdoor.' }, O2: { pos: 'SG', resp: 'Right slot. Be ready to receive the slot-to-slot pass and keep spacing.' }, O3: { pos: 'SF', resp: 'Left wing. Read the screen away: curl, pop or backdoor.' }, O4: { pos: 'PF', resp: 'Right wing. Stay wide; cut backdoor when denied.' }, O5: { pos: 'C', resp: 'Post. Seal on the ball side; come to the middle for Spain.' } };
const STARTER_PLAYS = [
  { id: 'p-base-ss', name: 'Base: slot to slot, screen away', cat: 'Base offense', note: 'Ball reversal from slot to slot. The passer screens away for the wing on his side, who comes up to the slot. Read how the defense guards the screen.',
    start: BASE_4OUT, ball: 'O1', roles: BASE_ROLES, steps: [{ label: 'Slot-to-slot pass', actions: [{ type: 'pass', from: 'O1', to: 'O2' }] }, { label: 'Screen away', actions: [{ type: 'screen', who: 'O1', for: 'O3' }, { type: 'cut', who: 'O3', to: SPOTS.slotL }] }] },
  { id: 'p-base-sw', name: 'Base: slot to wing, cut through', cat: 'Base offense', note: 'The slot hits the wing and cuts through to the rim. The opposite players fill the open spots. Backdoor and post-split reads come next.',
    start: BASE_4OUT, ball: 'O1', roles: BASE_ROLES, steps: [{ label: 'Slot-to-wing pass', actions: [{ type: 'pass', from: 'O1', to: 'O3' }] }, { label: 'Cut through & fill', actions: [{ type: 'cut', who: 'O1', to: [-2, 9] }, { type: 'move', who: 'O2', to: SPOTS.slotL }, { type: 'move', who: 'O4', to: SPOTS.slotR }] }] },
  { id: 'p-spain', name: 'Spain pick-and-roll', cat: 'Spain', note: 'The big comes to the middle for a ball screen. The opposite slot back-screens the big\'s defender, then pops. Reads: roller, popper, pull-up, kick.',
    start: { ...BASE_4OUT, O5: [0, 19] }, ball: 'O1', roles: { ...BASE_ROLES, O5: { pos: 'C', resp: 'Come to the middle, set the ball screen, roll hard.' }, O2: { pos: 'SG', resp: 'Back-screen the big\'s defender, then pop to the top.' } },
    steps: [{ label: 'Big to the middle', actions: [{ type: 'move', who: 'O5', to: [-4, 28] }, { type: 'dribble', who: 'O1', to: [-4, 31] }] }, { label: 'Spain screen', actions: [{ type: 'screen', who: 'O5', for: 'O1' }, { type: 'screen', who: 'O2', for: 'O5' }] }] },
];
