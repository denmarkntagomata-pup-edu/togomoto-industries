// Code-managed enumeration vocabularies (spec §4.9). Changing these is a
// developer task (edit list + write a migration); they are NOT an admin-editable
// taxonomy. Keep this file as the single source of truth for enum values; the
// DB CHECK constraints in schema.ts are derived from these arrays.

export const CATEGORIES = ['used_car', 'used_truck', 'used_heavy_equipment'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SALE_STATUSES = ['available', 'reserved', 'sold', 'incoming'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const CONDITIONS = ['used', 'reconditioned', 'for_parts'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const TRANSMISSION_TYPES = ['manual', 'automatic', 'semi_automatic', 'other'] as const;
export type TransmissionType = (typeof TRANSMISSION_TYPES)[number];

export const FUEL_TYPES = ['diesel', 'gasoline', 'hybrid', 'electric', 'other'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const INQUIRY_SOURCES = [
  'home',
  'product_detail',
  'contact',
] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const INQUIRY_STATUSES = [
  'new',
  'read',
  'contacted',
  'negotiating',
  'won',
  'lost',
  'archived',
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

// URL category slug <-> stored enum value. The public listing routes use the
// hyphenated slugs (/products/used-cars); the DB stores the underscore enum.
export const CATEGORY_BY_SLUG = {
  'used-cars': 'used_car',
  'used-trucks': 'used_truck',
  'used-heavy-equipment': 'used_heavy_equipment',
} as const satisfies Record<string, Category>;

export const SLUG_BY_CATEGORY = {
  used_car: 'used-cars',
  used_truck: 'used-trucks',
  used_heavy_equipment: 'used-heavy-equipment',
} as const satisfies Record<Category, string>;

export type CategorySlug = keyof typeof CATEGORY_BY_SLUG;
