import type { DistrictId, PropertyType } from '../../types/core';

/**
 * Fictional properties. Names are invented for the game world and do not
 * represent real buildings or real listings.
 */
export interface PropertyDef {
  id: string;
  name: string;
  district: DistrictId;
  type: PropertyType;
  sqft: number;
  tier: number;
  /** sale = listed for sale; lease = available to lease; both; private = off-market; or a rival id that owns it. */
  status: 'sale' | 'lease' | 'both' | 'private' | `rival:${string}`;
}

export const TIER_FACTOR = [0, 0.7, 0.85, 1, 1.2, 1.45];

export const PROPERTY_DEFS: PropertyDef[] = [
  // Brickell
  { id: 'brk-01', name: 'Halcyon Tower Office Floors', district: 'brickell', type: 'office', sqft: 18000, tier: 5, status: 'sale' },
  { id: 'brk-02', name: 'Meridian Point Residences', district: 'brickell', type: 'residential', sqft: 24000, tier: 4, status: 'rival:biscayne' },
  { id: 'brk-03', name: 'Bayline Retail Arcade', district: 'brickell', type: 'retail', sqft: 2400, tier: 3, status: 'both' },
  { id: 'brk-04', name: 'Larkspur Bistro Space', district: 'brickell', type: 'restaurant', sqft: 3200, tier: 3, status: 'both' },
  { id: 'brk-05', name: 'Coralstone Financial Center', district: 'brickell', type: 'office', sqft: 9500, tier: 4, status: 'rival:coralgate' },
  { id: 'brk-06', name: 'Vantage Condominium Block', district: 'brickell', type: 'residential', sqft: 6000, tier: 3, status: 'sale' },
  { id: 'brk-07', name: 'Riverwalk Storefront 14', district: 'brickell', type: 'retail', sqft: 1400, tier: 2, status: 'both' },
  { id: 'brk-08', name: 'Solano Hotel Brickell', district: 'brickell', type: 'hotel', sqft: 42000, tier: 4, status: 'private' },
  // Downtown
  { id: 'dt-01', name: 'Exchange Building', district: 'downtown', type: 'office', sqft: 12000, tier: 3, status: 'sale' },
  { id: 'dt-02', name: 'Bayfront Commons Retail', district: 'downtown', type: 'retail', sqft: 1800, tier: 3, status: 'both' },
  { id: 'dt-03', name: 'Old Courthouse Lofts', district: 'downtown', type: 'residential', sqft: 8000, tier: 2, status: 'sale' },
  { id: 'dt-04', name: 'Transit Corner Café', district: 'downtown', type: 'restaurant', sqft: 1600, tier: 2, status: 'both' },
  { id: 'dt-05', name: 'Arena District Event Hall', district: 'downtown', type: 'nightclub', sqft: 7000, tier: 3, status: 'private' },
  { id: 'dt-06', name: 'Northeast Office Suites', district: 'downtown', type: 'office', sqft: 3500, tier: 2, status: 'both' },
  { id: 'dt-07', name: 'Grand Bayside Hotel', district: 'downtown', type: 'hotel', sqft: 36000, tier: 3, status: 'rival:meridian' },
  { id: 'dt-08', name: 'Downtown Quick Market Space', district: 'downtown', type: 'retail', sqft: 1100, tier: 1, status: 'both' },
  // Wynwood
  { id: 'wyn-01', name: 'Mural Works Warehouse', district: 'wynwood', type: 'warehouse', sqft: 6500, tier: 2, status: 'sale' },
  { id: 'wyn-02', name: 'Second Avenue Studio Lofts', district: 'wynwood', type: 'office', sqft: 2800, tier: 2, status: 'both' },
  { id: 'wyn-03', name: 'Hopline Brewhouse Space', district: 'wynwood', type: 'restaurant', sqft: 3600, tier: 2, status: 'both' },
  { id: 'wyn-04', name: 'Canvas Creative Campus', district: 'wynwood', type: 'office', sqft: 11000, tier: 3, status: 'rival:brightwave' },
  { id: 'wyn-05', name: 'Spraycan Retail Row', district: 'wynwood', type: 'retail', sqft: 1500, tier: 2, status: 'both' },
  { id: 'wyn-06', name: 'Voltage Warehouse Club', district: 'wynwood', type: 'nightclub', sqft: 5500, tier: 2, status: 'sale' },
  { id: 'wyn-07', name: 'Gallery Walk Apartments', district: 'wynwood', type: 'residential', sqft: 7200, tier: 2, status: 'sale' },
  { id: 'wyn-08', name: 'Textile Lane Workshop', district: 'wynwood', type: 'warehouse', sqft: 2200, tier: 1, status: 'both' },
  // Little Havana
  { id: 'lh-01', name: 'Corner Cafecito House', district: 'littlehavana', type: 'restaurant', sqft: 1400, tier: 2, status: 'both' },
  { id: 'lh-02', name: 'Domino Square Storefront', district: 'littlehavana', type: 'retail', sqft: 1000, tier: 2, status: 'both' },
  { id: 'lh-03', name: 'Casa Palma Apartments', district: 'littlehavana', type: 'residential', sqft: 5200, tier: 2, status: 'sale' },
  { id: 'lh-04', name: 'Tamarind Family Market', district: 'littlehavana', type: 'retail', sqft: 2200, tier: 2, status: 'rival:mercado' },
  { id: 'lh-05', name: 'Azulejo Dance Hall', district: 'littlehavana', type: 'nightclub', sqft: 4200, tier: 2, status: 'sale' },
  { id: 'lh-06', name: 'Riverside Bungalow Duplex', district: 'littlehavana', type: 'residential', sqft: 1800, tier: 1, status: 'sale' },
  { id: 'lh-07', name: 'Eighth Street Shop 22', district: 'littlehavana', type: 'retail', sqft: 900, tier: 1, status: 'both' },
  { id: 'lh-08', name: 'La Ceiba Cigar House', district: 'littlehavana', type: 'retail', sqft: 1600, tier: 3, status: 'private' },
  // South Beach
  { id: 'sb-01', name: 'The Flamingo Deco Hotel', district: 'southbeach', type: 'hotel', sqft: 28000, tier: 3, status: 'sale' },
  { id: 'sb-02', name: 'Oceanside Terrace Restaurant', district: 'southbeach', type: 'restaurant', sqft: 3000, tier: 3, status: 'both' },
  { id: 'sb-03', name: 'Velvet Lantern Lounge', district: 'southbeach', type: 'nightclub', sqft: 6000, tier: 3, status: 'sale' },
  { id: 'sb-04', name: 'Deco Avenue Boutique 9', district: 'southbeach', type: 'retail', sqft: 1300, tier: 3, status: 'both' },
  { id: 'sb-05', name: 'Pastel Row Apartments', district: 'southbeach', type: 'residential', sqft: 9000, tier: 3, status: 'sale' },
  { id: 'sb-06', name: 'Neon Tide Club', district: 'southbeach', type: 'nightclub', sqft: 8000, tier: 4, status: 'rival:neontide' },
  { id: 'sb-07', name: 'Seabreeze Deco Suites', district: 'southbeach', type: 'hotel', sqft: 18000, tier: 2, status: 'rival:meridian' },
  { id: 'sb-08', name: 'Promenade Café', district: 'southbeach', type: 'restaurant', sqft: 1700, tier: 2, status: 'both' },
  // Waterfront
  { id: 'wf-01', name: 'Creekside Marina Offices', district: 'waterfront', type: 'office', sqft: 4000, tier: 4, status: 'sale' },
  { id: 'wf-02', name: 'Harborview Luxury Residences', district: 'waterfront', type: 'residential', sqft: 16000, tier: 5, status: 'sale' },
  { id: 'wf-03', name: 'The Aurelia Resort', district: 'waterfront', type: 'hotel', sqft: 52000, tier: 5, status: 'rival:atlas' },
  { id: 'wf-04', name: 'Gilded Shore Boutique', district: 'waterfront', type: 'retail', sqft: 1600, tier: 4, status: 'both' },
  { id: 'wf-05', name: 'Yacht Club Grill', district: 'waterfront', type: 'restaurant', sqft: 3400, tier: 4, status: 'both' },
  { id: 'wf-06', name: 'Seaglass Villas', district: 'waterfront', type: 'residential', sqft: 5500, tier: 4, status: 'sale' },
  { id: 'wf-07', name: "Mariner's Rest Bungalows", district: 'waterfront', type: 'residential', sqft: 2600, tier: 3, status: 'sale' },
];

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  office: 'Office',
  retail: 'Retail',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  nightclub: 'Nightlife Venue',
  residential: 'Residential',
  warehouse: 'Warehouse / Loft',
};
