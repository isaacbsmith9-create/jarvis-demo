import type { IndustryId, PriceLevel, PropertyType, SubtypeId } from '../../types/core';

export interface RoleDef {
  id: string;
  title: string;
  baseSalary: number; // annual dollars
  /** Manager roles enable delegation and boost team performance. */
  manager?: boolean;
  description: string;
}

export interface SubtypeDef {
  id: SubtypeId;
  industry: IndustryId;
  name: string;
  description: string;
  /** Property types this business can operate from. */
  propertyTypes: PropertyType[];
  /** Can run without a physical location (home-based / mobile). */
  locationOptional: boolean;
  /** Must run without a property (e.g. food truck). */
  mobile?: boolean;
  /** Fixed setup cost in dollars. */
  setupBase: number;
  /** Setup cost when run from home (no property), if allowed. */
  homeSetup?: number;
  /** Additional setup cost per sqft of location. */
  setupPerSqft: number;
  roles: RoleDef[];
  primaryRole: string;
  /** Short operating model summary for the UI. */
  model: string;
}

export interface IndustryDef {
  id: IndustryId;
  name: string;
  description: string;
  /** Valuation multiple on annualized profit. */
  earningsMultiple: number;
  revenueMultiple: number;
  color: string;
}

export const INDUSTRIES: Record<IndustryId, IndustryDef> = {
  realestate: {
    id: 'realestate',
    name: 'Real Estate',
    description: 'Brokerage commissions, property management and direct property acquisition.',
    earningsMultiple: 6,
    revenueMultiple: 1.4,
    color: '#b89b5e',
  },
  technology: {
    id: 'technology',
    name: 'Technology',
    description: 'Software products and client development services. High salaries, scalable revenue.',
    earningsMultiple: 7,
    revenueMultiple: 3.2,
    color: '#6f9cc2',
  },
  hospitality: {
    id: 'hospitality',
    name: 'Hospitality',
    description: 'Restaurants, hotels, nightlife and food trucks. Demand swings by day, season and district.',
    earningsMultiple: 3.5,
    revenueMultiple: 0.8,
    color: '#c97b63',
  },
  retail: {
    id: 'retail',
    name: 'Retail',
    description: 'Stores and e-commerce. Inventory, supplier costs, markups and location traffic.',
    earningsMultiple: 3.5,
    revenueMultiple: 0.7,
    color: '#8fb07a',
  },
};

const GM: RoleDef = { id: 'gm', title: 'General Manager', baseSalary: 76000, manager: true, description: 'Runs daily operations, lifts team performance, enables delegation.' };

export const SUBTYPES: Record<SubtypeId, SubtypeDef> = {
  brokerage: {
    id: 'brokerage',
    industry: 'realestate',
    name: 'Real Estate Brokerage',
    description: 'Agents close property deals for commission. Property managers run rental portfolios for a fee and raise occupancy.',
    propertyTypes: ['office', 'retail'],
    locationOptional: true,
    setupBase: 8000,
    homeSetup: 350,
    setupPerSqft: 6,
    primaryRole: 'agent',
    model: 'Lumpy commission revenue from closed deals + 8% fee on managed rentals',
    roles: [
      { id: 'agent', title: 'Real Estate Agent', baseSalary: 46000, description: 'Generates and closes deals. Earns 40% commission split on top of base.' },
      { id: 'pm', title: 'Property Manager', baseSalary: 58000, description: 'Manages rental units. Raises occupancy and rents across your portfolio.' },
      { id: 'office', title: 'Office Manager', baseSalary: 50000, manager: true, description: 'Keeps the brokerage running. Enables delegation.' },
    ],
  },
  agency: {
    id: 'agency',
    industry: 'technology',
    name: 'Software Agency',
    description: 'Build software for clients. Revenue = billable hours × rate. Sales staff bring in clients; developers deliver.',
    propertyTypes: ['office', 'warehouse'],
    locationOptional: true,
    setupBase: 5000,
    homeSetup: 400,
    setupPerSqft: 8,
    primaryRole: 'dev',
    model: 'Billable hours × hourly rate, capped by client demand',
    roles: [
      { id: 'dev', title: 'Software Developer', baseSalary: 98000, description: 'Billable delivery capacity.' },
      { id: 'design', title: 'Product Designer', baseSalary: 80000, description: 'Raises project quality and client reputation.' },
      { id: 'sales', title: 'Account Executive', baseSalary: 72000, description: 'Wins new clients, raising demand.' },
      { id: 'pmgr', title: 'Engineering Manager', baseSalary: 125000, manager: true, description: 'Improves utilization; enables delegation.' },
    ],
  },
  saas: {
    id: 'saas',
    industry: 'technology',
    name: 'SaaS Product',
    description: 'Build a subscription product. Engineers raise quality, marketing acquires users, support reduces churn. Slow start, scalable.',
    propertyTypes: ['office', 'warehouse'],
    locationOptional: true,
    setupBase: 12000,
    homeSetup: 1500,
    setupPerSqft: 8,
    primaryRole: 'eng',
    model: 'Monthly subscribers × price, minus hosting and churn',
    roles: [
      { id: 'eng', title: 'Software Engineer', baseSalary: 122000, description: 'Ships features. Raises product quality.' },
      { id: 'growth', title: 'Growth Marketer', baseSalary: 86000, description: 'Lowers user acquisition cost, raises organic growth.' },
      { id: 'support', title: 'Support Specialist', baseSalary: 48000, description: 'Reduces churn.' },
      { id: 'cto', title: 'Head of Engineering', baseSalary: 165000, manager: true, description: 'Multiplies engineering output; enables delegation.' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    industry: 'hospitality',
    name: 'Restaurant',
    description: 'Seats, cooks and servers limit covers; district traffic, reputation and price set demand. Food costs ~31% of revenue.',
    propertyTypes: ['restaurant', 'retail'],
    locationOptional: false,
    setupBase: 25000,
    setupPerSqft: 45,
    primaryRole: 'chef',
    model: 'Covers × average ticket, minus food costs. Weekend peaks.',
    roles: [
      { id: 'chef', title: 'Head Chef', baseSalary: 64000, description: 'Food quality and kitchen capacity.' },
      { id: 'cook', title: 'Line Cook', baseSalary: 37000, description: 'Kitchen capacity.' },
      { id: 'server', title: 'Server', baseSalary: 30000, description: 'Service capacity and guest experience.' },
      GM,
    ],
  },
  hotel: {
    id: 'hotel',
    industry: 'hospitality',
    name: 'Hotel',
    description: 'Rooms sold × nightly rate. Tourism and season drive occupancy. Housekeeping limits sellable rooms.',
    propertyTypes: ['hotel'],
    locationOptional: false,
    setupBase: 150000,
    setupPerSqft: 38,
    primaryRole: 'desk',
    model: 'Occupied rooms × ADR + food & beverage',
    roles: [
      { id: 'desk', title: 'Front Desk Agent', baseSalary: 35000, description: 'Check-ins and guest experience.' },
      { id: 'housekeeper', title: 'Housekeeper', baseSalary: 31000, description: 'Each services ~14 rooms per day.' },
      { id: 'concierge', title: 'Concierge', baseSalary: 42000, description: 'Raises reputation and premium pricing power.' },
      GM,
    ],
  },
  nightclub: {
    id: 'nightclub',
    industry: 'hospitality',
    name: 'Nightclub',
    description: 'Open Thursday–Sunday. Cover charges and bar sales. Security limits safe capacity; promoters drive hype.',
    propertyTypes: ['nightclub', 'warehouse'],
    locationOptional: false,
    setupBase: 60000,
    setupPerSqft: 55,
    primaryRole: 'bartender',
    model: 'Guests × (cover + bar spend). Four nights a week.',
    roles: [
      { id: 'bartender', title: 'Bartender', baseSalary: 34000, description: 'Bar throughput and spend per guest.' },
      { id: 'security', title: 'Security', baseSalary: 39000, description: 'One per ~80 guests of safe capacity.' },
      { id: 'promoter', title: 'Promoter', baseSalary: 44000, description: 'Builds hype and demand.' },
      GM,
    ],
  },
  foodtruck: {
    id: 'foodtruck',
    industry: 'hospitality',
    name: 'Food Truck',
    description: 'Low-cost mobile kitchen. Parks each day in the district with the best demand. No property needed.',
    propertyTypes: [],
    locationOptional: true,
    mobile: true,
    setupBase: 22000,
    setupPerSqft: 0,
    primaryRole: 'cook',
    model: 'Up to ~180 orders/day × small ticket. Moves to the best district.',
    roles: [
      { id: 'cook', title: 'Cook', baseSalary: 35000, description: 'Orders per day.' },
      { id: 'cashier', title: 'Cashier', baseSalary: 29000, description: 'Speeds service.' },
    ],
  },
  boutique: {
    id: 'boutique',
    industry: 'retail',
    name: 'Boutique Store',
    description: 'Apparel and accessories. High markups, fewer customers. Inventory must be restocked from suppliers.',
    propertyTypes: ['retail'],
    locationOptional: false,
    setupBase: 18000,
    setupPerSqft: 20,
    primaryRole: 'associate',
    model: 'Units sold × (unit cost × markup). Inventory-limited.',
    roles: [
      { id: 'associate', title: 'Sales Associate', baseSalary: 32000, description: 'Serves ~70 shoppers/day.' },
      { id: 'stock', title: 'Stock Clerk', baseSalary: 30000, description: 'Cheaper restocking, less shrinkage.' },
      { id: 'storemgr', title: 'Store Manager', baseSalary: 60000, manager: true, description: 'Enables delegation.' },
    ],
  },
  convenience: {
    id: 'convenience',
    industry: 'retail',
    name: 'Convenience Store',
    description: 'High-volume, low-margin essentials. Thrives on foot traffic.',
    propertyTypes: ['retail'],
    locationOptional: false,
    setupBase: 8000,
    setupPerSqft: 8,
    primaryRole: 'cashier',
    model: 'Many small baskets at low markups. Steady daily demand.',
    roles: [
      { id: 'cashier', title: 'Cashier', baseSalary: 29000, description: 'Serves ~160 customers/day.' },
      { id: 'stock', title: 'Stock Clerk', baseSalary: 30000, description: 'Cheaper restocking, less shrinkage.' },
      { id: 'storemgr', title: 'Store Manager', baseSalary: 56000, manager: true, description: 'Enables delegation.' },
    ],
  },
  online: {
    id: 'online',
    industry: 'retail',
    name: 'Online Store',
    description: 'E-commerce shipped nationwide. Demand comes almost entirely from marketing spend; shipping on every order.',
    propertyTypes: ['warehouse', 'office'],
    locationOptional: true,
    setupBase: 2500,
    homeSetup: 500,
    setupPerSqft: 6,
    primaryRole: 'fulfill',
    model: 'Marketing-driven orders × basket, minus shipping. Not tied to foot traffic.',
    roles: [
      { id: 'fulfill', title: 'Fulfillment Associate', baseSalary: 33000, description: 'Packs ~90 orders/day.' },
      { id: 'growth', title: 'Growth Marketer', baseSalary: 82000, description: 'Lowers acquisition cost.' },
      { id: 'support', title: 'Customer Support', baseSalary: 40000, description: 'Fewer returns, better reviews.' },
    ],
  },
};

export const SUBTYPES_BY_INDUSTRY: Record<IndustryId, SubtypeId[]> = {
  realestate: ['brokerage'],
  technology: ['agency', 'saas'],
  hospitality: ['restaurant', 'hotel', 'nightclub', 'foodtruck'],
  retail: ['boutique', 'convenience', 'online'],
};

export const PRICE_LEVELS: Record<PriceLevel, { label: string; mult: number; demand: number; quality: number }> = {
  budget: { label: 'Budget', mult: 0.78, demand: 1.22, quality: -4 },
  standard: { label: 'Standard', mult: 1.0, demand: 1.0, quality: 0 },
  premium: { label: 'Premium', mult: 1.3, demand: 0.78, quality: 3 },
  luxury: { label: 'Luxury', mult: 1.75, demand: 0.52, quality: 6 },
};

/** Retail merchandise economics (dollars). */
export const RETAIL_ECON: Record<'boutique' | 'convenience' | 'online', { unitCost: number; markup: number; unitsPerCustomer: number; baseCustomers: number; conversion: number }> = {
  boutique: { unitCost: 28, markup: 2.4, unitsPerCustomer: 1.6, baseCustomers: 90, conversion: 0.2 },
  convenience: { unitCost: 3.2, markup: 1.36, unitsPerCustomer: 2.2, baseCustomers: 210, conversion: 0.8 },
  online: { unitCost: 16, markup: 2.1, unitsPerCustomer: 1.8, baseCustomers: 0, conversion: 1 },
};

export function roleDef(subtype: SubtypeId, roleId: string): RoleDef | undefined {
  return SUBTYPES[subtype].roles.find((r) => r.id === roleId);
}
