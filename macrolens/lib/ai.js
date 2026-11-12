// AI food recognition: a meal photo (or a typed description) goes to Claude,
// which returns an itemized estimate as schema-validated JSON.

import Anthropic from '@anthropic-ai/sdk';
import { macroCalories } from './nutrition.js';

export const MODEL = process.env.MACROLENS_MODEL || 'claude-opus-5-5';
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Plain food name, e.g. "Grilled chicken breast"' },
    portion: { type: 'string', description: 'Human portion, e.g. "1 cup", "6 oz", "2 slices"' },
    grams: { type: 'number', description: 'Estimated edible weight in grams' },
    calories: { type: 'number' },
    protein: { type: 'number', description: 'grams' },
    carbs: { type: 'number', description: 'grams' },
    fat: { type: 'number', description: 'grams' },
    fiber: { type: 'number', description: 'grams' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['name', 'portion', 'grams', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'confidence'],
  additionalProperties: false,
};

export const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean', description: 'false if the photo shows no food or drink' },
    meal_name: { type: 'string', description: 'Short title for the whole meal' },
    items: { type: 'array', items: ITEM_SCHEMA },
    notes: { type: 'string', description: 'One sentence on assumptions (hidden oil, sauce, portion cues). Empty if none.' },
  },
  required: ['is_food', 'meal_name', 'items', 'notes'],
  additionalProperties: false,
};

const SYSTEM = `You are a registered-dietitian-level food analyst inside a calorie tracking app.
Identify every distinct food and drink, estimate each portion from visual cues (plate ~10-11 in, fork ~7 in, hand, cup, packaging), and give nutrition for the portion shown.
Rules:
- One item per distinct food. Split combos (burger + fries + drink) into separate items.
- Count cooking oil, butter, dressings and sauces you can reasonably infer, folded into the item they're on, and mention it in notes.
- Use USDA-style values. Calories should roughly equal 4*protein + 4*carbs + 9*fat.
- If a label or brand is visible, use that product's real nutrition.
- Be realistic, not optimistic: restaurant portions are usually larger than they look.
- If there is no food, set is_food=false and return an empty items list.`;

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Analyze a meal.
 * input: { imageBase64?, mediaType?, text? }  (at least one of image / text)
 * Returns { meal_name, items, notes, totals }.
 */
export async function analyzeMeal(input, { anthropic = getClient() } = {}) {
  const content = [];
  if (input.imageBase64) {
    if (!ALLOWED_MEDIA.has(input.mediaType)) throw new UserError('Unsupported image type');
    if ((input.imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) throw new UserError('Image is larger than 5 MB');
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: input.mediaType, data: input.imageBase64 },
    });
  }
  const text = String(input.text ?? '').slice(0, 1000).trim();
  if (!input.imageBase64 && !text) throw new UserError('Send a photo or a description');
  content.push({
    type: 'text',
    text: input.imageBase64
      ? `Analyze this meal photo.${text ? ` Extra context from the user: ${text}` : ''}`
      : `Estimate nutrition for this meal the user described: ${text}`,
  });

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: MEAL_SCHEMA },
    },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') throw new UserError('The AI declined to analyze this image');
  if (response.stop_reason === 'max_tokens') throw new Error('AI response was cut off');
  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('AI returned no result');
  return normalizeMeal(JSON.parse(block.text));
}

/** Clamp and sanity-check model output before it reaches the diary. */
export function normalizeMeal(raw) {
  if (!raw.is_food || !Array.isArray(raw.items) || raw.items.length === 0) {
    throw new UserError("Couldn't find any food in that. Try a clearer photo or add a description.");
  }
  const items = raw.items.map((it, i) => {
    const protein = clamp(it.protein, 0, 300);
    const carbs = clamp(it.carbs, 0, 600);
    const fat = clamp(it.fat, 0, 300);
    let calories = clamp(it.calories, 0, 5000);
    // If calories disagree with macros by >25%, trust the macros.
    const implied = macroCalories({ protein, carbs, fat });
    if (implied > 0 && Math.abs(calories - implied) / implied > 0.25) calories = implied;
    return {
      id: `ai-${Date.now()}-${i}`,
      source: 'AI scan',
      name: String(it.name || 'Food').slice(0, 80),
      serving: String(it.portion || `${Math.round(it.grams)} g`).slice(0, 40),
      grams: Math.round(clamp(it.grams, 0, 5000)),
      calories: Math.round(calories),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
      fiber: round1(clamp(it.fiber, 0, 100)),
      confidence: ['low', 'medium', 'high'].includes(it.confidence) ? it.confidence : 'medium',
    };
  });
  const totals = items.reduce(
    (t, it) => ({
      calories: t.calories + it.calories,
      protein: round1(t.protein + it.protein),
      carbs: round1(t.carbs + it.carbs),
      fat: round1(t.fat + it.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    meal_name: String(raw.meal_name || 'Meal').slice(0, 80),
    items,
    notes: String(raw.notes || '').slice(0, 300),
    totals,
  };
}

export class UserError extends Error {
  status = 400;
}

function clamp(x, lo, hi) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
function round1(x) {
  return Math.round(x * 10) / 10;
}
