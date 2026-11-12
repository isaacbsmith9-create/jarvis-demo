import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMeal, normalizeMeal, UserError } from '../lib/ai.js';

const item = (o = {}) => ({ name: 'Rice', portion: '1 cup', grams: 158, calories: 205, protein: 4, carbs: 45, fat: 0.4, fiber: 0.6, confidence: 'high', ...o });

test('normalizeMeal totals items and keeps consistent calories', () => {
  const m = normalizeMeal({ is_food: true, meal_name: 'Bowl', notes: '', items: [item(), item({ name: 'Chicken', calories: 187, protein: 35, carbs: 0, fat: 4 })] });
  assert.equal(m.items.length, 2);
  assert.equal(m.totals.calories, 392);
  assert.equal(m.items[0].serving, '1 cup');
});

test('normalizeMeal trusts macros when calories are way off', () => {
  const m = normalizeMeal({ is_food: true, meal_name: 'x', notes: '', items: [item({ calories: 900 })] });
  assert.equal(m.items[0].calories, Math.round(4 * 4 + 45 * 4 + 0.4 * 9));
});

test('normalizeMeal rejects non-food', () => {
  assert.throws(() => normalizeMeal({ is_food: false, meal_name: '', notes: '', items: [] }), UserError);
});

test('analyzeMeal sends image + schema and parses the JSON reply', async () => {
  let sent;
  const fake = {
    beta: {
      messages: {
        create: async (req) => {
          sent = req;
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ is_food: true, meal_name: 'Rice', notes: '', items: [item()] }) }] };
        },
      },
    },
  };
  const out = await analyzeMeal({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg', text: 'ate half' }, { anthropic: fake });
  assert.equal(out.items[0].name, 'Rice');
  assert.equal(sent.messages[0].content[0].type, 'image');
  assert.match(sent.messages[0].content[1].text, /ate half/);
  assert.equal(sent.output_config.format.type, 'json_schema');
});

test('analyzeMeal validates input', async () => {
  await assert.rejects(analyzeMeal({}, { anthropic: {} }), UserError);
  await assert.rejects(analyzeMeal({ imageBase64: 'x', mediaType: 'image/bmp' }, { anthropic: {} }), UserError);
});

test('analyzeMeal surfaces refusals as user errors', async () => {
  const fake = { beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } };
  await assert.rejects(analyzeMeal({ text: 'pizza' }, { anthropic: fake }), UserError);
});
