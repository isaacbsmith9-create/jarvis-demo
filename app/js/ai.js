// Optional AI, only inside Claude (free, no API key). Everything here is hidden when it's not available.
let sample = null;
export const ai = { ready: false, images: false };
export async function initAI() {
  if (!window.claude?.use) return false;
  try {
    sample = await claude.use('sample');
    ai.ready = !!sample;
    if (ai.ready) { try { ai.images = !!(await sample.limits?.())?.images; } catch { ai.images = true; } }
  } catch { ai.ready = false; }
  return ai.ready;
}
const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v) * 10) / 10) : null);
/** Estimate the foods in a photo and/or description. Returns MacroLens-shaped food items (per serving). */
export async function scanFood({ images = [], text = '', profile = null }) {
  if (!sample) throw { code: 'not_granted' };
  const prompt = `You are a sports dietitian estimating nutrition for a 16-year-old basketball player's food log.
${images.length ? `Look at the photo${images.length > 1 ? 's' : ''}. ` : ''}${text ? `The athlete says: "${text}". ` : ''}
List each separate food or drink you can identify (combine tiny garnishes). For each, estimate the portion actually shown or described, and the nutrition for that whole portion using typical USDA or restaurant values.
${profile ? `Athlete: ${profile.weightLb} lb.` : ''}
Reply with only JSON: {"items":[{"name":"Grilled chicken breast","serving":"about 5 oz","calories":230,"protein":43,"carbs":0,"fat":5,"fiber":0,"sugar":0,"sodium":400,"iron":1,"calcium":15,"confidence":"high|medium|low"}],"note":"one short sentence, e.g. what to double-check"}
If you can't see or identify any food, reply {"items":[],"note":"why"}.`;
  const r = await sample.json(prompt, { images, modelTier: 'default' });
  const items = (Array.isArray(r?.items) ? r.items : []).slice(0, 12).map((x, i) => {
    const f = { id: `ai-${Date.now()}-${i}`, source: 'AI scan', name: String(x.name || 'Food').slice(0, 80), serving: String(x.serving || '1 serving').slice(0, 60),
      calories: Math.round(n(x.calories) || 0), protein: n(x.protein) || 0, carbs: n(x.carbs) || 0, fat: n(x.fat) || 0, confidence: ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : 'medium' };
    for (const k of ['fiber', 'sugar', 'sodium', 'iron', 'calcium']) if (n(x[k]) != null) f[k] = n(x[k]);
    return f;
  });
  return { items, note: String(r?.note || '').slice(0, 200) };
}
export const aiError = (e) => ({ not_granted: 'AI is turned off for this page.', rate_limited: 'AI is busy or you hit a usage limit. Try again in a minute.' }[e?.code] || "Couldn't reach the AI. Try again, or use Search.");
