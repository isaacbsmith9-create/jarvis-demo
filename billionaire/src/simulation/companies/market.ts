/**
 * Business-for-sale market. Independent Miami businesses run in the same
 * simulation as yours (owned by "the market": their money comes from and goes
 * to the outside world). After a few weeks of trading they are listed for sale
 * with real financials, so you can judge them before buying.
 */
import { SUBTYPES } from '../../data/companies/industries';
import type { Company, GameState, Money, SubtypeId } from '../../types/core';
import { clamp, dollars, money } from '../../utils/format';
import { chance, pick, randInt, randRange } from '../../utils/rng';
import { addNews } from '../events/news';
import { refreshCandidates } from '../employees/employees';
import { balance, companyAccount, PLAYER, transfer, WORLD } from '../finance/ledger';
import { valueCompany } from '../finance/valuation';
import { fail, ok, type ActionResult } from '../result';
import { closeCompany, foundCompany, playerCompanies, seedEmployees } from './companies';

const MARKET_TARGET = 6;
/** Properties scenarios mention by name stay free for the player. */
const RESERVED = new Set(['lh-07', 'lh-01', 'sb-03', 'dt-06', 'sb-01', 'lh-05', 'wyn-07']);
/** Days of trading before a business is listed (buyers need a track record). */
const SEASONING_DAYS = 21;

const MARKET_TYPES: SubtypeId[] = ['restaurant', 'restaurant', 'convenience', 'boutique', 'nightclub', 'agency', 'brokerage', 'convenience', 'restaurant'];

const NAMES: Record<string, string[]> = {
  restaurant: ['La Palma Cocina', 'Harbor Fish House', 'Mamá Lula’s Kitchen', 'The Copper Pot', 'Brisa Café', 'Calle Verde Diner'],
  convenience: ['Sunny Corner Mart', 'Bodega Estrella', 'Bayside Quick Stop', 'Neighborhood Market 24'],
  boutique: ['Salt & Linen', 'Mar Azul Boutique', 'Golden Hour Apparel', 'Paloma Threads'],
  nightclub: ['Club Marea', 'The Lantern Room', 'Ritmo Social Club'],
  agency: ['Pixel Harbor', 'Southpoint Software', 'Lumen Code Co.'],
  brokerage: ['Palm Key Realty', 'Harborline Properties', 'Casa Real Estate Group'],
};

const SELLER_STORIES = [
  'The founder is retiring after many years and wants it in good hands.',
  'The owners are relocating out of state.',
  'Two partners are splitting up and want a quick sale.',
  'The owner wants to focus on a new venture.',
  'An estate is selling the business after the founder passed away.',
  'The owner is burned out and ready to move on.',
];

const STAFF: Record<string, [string, number][]> = {
  restaurant: [['chef', 1], ['cook', 1], ['server', 2]],
  convenience: [['cashier', 2], ['stock', 1]],
  boutique: [['associate', 2], ['stock', 1]],
  nightclub: [['bartender', 3], ['security', 2], ['promoter', 1]],
  agency: [['dev', 3], ['sales', 1], ['design', 1]],
  brokerage: [['agent', 3], ['pm', 1]],
};

export function marketCompanies(state: GameState): Company[] {
  return Object.values(state.companies).filter((c) => c.owner === 'market' && c.status !== 'closed');
}

export function listedBusinesses(state: GameState): Company[] {
  return marketCompanies(state).filter((c) => c.listing);
}

/** Create one independent business in a vacant, leasable property. */
export function spawnMarketBusiness(state: GameState): Company | null {
  const subtype = pick(state, MARKET_TYPES);
  const sub = SUBTYPES[subtype];
  // Independents lease vacant spaces, but never ones a scenario points the player to,
  // and always leave plenty of lease listings available for the player.
  const freeLeases = Object.values(state.properties).filter((p) => p.forLease && p.use.kind === 'vacant').length;
  const props = Object.values(state.properties).filter(
    (p) =>
      p.owner === 'private' &&
      p.forSale === null &&
      p.use.kind === 'vacant' &&
      sub.propertyTypes.includes(p.type) &&
      p.sqft <= 8000 &&
      !RESERVED.has(p.id) &&
      (!p.forLease || freeLeases > 8),
  );
  if (!props.length) return null;
  const prop = pick(state, props);
  prop.forLease = true;
  const used = new Set(Object.values(state.companies).map((c) => c.name));
  const name = (NAMES[subtype] ?? ['Independent Co.']).find((n) => !used.has(n)) ?? `${pick(state, NAMES[subtype] ?? ['Independent'])} ${randInt(state, 2, 9)}`;
  const capital = dollars(randInt(state, 15, 40) * 1000);
  const res = foundCompany(state, name, { subtype, locationId: prop.id, locationMode: 'lease' }, capital, { owner: 'market', silent: true });
  if (!res.ok || !res.id) return null;
  const c = state.companies[res.id];
  c.foundedDay = state.day - randInt(state, 400, 3000);
  c.reputation = randInt(state, 35, 72);
  c.settings.priceLevel = pick(state, ['budget', 'standard', 'standard', 'premium'] as const);
  for (const [role, n] of STAFF[subtype] ?? []) {
    seedEmployees(
      state,
      c,
      Array.from({ length: n }, () => ({ role, skill: [35, 75] as [number, number] })),
    );
  }
  const b = c.branches[0];
  if (b.ops.kind === 'hospitality') b.ops.quality = clamp(c.reputation + randInt(state, -8, 8), 30, 85);
  if (b.ops.kind === 'technology') b.ops.quality = randInt(state, 45, 70);
  c.candidates = [];
  return c;
}

/** Price a listing from the business's real valuation, plus a seller premium. */
export function askingPriceFor(state: GameState, c: Company, premium: number): Money {
  const v = valueCompany(state, c);
  const base = Math.max(v.book - balance(state, companyAccount(c.id)), 0) + v.goodwill;
  const floor = Math.round(base * 0.5);
  return Math.max(dollars(15000), Math.round(Math.max(base * premium, floor) / 100000) * 100000);
}

/** Weekly: list seasoned businesses, reprice, sell some to other buyers, and spawn new ones. */
export function marketWeekly(state: GameState): void {
  for (const c of marketCompanies(state)) {
    const age = c.history.length;
    if (!c.listing && age >= SEASONING_DAYS) {
      c.listing = { askingPrice: askingPriceFor(state, c, randRange(state, 1.05, 1.3)), listedDay: state.day, seller: c.name, story: pick(state, SELLER_STORIES) };
      addNews(state, 'business', 'neutral', `For sale: ${c.name}`, `An independent ${SUBTYPES[c.subtype].name.toLowerCase()} is on the market, asking ${money(c.listing.askingPrice)}. ${c.listing.story}`, { companyId: c.id });
      continue;
    }
    if (c.listing) {
      const weeks = Math.floor((state.day - c.listing.listedDay) / 7);
      // Sellers grow more flexible the longer a business sits unsold.
      const premium = Math.max(0.9, 1.2 - weeks * 0.02);
      c.listing.askingPrice = askingPriceFor(state, c, premium);
      if (weeks >= 3 && chance(state, 0.05)) {
        closeCompany(state, c.id, false, true);
        addNews(state, 'business', 'neutral', `${c.name} sold to another buyer`, 'The listing has been taken off the market.');
      }
    }
  }
  if (marketCompanies(state).length < MARKET_TARGET && chance(state, 0.35)) spawnMarketBusiness(state);
}

export function seedMarket(state: GameState, n = 4): void {
  for (let i = 0; i < n; i++) spawnMarketBusiness(state);
}

/** Buy a listed business outright. The seller keeps the company's cash; you get everything else. */
export function buyBusiness(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'market' || c.status === 'closed' || !c.listing) return fail('That business is no longer for sale.');
  const price = c.listing.askingPrice;
  if (balance(state, PLAYER) < price) return fail(`You need ${money(price)} to buy ${c.name}.`);
  const acct = companyAccount(c.id);
  // Seller withdraws the cash in the business, then the sale completes.
  transfer(state, acct, WORLD, Math.max(0, balance(state, acct)), 'dividend', 'Seller withdraws company cash');
  transfer(state, PLAYER, WORLD, price, 'business_purchase', `Purchase of ${c.name}`);
  c.owner = 'player';
  c.listing = null;
  c.settings.autoFund = true;
  c.startingCapital = price;
  c.ownerOperated = !playerCompanies(state).some((o) => o.id !== c.id && o.ownerOperated);
  refreshCandidates(state, c);
  state.stats.companiesFounded++;
  addNews(state, 'company', 'positive', `${state.player.name} acquires ${c.name}`, `The independent ${SUBTYPES[c.subtype].name.toLowerCase()} changed hands for ${money(price)}. Its staff and location stay on.`, { companyId: c.id });
  return ok(`You now own ${c.name}. Add working capital so it can cover payroll.`, c.id);
}
