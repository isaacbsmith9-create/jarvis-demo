// Pure nutrition math, shared by the server, the tests and the browser
// (served as /lib/nutrition.js). No dependencies, no I/O.

export const ACTIVITY = {
  sedentary: { label: 'Sedentary (little exercise)', factor: 1.2 },
  light: { label: 'Light (1-3 workouts/week)', factor: 1.375 },
  moderate: { label: 'Moderate (3-5 workouts/week)', factor: 1.55 },
  very: { label: 'Very active (6-7 workouts/week)', factor: 1.725 },
  athlete: { label: 'Athlete (2-a-days / daily practice + lifting)', factor: 1.9 },
};

// Calorie adjustment per goal. Deliberately moderate: a growing athlete
// should not run big deficits, so "lose" stops at -400.
export const GOALS = {
  lose: { label: 'Lean out (slow cut)', delta: -400 },
  maintain: { label: 'Maintain / perform', delta: 0 },
  gain: { label: 'Build muscle (lean bulk)', delta: 300 },
};

export const MIN_CALORIES = 1600;

export const lbToKg = (lb) => lb * 0.45359237;
export const inToCm = (inch) => inch * 2.54;

/** Mifflin-St Jeor resting metabolic rate (kcal/day). */
export function bmr({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

/**
 * Daily targets from a profile.
 * profile: { sex, age, weightLb, heightIn, activity, goal }
 * Protein ~1 g/lb for lose/gain, 0.9 g/lb to maintain; fat 27% of calories;
 * carbs get the rest (athletes need them for practice).
 */
export function computeTargets(profile) {
  const weightKg = lbToKg(Number(profile.weightLb));
  const heightCm = inToCm(Number(profile.heightIn));
  const age = Number(profile.age);
  if (!(weightKg > 0 && heightCm > 0 && age > 0)) {
    throw new Error('weight, height and age must be positive numbers');
  }
  const act = ACTIVITY[profile.activity] ?? ACTIVITY.moderate;
  const goal = GOALS[profile.goal] ?? GOALS.maintain;

  const rest = bmr({ sex: profile.sex, weightKg, heightCm, age });
  const tdee = rest * act.factor;
  const calories = Math.max(MIN_CALORIES, roundTo(tdee + goal.delta, 10));

  const proteinPerLb = profile.goal === 'maintain' ? 0.9 : 1.0;
  const protein = Math.round(Number(profile.weightLb) * proteinPerLb);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const waterOz = Math.round(Number(profile.weightLb) * 0.5 + (act.factor >= 1.725 ? 24 : 12));

  return {
    bmr: Math.round(rest),
    tdee: Math.round(tdee),
    calories,
    protein,
    carbs,
    fat,
    fiber: Math.round((calories / 1000) * 14),
    waterOz,
  };
}

/** Scale one food's per-serving nutrition by a number of servings. */
export function scale(food, servings = 1) {
  const s = Number(servings) || 0;
  return {
    calories: Math.round((food.calories ?? 0) * s),
    protein: round1((food.protein ?? 0) * s),
    carbs: round1((food.carbs ?? 0) * s),
    fat: round1((food.fat ?? 0) * s),
    fiber: round1((food.fiber ?? 0) * s),
  };
}

/** Sum nutrition over diary entries ({...food, servings}). */
export function totals(entries) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const e of entries) {
    const n = scale(e, e.servings ?? 1);
    for (const k of Object.keys(t)) t[k] += n[k];
  }
  for (const k of Object.keys(t)) t[k] = k === 'calories' ? Math.round(t[k]) : round1(t[k]);
  return t;
}

/** Calories implied by macros (Atwater 4/4/9). */
export const macroCalories = ({ protein = 0, carbs = 0, fat = 0 }) => protein * 4 + carbs * 4 + fat * 9;

/** Logging streak: consecutive days with at least one entry, ending today (or yesterday). */
export function streak(loggedDates, today) {
  const set = new Set(loggedDates);
  let d = new Date(today + 'T12:00:00');
  if (!set.has(isoDate(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(isoDate(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
function roundTo(x, step) {
  return Math.round(x / step) * step;
}
