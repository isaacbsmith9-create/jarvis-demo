import type { DistrictId, IndustryId, RivalStrategy, SubtypeId } from '../../types/core';

/** Fictional competitor companies. Any resemblance to real businesses is coincidental. */
export interface RivalDef {
  id: string;
  name: string;
  industry: IndustryId;
  subtype: SubtypeId;
  owner: string;
  ceo: string;
  strategy: RivalStrategy;
  homeDistrict: DistrictId;
  districts: DistrictId[];
  cash: number; // dollars
  dailyRevenue: number; // dollars
  margin: number;
  employees: number;
  reputation: number;
  description: string;
}

export const RIVAL_DEFS: RivalDef[] = [
  {
    id: 'biscayne', name: 'Biscayne Crest Holdings', industry: 'realestate', subtype: 'brokerage', owner: 'The Whitcombe Family', ceo: 'Harold Whitcombe',
    strategy: 'aggressive', homeDistrict: 'brickell', districts: ['brickell', 'downtown', 'waterfront'], cash: 14000000, dailyRevenue: 38000, margin: 0.22, employees: 64, reputation: 72,
    description: 'Old-money property holding company. Buys aggressively whenever cash allows.',
  },
  {
    id: 'coralgate', name: 'Coralgate Realty Group', industry: 'realestate', subtype: 'brokerage', owner: 'Elena Varga', ceo: 'Elena Varga',
    strategy: 'steady', homeDistrict: 'brickell', districts: ['brickell', 'littlehavana'], cash: 3200000, dailyRevenue: 14000, margin: 0.18, employees: 31, reputation: 64,
    description: 'Mid-sized brokerage with a strong residential sales team.',
  },
  {
    id: 'meridian', name: 'Meridian Hospitality Group', industry: 'hospitality', subtype: 'hotel', owner: 'Meridian Partners LP', ceo: 'Graham Ashby',
    strategy: 'steady', homeDistrict: 'southbeach', districts: ['southbeach', 'downtown'], cash: 9000000, dailyRevenue: 61000, margin: 0.14, employees: 210, reputation: 68,
    description: 'Operates mid-market hotels across the beach and downtown.',
  },
  {
    id: 'atlas', name: 'Aurelia Luxury Resorts', industry: 'hospitality', subtype: 'hotel', owner: 'Castellane Capital', ceo: 'Marguerite Duval',
    strategy: 'premium', homeDistrict: 'waterfront', districts: ['waterfront'], cash: 22000000, dailyRevenue: 88000, margin: 0.19, employees: 340, reputation: 84,
    description: 'Ultra-luxury resort operator. Competes on prestige, not price.',
  },
  {
    id: 'neontide', name: 'Neon Tide Nightlife', industry: 'hospitality', subtype: 'nightclub', owner: 'Dante Moreau', ceo: 'Dante Moreau',
    strategy: 'aggressive', homeDistrict: 'southbeach', districts: ['southbeach', 'wynwood'], cash: 1900000, dailyRevenue: 21000, margin: 0.2, employees: 58, reputation: 70,
    description: 'Flashy nightlife brand. Fast growth, thin cash cushion.',
  },
  {
    id: 'brightwave', name: 'Brightwave Labs', industry: 'technology', subtype: 'saas', owner: 'Venture-backed', ceo: 'Priyanka Rao',
    strategy: 'aggressive', homeDistrict: 'wynwood', districts: ['wynwood'], cash: 6500000, dailyRevenue: 17000, margin: -0.15, employees: 48, reputation: 61,
    description: 'Well-funded SaaS startup burning cash to grow users.',
  },
  {
    id: 'vela', name: 'Vela Digital Studio', industry: 'technology', subtype: 'agency', owner: 'Tomás Vela', ceo: 'Tomás Vela',
    strategy: 'steady', homeDistrict: 'downtown', districts: ['downtown', 'brickell'], cash: 850000, dailyRevenue: 9500, margin: 0.16, employees: 26, reputation: 66,
    description: 'Respected software agency serving banks and hospitality groups.',
  },
  {
    id: 'mercado', name: 'Mercado Fresco Markets', industry: 'retail', subtype: 'convenience', owner: 'The Ibarra Family', ceo: 'Rosa Ibarra',
    strategy: 'conservative', homeDistrict: 'littlehavana', districts: ['littlehavana', 'downtown'], cash: 1200000, dailyRevenue: 11000, margin: 0.06, employees: 44, reputation: 75,
    description: 'Family-owned neighborhood markets with fiercely loyal customers.',
  },
  {
    id: 'tidewater', name: 'Tidewater & Co.', industry: 'retail', subtype: 'boutique', owner: 'Celeste Marlow', ceo: 'Celeste Marlow',
    strategy: 'premium', homeDistrict: 'brickell', districts: ['brickell', 'southbeach', 'waterfront'], cash: 2100000, dailyRevenue: 12500, margin: 0.17, employees: 37, reputation: 71,
    description: 'Upscale apparel boutiques with a loyal high-end clientele.',
  },
  {
    id: 'saborcalle', name: 'Sabor de la Calle Kitchens', industry: 'hospitality', subtype: 'restaurant', owner: 'Rafael Quintana', ceo: 'Rafael Quintana',
    strategy: 'steady', homeDistrict: 'littlehavana', districts: ['littlehavana', 'wynwood', 'downtown'], cash: 640000, dailyRevenue: 8800, margin: 0.09, employees: 52, reputation: 77,
    description: 'Beloved Cuban restaurant group expanding beyond its home neighborhood.',
  },
];
