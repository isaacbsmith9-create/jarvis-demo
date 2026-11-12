import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTargets, totals, scale, streak, MIN_CALORIES } from '../lib/nutrition.js';

const athlete = { sex: 'male', age: 16, weightLb: 155, heightIn: 70, activity: 'very', goal: 'maintain' };

test('targets for a 16yo active male are sane', () => {
  const t = computeTargets(athlete);
  assert.ok(t.calories > 2700 && t.calories < 3300, `calories ${t.calories}`);
  assert.equal(t.protein, Math.round(155 * 0.9));
  const kcalFromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  assert.ok(Math.abs(kcalFromMacros - t.calories) < 20);
});

test('goal shifts calories and never drops below the floor', () => {
  const m = computeTargets(athlete).calories;
  assert.equal(computeTargets({ ...athlete, goal: 'gain' }).calories, m + 300);
  assert.equal(computeTargets({ ...athlete, goal: 'lose' }).calories, m - 400);
  const tiny = computeTargets({ sex: 'female', age: 14, weightLb: 90, heightIn: 58, activity: 'sedentary', goal: 'lose' });
  assert.equal(tiny.calories, MIN_CALORIES);
});

test('rejects bad profiles', () => {
  assert.throws(() => computeTargets({ ...athlete, weightLb: 0 }));
});

test('scale and totals', () => {
  const egg = { calories: 72, protein: 6, carbs: 0.4, fat: 5 };
  assert.deepEqual(scale(egg, 3), { calories: 216, protein: 18, carbs: 1.2, fat: 15, fiber: 0 });
  const t = totals([{ ...egg, servings: 2 }, { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, servings: 1 }]);
  assert.equal(t.calories, 249);
  assert.equal(t.carbs, 27.8);
});

test('streak counts back from today, or yesterday if today is empty', () => {
  assert.equal(streak(['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-12'), 3);
  assert.equal(streak(['2026-11-10', '2026-11-11'], '2026-11-12'), 2);
  assert.equal(streak(['2026-11-09'], '2026-11-12'), 0);
});
