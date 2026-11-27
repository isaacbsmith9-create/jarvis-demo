/**
 * Core entity types for BILLIONAIRE.
 * All money values are integer US cents to avoid floating point drift.
 */
export type Money = number;
/** Days since campaign epoch (see utils/date.ts). */
export type Day = number;

export type DistrictId = 'wynwood' | 'downtown' | 'brickell' | 'littlehavana' | 'southbeach' | 'waterfront';
export type IndustryId = 'realestate' | 'technology' | 'hospitality' | 'retail';
export type SubtypeId =
  | 'brokerage'
  | 'agency'
  | 'saas'
  | 'restaurant'
  | 'hotel'
  | 'nightclub'
  | 'foodtruck'
  | 'boutique'
  | 'convenience'
  | 'online';
export type PropertyType = 'office' | 'retail' | 'restaurant' | 'hotel' | 'nightclub' | 'residential' | 'warehouse';

/** Ledger account identifiers: 'player', 'world', `co:<id>`, `rival:<id>`, `org:<id>`. */
export type AccountId = string;

export type TxCategory =
  | 'starting_capital'
  | 'revenue'
  | 'cogs'
  | 'inventory'
  | 'payroll'
  | 'rent'
  | 'rental_income'
  | 'management_fee'
  | 'utilities'
  | 'marketing'
  | 'hosting'
  | 'supplies'
  | 'upkeep'
  | 'property_purchase'
  | 'property_sale'
  | 'renovation'
  | 'closing_costs'
  | 'setup'
  | 'capital_injection'
  | 'dividend'
  | 'loan_proceeds'
  | 'loan_interest'
  | 'loan_principal'
  | 'severance'
  | 'training'
  | 'commission'
  | 'event'
  | 'equipment_sale'
  | 'org_income'
  | 'org_upkeep'
  | 'rival_operations';

export interface Transaction {
  id: number;
  day: Day;
  from: AccountId;
  to: AccountId;
  amount: Money;
  category: TxCategory;
  memo: string;
}

export interface LedgerState {
  nextId: number;
  entries: Transaction[];
  /** Totals by category for entries trimmed out of the rolling window (money is never dropped, only summarized). */
  archived: { count: number; byCategory: Partial<Record<TxCategory, Money>> };
}

export type PropertyUse =
  | { kind: 'vacant' }
  | { kind: 'rented'; occupancy: number }
  | { kind: 'company'; companyId: string };

export interface Lease {
  companyId: string;
  monthlyRent: Money;
  sinceDay: Day;
}

export interface Property {
  id: string;
  name: string;
  district: DistrictId;
  type: PropertyType;
  sqft: number;
  tier: number; // 1..5 build quality
  /** Footprint on the map, in tile coordinates. */
  lot: { x: number; y: number; w: number; h: number };
  /** Base value in cents before district price index. */
  baseValue: Money;
  value: Money;
  /** Market rent, $/sqft/year (dollars, not cents). */
  rentPsf: number;
  owner: AccountId | 'private';
  forSale: Money | null;
  forLease: boolean;
  use: PropertyUse;
  lease: Lease | null;
  purchasedDay: Day | null;
  purchasePrice: Money | null;
}

export type TraitId = 'diligent' | 'charismatic' | 'ambitious' | 'loyal' | 'volatile' | 'creative' | 'meticulous' | 'lazy' | 'mentor';

export interface Employee {
  id: string;
  name: string;
  role: string;
  companyId: string | null;
  salary: Money; // annual, cents
  skill: number; // 0..100
  performance: number; // 0..100
  loyalty: number; // 0..100
  traits: TraitId[];
  hiredDay: Day;
  age: number;
}

export type PriceLevel = 'budget' | 'standard' | 'premium' | 'luxury';

export interface CompanySettings {
  priceLevel: PriceLevel;
  marketingPerDay: Money;
  autoFund: boolean;
  delegated: boolean;
  /** Retail: restock target units. */
  stockTarget: number;
}

export interface TechOps {
  kind: 'technology';
  quality: number;
  users: number;
  version: number;
  devProgress: number;
  utilization: number;
}
export interface HospitalityOps {
  kind: 'hospitality';
  quality: number;
  lastCustomers: number;
  lastCapacity: number;
  lastDemand: number;
  foodTruckDistrict: DistrictId | null;
}
export interface RetailOps {
  kind: 'retail';
  inventory: number;
  unitCost: Money;
  lastCustomers: number;
  lastDemand: number;
  stockouts: number;
}
export interface RealEstateOps {
  kind: 'realestate';
  dealsClosed: number;
  pipeline: number;
  managedUnits: number;
}
export type CompanyOps = TechOps | HospitalityOps | RetailOps | RealEstateOps;

export interface DailyRecord {
  day: Day;
  revenue: Money;
  expenses: Money;
  profit: Money;
  cash: Money;
  customers: number;
}

export interface PeriodStatement {
  /** Month key, e.g. 2027-03 */
  period: string;
  revenue: Money;
  cogs: Money;
  payroll: Money;
  rent: Money;
  marketing: Money;
  operating: Money; // utilities, hosting, supplies, upkeep, commissions
  depreciation: Money;
  profit: Money;
}

export interface Company {
  id: string;
  name: string;
  industry: IndustryId;
  subtype: SubtypeId;
  owner: 'player';
  foundedDay: Day;
  locationId: string | null;
  status: 'operating' | 'distressed' | 'closed';
  ownerOperated: boolean;
  reputation: number; // 0..100
  equipment: Money; // book value, depreciates
  startingCapital: Money;
  settings: CompanySettings;
  ops: CompanyOps;
  history: DailyRecord[];
  statements: PeriodStatement[];
  current: PeriodStatement;
  lifetime: { revenue: Money; expenses: Money };
  employeeIds: string[];
  candidates: Employee[];
  distressDays: number;
}

export type RivalStrategy = 'aggressive' | 'steady' | 'conservative' | 'premium';

export interface Rival {
  id: string;
  name: string;
  industry: IndustryId;
  subtype: SubtypeId;
  owner: string;
  ceo: string;
  strategy: RivalStrategy;
  homeDistrict: DistrictId;
  districts: DistrictId[];
  baseRevenue: Money; // per day
  margin: number;
  momentum: number;
  priceCut: number; // 0..0.3 current discounting
  employees: number;
  reputation: number;
  status: 'active' | 'bankrupt';
  weeksUnprofitable: number;
  weekRevenue: Money;
  weekExpenses: Money;
  monthly: { period: string; revenue: Money; profit: Money }[];
  description: string;
}

export interface DistrictState {
  id: DistrictId;
  demand: number; // multiplier ~1
  priceIndex: number; // property value multiplier ~1
  trend: number; // daily drift
}

export interface EconomyState {
  index: number; // 100 = baseline
  indexHistory: { day: Day; value: number }[];
  interestRate: number; // annual, e.g. 0.065
  consumerConfidence: number; // 0..100
  districts: Record<DistrictId, DistrictState>;
}

export interface Modifier {
  id: string;
  kind: 'demand';
  district: DistrictId | 'all';
  industry: IndustryId | 'all';
  companyId?: string;
  mult: number;
  untilDay: Day;
  label: string;
}

export interface Loan {
  id: string;
  lender: string;
  kind: 'bank' | 'personal' | 'judgment' | 'private';
  principal: Money;
  annualRate: number;
  monthlyPayment: Money;
  originatedDay: Day;
  missedPayments: number;
}

export type NewsCategory = 'business' | 'finance' | 'property' | 'company' | 'competitor' | 'economy' | 'staff' | 'underworld' | 'objective';
export interface NewsItem {
  id: number;
  day: Day;
  category: NewsCategory;
  tone: 'positive' | 'negative' | 'neutral';
  headline: string;
  body: string;
  refs?: { propertyId?: string; companyId?: string; rivalId?: string };
}

export interface OrgMember {
  id: string;
  name: string;
  rank: 'boss' | 'underboss' | 'lieutenant' | 'associate';
  loyalty: number;
  skill: number;
  weeklyCut: Money;
}

export interface Organization {
  id: string;
  name: string;
  controlledBy: 'player' | 'npc';
  leader: string;
  members: OrgMember[];
  influence: number; // 0..100
  heat: number; // 0..100 law-enforcement attention
  territory: DistrictId[];
  posture: 'active' | 'low';
  relations: Record<string, number>;
  frontCompanyIds: string[];
  description: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  affiliation: string;
  relationship: number; // -100..100
  note: string;
  underworld: boolean;
}

export type ObjectiveKind = 'netWorth' | 'cash' | 'companies' | 'properties' | 'monthlyProfit' | 'debtFree' | 'employees' | 'influence';
export interface Objective {
  kind: ObjectiveKind;
  target: number; // money targets in cents
  title: string;
  description: string;
  /** Value of the tracked metric when the campaign started (used for debt payoff progress). */
  startValue: number;
  deadlineDay: Day | null;
  completedDay: Day | null;
  failed: boolean;
}

export interface PlayerState {
  name: string;
  scenarioId: string;
  businessSkill: number;
  reputation: number; // 0..100 public business reputation
  streetCred: number; // 0..100
  netWorthHistory: { day: Day; value: Money }[];
}

export interface GameState {
  schemaVersion: number;
  id: string;
  createdAt: number;
  seed: number;
  rng: number;
  day: Day;
  player: PlayerState;
  balances: Record<AccountId, Money>;
  ledger: LedgerState;
  properties: Record<string, Property>;
  companies: Record<string, Company>;
  employees: Record<string, Employee>;
  rivals: Record<string, Rival>;
  organizations: Record<string, Organization>;
  contacts: Contact[];
  loans: Loan[];
  economy: EconomyState;
  modifiers: Modifier[];
  news: NewsItem[];
  nextNewsId: number;
  objective: Objective;
  counters: { company: number; employee: number; loan: number; modifier: number };
  stats: { daysPlayed: number; propertiesBought: number; companiesFounded: number; hires: number };
}
