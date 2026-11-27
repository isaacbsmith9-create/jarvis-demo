import type { DistrictId, ObjectiveKind, SubtypeId } from '../../types/core';

export interface ScenarioCompany {
  name: string;
  subtype: SubtypeId;
  /** Property id to operate from (owned or leased per `owned`). Null = home-based / mobile. */
  propertyId: string | null;
  ownedProperty: boolean;
  cash: number; // dollars
  employees: { role: string; skill: [number, number] }[];
  reputation: number;
  ownerOperated?: boolean;
}

export interface ScenarioLoan {
  lender: string;
  kind: 'bank' | 'personal' | 'judgment' | 'private';
  principal: number; // dollars
  annualRate: number;
  monthlyPayment: number; // dollars
}

export interface ScenarioContact {
  name: string;
  title: string;
  affiliation: string;
  relationship: number;
  note: string;
  underworld?: boolean;
}

export interface ScenarioOrg {
  name: string;
  treasury: number; // dollars
  influence: number;
  heat: number;
  territory: DistrictId[];
  members: { name: string; rank: 'underboss' | 'lieutenant' | 'associate'; weeklyCut: number }[];
  description: string;
}

export interface ScenarioDef {
  id: string;
  title: string;
  track: 'legitimate' | 'underground';
  difficulty: 1 | 2 | 3 | 4 | 5;
  summary: string;
  story: string;
  cash: number; // dollars
  businessSkill: number;
  reputation: number;
  streetCred: number;
  properties: { id: string; use: 'vacant' | 'rented' }[];
  companies: ScenarioCompany[];
  loans: ScenarioLoan[];
  contacts: ScenarioContact[];
  organization?: ScenarioOrg;
  advantages: string[];
  disadvantages: string[];
  objective: { kind: ObjectiveKind; target: number; title: string; description: string; days: number | null };
  /** Systems that are only partly available in Alpha 0.1 for this background. */
  futureNotes?: string[];
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'nobody',
    title: 'The Nobody',
    track: 'legitimate',
    difficulty: 5,
    summary: '$500, a laptop and nothing to lose.',
    story: 'No savings, no connections, no safety net. You have a laptop, some coding skill, and the conviction that you will not stay small for long.',
    cash: 500,
    businessSkill: 42,
    reputation: 5,
    streetCred: 5,
    properties: [],
    companies: [],
    loans: [],
    contacts: [
      { name: 'Marisol Reyes', title: 'Former classmate', affiliation: 'Freelance designer', relationship: 35, note: 'Might work for you once you can pay.' },
    ],
    advantages: ['Lowest overhead in the game', 'Can freelance from home as an owner-operator', 'Nothing to lose'],
    disadvantages: ['$500 is not enough for any property', 'No credit line', 'No reputation'],
    objective: { kind: 'netWorth', target: 100000, title: 'First $100K', description: 'Reach a net worth of $100,000.', days: 365 },
  },
  {
    id: 'entrepreneur',
    title: 'The Entrepreneur',
    track: 'legitimate',
    difficulty: 4,
    summary: '$25K in savings and a business idea.',
    story: 'You saved for years and quit your job. $25,000 and a promising lease opportunity on a small Little Havana storefront. Time to find out if you have what it takes.',
    cash: 25000,
    businessSkill: 50,
    reputation: 15,
    streetCred: 5,
    properties: [],
    companies: [],
    loans: [],
    contacts: [
      { name: 'Hector Ibarra', title: 'Landlord', affiliation: 'Eighth Street Shop 22', relationship: 20, note: 'Willing to lease his storefront to a newcomer.' },
      { name: 'Grace Okafor', title: 'Small business mentor', affiliation: 'Miami Founders Circle', relationship: 30, note: 'Gives honest advice.' },
    ],
    advantages: ['Enough capital for a food truck, online store or small lease', 'Decent business instincts'],
    disadvantages: ['One bad decision can wipe you out', 'No employees yet'],
    objective: { kind: 'monthlyProfit', target: 10000, title: 'Profitable Business', description: 'Earn $10,000 of company profit in a single month.', days: 365 },
  },
  {
    id: 'owner',
    title: 'The Business Owner',
    track: 'legitimate',
    difficulty: 3,
    summary: '$100K and a small café that already works.',
    story: 'You own Corner Cafecito House, a modest but steady Little Havana café, and the building it sits in. Time to grow beyond one location.',
    cash: 100000,
    businessSkill: 55,
    reputation: 30,
    streetCred: 10,
    properties: [{ id: 'lh-01', use: 'vacant' }],
    companies: [
      {
        name: 'Cafecito House',
        subtype: 'restaurant',
        propertyId: 'lh-01',
        ownedProperty: true,
        cash: 18000,
        reputation: 58,
        employees: [
          { role: 'chef', skill: [52, 62] },
          { role: 'cook', skill: [40, 52] },
          { role: 'server', skill: [45, 58] },
          { role: 'server', skill: [38, 50] },
        ],
      },
    ],
    loans: [{ lender: 'Seacoast Community Bank', kind: 'bank', principal: 120000, annualRate: 0.074, monthlyPayment: 2400 }],
    contacts: [
      { name: 'Rafael Quintana', title: 'Restaurateur', affiliation: 'Sabor de la Calle Kitchens', relationship: -5, note: 'Your biggest neighborhood competitor.' },
      { name: 'Linda Navarro', title: 'Loan officer', affiliation: 'Seacoast Community Bank', relationship: 25, note: 'Holds your mortgage.' },
    ],
    advantages: ['Owns a profitable restaurant and its building', 'Trained staff', 'Established local reputation'],
    disadvantages: ['Mortgage debt', 'Strong local competitor'],
    objective: { kind: 'companies', target: 3, title: 'Three Businesses', description: 'Operate three companies at the same time.', days: 540 },
  },
  {
    id: 'inheritor',
    title: 'The Inheritor',
    track: 'legitimate',
    difficulty: 3,
    summary: '$2M and a family hotel that is quietly failing.',
    story: 'Your grandfather left you The Flamingo Deco Hotel and its operating company. It is overstaffed, poorly priced and carrying debt. The family is watching.',
    cash: 2000000,
    businessSkill: 40,
    reputation: 45,
    streetCred: 5,
    properties: [{ id: 'sb-01', use: 'vacant' }],
    companies: [
      {
        name: 'Flamingo Deco Hospitality',
        subtype: 'hotel',
        propertyId: 'sb-01',
        ownedProperty: true,
        cash: 60000,
        reputation: 41,
        employees: [
          { role: 'gm', skill: [30, 42] },
          { role: 'desk', skill: [35, 50] },
          { role: 'desk', skill: [30, 45] },
          { role: 'desk', skill: [25, 40] },
          { role: 'housekeeper', skill: [35, 50] },
          { role: 'housekeeper', skill: [35, 50] },
          { role: 'housekeeper', skill: [30, 45] },
          { role: 'concierge', skill: [20, 35] },
          { role: 'concierge', skill: [20, 35] },
        ],
      },
    ],
    loans: [{ lender: 'Atlantic Trust Bank', kind: 'bank', principal: 6500000, annualRate: 0.068, monthlyPayment: 62000 }],
    contacts: [
      { name: 'Aunt Celia Marchetti', title: 'Family shareholder', affiliation: 'Family', relationship: 10, note: 'Expects the hotel to stay in the family.' },
      { name: 'Graham Ashby', title: 'CEO', affiliation: 'Meridian Hospitality Group', relationship: 0, note: 'Would happily buy the hotel cheap.' },
    ],
    advantages: ['Large cash reserve', 'Iconic South Beach hotel asset', 'Family name opens doors'],
    disadvantages: ['$6.5M mortgage', 'Weak, unmotivated staff', 'Poor reputation and pricing'],
    objective: { kind: 'netWorth', target: 40000000, title: 'Restore the Family Fortune', description: 'Grow net worth to $40M.', days: 730 },
  },
  {
    id: 'investor',
    title: 'The Investor',
    track: 'legitimate',
    difficulty: 2,
    summary: '$5M, a sharp eye and a strong network.',
    story: 'A decade of successful deals has left you with $5M in liquid capital and relationships across the city. Miami is your next portfolio.',
    cash: 5000000,
    businessSkill: 65,
    reputation: 60,
    streetCred: 10,
    properties: [{ id: 'wyn-07', use: 'rented' }],
    companies: [],
    loans: [],
    contacts: [
      { name: 'Harold Whitcombe', title: 'Chairman', affiliation: 'Biscayne Crest Holdings', relationship: 15, note: 'Fellow investor and frequent bidding rival.' },
      { name: 'Elena Varga', title: 'Founder', affiliation: 'Coralgate Realty Group', relationship: 30, note: 'Brings you off-market deals.' },
      { name: 'Priyanka Rao', title: 'CEO', affiliation: 'Brightwave Labs', relationship: 20, note: 'Startup founder looking for capital.' },
    ],
    advantages: ['Large capital base', 'Owns a rented apartment building', 'High reputation unlocks bank credit'],
    disadvantages: ['No operating companies', 'Aggressive rival investors'],
    objective: { kind: 'netWorth', target: 25000000, title: 'Portfolio Builder', description: 'Grow net worth to $25M.', days: 730 },
    futureNotes: ['Minority stakes in rival companies are planned for a future release.'],
  },
  {
    id: 'fallen',
    title: 'The Fallen Executive',
    track: 'legitimate',
    difficulty: 4,
    summary: 'Former tech COO. Deep in debt, reputation in ruins.',
    story: 'Two years ago you ran operations at a celebrated startup. Then it collapsed, the lawsuits landed and the press turned on you. You still know how to run a company.',
    cash: 40000,
    businessSkill: 72,
    reputation: 8,
    streetCred: 5,
    properties: [],
    companies: [],
    loans: [
      { lender: 'Settlement — Investor Lawsuit', kind: 'judgment', principal: 380000, annualRate: 0.05, monthlyPayment: 6500 },
      { lender: 'Personal Credit Lines', kind: 'personal', principal: 64000, annualRate: 0.21, monthlyPayment: 2100 },
    ],
    contacts: [
      { name: 'Nathan Levine', title: 'Former CTO', affiliation: 'Unemployed', relationship: 45, note: 'Still believes in you. Would join a new venture.' },
      { name: 'Monique Carter', title: 'Business reporter', affiliation: 'Miami Ledger', relationship: -30, note: 'Wrote the stories that ended your career.' },
    ],
    advantages: ['Highest starting business skill', 'Knows how to run tech companies'],
    disadvantages: ['$444K of debt (balance sheet: $40K assets vs $444K liabilities)', 'Ruined reputation: no bank credit', 'Monthly debt payments of $8,600'],
    objective: { kind: 'debtFree', target: 0, title: 'Clean Slate', description: 'Pay off all debt.', days: 730 },
  },
  {
    id: 'boss',
    title: 'The Underworld Boss',
    track: 'underground',
    difficulty: 3,
    summary: '$750K and an established crew that answers to you.',
    story: 'You run an established organization with territory in Little Havana and Downtown. Legitimate businesses would give your money a respectable face.',
    cash: 750000,
    businessSkill: 45,
    reputation: 12,
    streetCred: 75,
    properties: [{ id: 'lh-05', use: 'vacant' }],
    companies: [],
    loans: [],
    organization: {
      name: 'The Ceiba Syndicate',
      treasury: 220000,
      influence: 58,
      heat: 34,
      territory: ['littlehavana', 'downtown'],
      description: 'A disciplined, long-established organization with deep neighborhood roots.',
      members: [
        { name: 'Tito Arroyo', rank: 'underboss', weeklyCut: 2500 },
        { name: 'Nina Cabrera', rank: 'lieutenant', weeklyCut: 1500 },
        { name: 'Marco Soto', rank: 'lieutenant', weeklyCut: 1500 },
        { name: 'Luis Paredes', rank: 'associate', weeklyCut: 700 },
        { name: 'Jay Whitfield', rank: 'associate', weeklyCut: 700 },
        { name: 'Andre Lozano', rank: 'associate', weeklyCut: 700 },
      ],
    },
    contacts: [
      { name: 'Detective Ana Salazar', title: 'Detective', affiliation: 'City Police (fictional)', relationship: -40, note: 'Has been watching your organization for years.', underworld: true },
      { name: 'Dante Moreau', title: 'Club owner', affiliation: 'Neon Tide Nightlife', relationship: 10, note: 'Pays attention to who controls the beach.', underworld: true },
    ],
    advantages: ['Established organization and treasury', 'High street credibility', 'Owns a venue in your territory'],
    disadvantages: ['Elevated law-enforcement heat', 'Low public reputation', 'Rival organizations'],
    objective: { kind: 'companies', target: 2, title: 'Respectable Fronts', description: 'Operate two legitimate companies.', days: 365 },
    futureNotes: ['Missions, territory expansion and internal disputes arrive in a future release. In Alpha 0.1 your organization earns abstract weekly income, pays its members and accumulates heat.'],
  },
  {
    id: 'nightlife',
    title: 'The Nightlife King',
    track: 'underground',
    difficulty: 3,
    summary: '$300K, a South Beach lounge and contacts in the shadows.',
    story: 'You run the Velvet Lantern Lounge on a lease, and you know everyone worth knowing after midnight. Some of those people are not on the right side of the law.',
    cash: 300000,
    businessSkill: 50,
    reputation: 35,
    streetCred: 45,
    properties: [],
    companies: [
      {
        name: 'Velvet Lantern',
        subtype: 'nightclub',
        propertyId: 'sb-03',
        ownedProperty: false,
        cash: 25000,
        reputation: 62,
        employees: [
          { role: 'bartender', skill: [50, 65] },
          { role: 'bartender', skill: [45, 60] },
          { role: 'bartender', skill: [40, 55] },
          { role: 'security', skill: [45, 60] },
          { role: 'security', skill: [40, 55] },
          { role: 'promoter', skill: [55, 70] },
        ],
      },
    ],
    loans: [],
    contacts: [
      { name: 'Dante Moreau', title: 'Owner', affiliation: 'Neon Tide Nightlife', relationship: -20, note: 'Wants your spot on the strip.', underworld: true },
      { name: 'Simone Delgado', title: 'Fixer', affiliation: 'Independent', relationship: 40, note: 'Knows people who solve problems.', underworld: true },
    ],
    advantages: ['Profitable nightclub with hype', 'Strong nightlife contacts'],
    disadvantages: ['Lease, not ownership', 'Aggressive nightlife rival next door'],
    objective: { kind: 'netWorth', target: 6000000, title: 'King of the Strip', description: 'Reach a net worth of $6M.', days: 540 },
    futureNotes: ['Underground contacts unlock story events and missions in a future release.'],
  },
  {
    id: 'shadow',
    title: 'The Shadow Investor',
    track: 'underground',
    difficulty: 2,
    summary: '$1.5M of quiet money and secretive contacts.',
    story: 'Nobody knows exactly where your capital came from, and you prefer it that way. Your contacts surface opportunities others never see.',
    cash: 1500000,
    businessSkill: 58,
    reputation: 25,
    streetCred: 40,
    properties: [],
    companies: [],
    loans: [],
    contacts: [
      { name: '"The Accountant"', title: 'Financial adviser', affiliation: 'Unknown', relationship: 50, note: 'Moves money without questions.', underworld: true },
      { name: 'Elena Varga', title: 'Founder', affiliation: 'Coralgate Realty Group', relationship: 10, note: 'Does not ask where buyers get their money.' },
    ],
    advantages: ['Substantial capital', 'No debt', 'Discreet network'],
    disadvantages: ['Low public reputation limits bank credit', 'Questions about the source of funds'],
    objective: { kind: 'properties', target: 5, title: 'Quiet Portfolio', description: 'Own five properties.', days: 365 },
    futureNotes: ['Secret investment opportunities and silent partnerships are planned for a future release.'],
  },
  {
    id: 'hustler',
    title: 'The Street Hustler',
    track: 'underground',
    difficulty: 5,
    summary: '$2,500 and a small circle you trust.',
    story: 'You grew up on these streets. You have $2,500, two friends who have your back, and a talent for spotting angles nobody else sees.',
    cash: 2500,
    businessSkill: 38,
    reputation: 3,
    streetCred: 30,
    properties: [],
    companies: [],
    loans: [],
    organization: {
      name: 'Eighth Street Crew',
      treasury: 1500,
      influence: 8,
      heat: 6,
      territory: ['littlehavana'],
      description: 'Three people and an ambition. Barely an organization yet.',
      members: [
        { name: 'Kev Washington', rank: 'associate', weeklyCut: 120 },
        { name: 'Paola Rivas', rank: 'associate', weeklyCut: 120 },
      ],
    },
    contacts: [{ name: 'Tito Arroyo', title: 'Underboss', affiliation: 'The Ceiba Syndicate', relationship: -10, note: 'Watches small crews in his territory.', underworld: true }],
    advantages: ['Street credibility', 'A loyal tiny crew'],
    disadvantages: ['Almost no money', 'No reputation or credit', 'Larger organizations nearby'],
    objective: { kind: 'netWorth', target: 150000, title: 'Off the Street', description: 'Reach a net worth of $150,000.', days: 540 },
    futureNotes: ['Crew growth and street missions arrive in a future release.'],
  },
  {
    id: 'double',
    title: 'The Double Life',
    track: 'underground',
    difficulty: 4,
    summary: '$500K, a respectable agency and a hidden organization.',
    story: 'By day you run a respected Downtown software agency. By night you run something else entirely. Nobody can know about both.',
    cash: 500000,
    businessSkill: 60,
    reputation: 50,
    streetCred: 50,
    properties: [],
    companies: [
      {
        name: 'Northbeam Software',
        subtype: 'agency',
        propertyId: 'dt-06',
        ownedProperty: false,
        cash: 40000,
        reputation: 60,
        employees: [
          { role: 'dev', skill: [55, 70] },
          { role: 'dev', skill: [50, 65] },
          { role: 'dev', skill: [45, 60] },
          { role: 'sales', skill: [50, 65] },
          { role: 'design', skill: [45, 60] },
        ],
      },
    ],
    loans: [],
    organization: {
      name: 'The Quiet Circle',
      treasury: 90000,
      influence: 30,
      heat: 18,
      territory: ['downtown'],
      description: 'A discreet organization that operates behind respectable fronts.',
      members: [
        { name: 'Simone Delgado', rank: 'lieutenant', weeklyCut: 1200 },
        { name: 'Owen Marsh', rank: 'associate', weeklyCut: 500 },
        { name: 'Bianca Soto', rank: 'associate', weeklyCut: 500 },
      ],
    },
    contacts: [
      { name: 'Detective Ana Salazar', title: 'Detective', affiliation: 'City Police (fictional)', relationship: 0, note: 'Has not connected you to anything. Yet.', underworld: true },
      { name: 'Tomás Vela', title: 'Founder', affiliation: 'Vela Digital Studio', relationship: 25, note: 'Friendly competitor in the agency world.' },
    ],
    advantages: ['Profitable agency', 'Hidden organization with income', 'Good public reputation'],
    disadvantages: ['Heat exposes your legitimate reputation', 'Two empires to manage'],
    objective: { kind: 'netWorth', target: 3000000, title: 'Two Faces', description: 'Reach a net worth of $3M while keeping heat under control.', days: 540 },
    futureNotes: ['Exposure events linking your two lives are planned for a future release.'],
  },
];

export function scenarioById(id: string): ScenarioDef {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
}
