// Open Food Facts lookups (free, no key) for barcodes and branded foods.
// https://world.openfoodfacts.org — results are normalized to our food shape.

const BASE = 'https://world.openfoodfacts.org';
const UA = 'MacroLens/1.0 (personal nutrition tracker)';

/** Turn an OFF product into our per-serving food, or null if it lacks calories. */
export function normalizeProduct(p) {
  if (!p) return null;
  const n = p.nutriments ?? {};
  const hasServing = n['energy-kcal_serving'] != null;
  const pick = (key) => {
    const v = hasServing ? n[`${key}_serving`] : n[`${key}_100g`];
    return v == null ? 0 : Number(v);
  };
  const kcal = hasServing ? n['energy-kcal_serving'] : n['energy-kcal_100g'];
  if (kcal == null || Number.isNaN(Number(kcal))) return null;

  const name = [p.brands?.split(',')[0]?.trim(), p.product_name || p.generic_name]
    .filter(Boolean)
    .join(' — ');
  return {
    id: `off-${p.code ?? p._id}`,
    source: 'Open Food Facts',
    barcode: p.code ?? null,
    name: name || 'Unnamed product',
    serving: hasServing ? p.serving_size || '1 serving' : '100 g',
    calories: Math.round(Number(kcal)),
    protein: round1(pick('proteins')),
    carbs: round1(pick('carbohydrates')),
    fat: round1(pick('fat')),
    fiber: round1(pick('fiber')),
  };
}

export async function lookupBarcode(code, fetchImpl = fetch) {
  if (!/^\d{6,14}$/.test(String(code))) throw new Error('Barcode must be 6-14 digits');
  const res = await fetchImpl(`${BASE}/api/v2/product/${code}.json`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const body = await res.json();
  return body.status === 1 ? normalizeProduct(body.product) : null;
}

export async function searchProducts(query, fetchImpl = fetch) {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,generic_name,brands,serving_size,nutriments`;
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const body = await res.json();
  return (body.products ?? []).map(normalizeProduct).filter(Boolean);
}

function round1(x) {
  return Math.round((Number(x) || 0) * 10) / 10;
}
