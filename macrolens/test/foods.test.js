import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLocal, FOODS } from '../lib/foods.js';
import { normalizeProduct } from '../lib/openfoodfacts.js';

test('built-in foods have consistent macros (within 20%)', () => {
  for (const f of FOODS) {
    const implied = f.protein * 4 + f.carbs * 4 + f.fat * 9;
    if (f.calories < 20) continue;
    assert.ok(Math.abs(implied - f.calories) / f.calories < 0.2, `${f.name}: ${f.calories} vs ${implied}`);
  }
});

test('searchLocal matches every word', () => {
  assert.ok(searchLocal('chicken breast').some((f) => f.name.startsWith('Chicken breast')));
  assert.equal(searchLocal('zzz').length, 0);
  assert.equal(searchLocal('').length, 0);
});

test('normalizeProduct prefers per-serving values', () => {
  const p = normalizeProduct({ code: '123', brands: 'Acme', product_name: 'Bar', serving_size: '40 g', nutriments: { 'energy-kcal_serving': 190, proteins_serving: 10, carbohydrates_serving: 22, fat_serving: 7, 'energy-kcal_100g': 475 } });
  assert.equal(p.name, 'Acme — Bar');
  assert.equal(p.calories, 190);
  assert.equal(p.serving, '40 g');
  assert.equal(normalizeProduct({ nutriments: {} }), null);
});
