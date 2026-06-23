import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import {
  CATEGORIES,
  CONDITIONS,
  FUEL_TYPES,
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  SALE_STATUSES,
  TRANSMISSION_TYPES,
} from './enums';

// Builds a SQLite `IN ('a', 'b', ...)` list from a const enum array so CHECK
// constraints stay in sync with src/db/enums.ts. NULL values never violate a
// CHECK (SQLite treats a NULL result as "not failed"), so nullable enum columns
// need no extra guard.
const inList = (values: readonly string[]) =>
  sql.raw(`(${values.map((v) => `'${v}'`).join(', ')})`);

// Structured, display-only extended specs (spec §4.7). Unknown keys ignored by
// the renderer; details that don't map here go in listings.description.
export interface ListingSpecs {
  net_weight?: string | number;
  gross_weight?: string | number;
  payload?: string | number;
  engine?: string;
  top_speed?: string | number;
  acceleration_0_62?: string | number;
  drive_type?: string;
  gearbox?: string;
  dimensions?: string | { length?: string | number; width?: string | number; height?: string | number };
  weight?: string | number;
}

// ── listings (spec §4.1) ────────────────────────────────────────────────────
export const listings = sqliteTable(
  'listings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    referenceNumber: text('reference_number'),
    maker: text('maker'),
    model: text('model'),
    body: text('body'), // free text, not a closed enum (§12.8)
    yearOfManufacture: integer('year_of_manufacture'),
    mileage: integer('mileage'),
    color: text('color'),
    location: text('location'),
    condition: text('condition'),
    transmissionType: text('transmission_type'),
    fuelType: text('fuel_type'),
    status: text('status').notNull().default('available'),
    price: real('price'), // PHP amount; displayed
    priceOnApplication: integer('price_on_application', { mode: 'boolean' })
      .notNull()
      .default(false),
    description: text('description'), // free text; rendered as a paragraph (§5.3d)
    specs: text('specs', { mode: 'json' }).$type<ListingSpecs>(),
    isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index('listings_category_status_idx').on(t.category, t.status),
    index('listings_is_published_idx').on(t.isPublished),
    check('listings_category_ck', sql`${t.category} in ${inList(CATEGORIES)}`),
    check('listings_status_ck', sql`${t.status} in ${inList(SALE_STATUSES)}`),
    check('listings_condition_ck', sql`${t.condition} in ${inList(CONDITIONS)}`),
    check('listings_transmission_ck', sql`${t.transmissionType} in ${inList(TRANSMISSION_TYPES)}`),
    check('listings_fuel_ck', sql`${t.fuelType} in ${inList(FUEL_TYPES)}`),
  ],
);

// ── listing_images (spec §4.2) ──────────────────────────────────────────────
export const listingImages = sqliteTable(
  'listing_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    listingId: integer('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull(),
    alt: text('alt'),
    sortOrder: integer('sort_order').notNull().default(0),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index('listing_images_listing_sort_idx').on(t.listingId, t.sortOrder)],
);

// ── inquiries (spec §4.3) ───────────────────────────────────────────────────
export const inquiries = sqliteTable(
  'inquiries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull(),
    listingId: integer('listing_id').references(() => listings.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    contactNumber: text('contact_number').notNull(),
    company: text('company'),
    message: text('message').notNull(),
    status: text('status').notNull().default('new'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index('inquiries_source_status_created_idx').on(t.source, t.status, t.createdAt),
    index('inquiries_created_at_idx').on(t.createdAt),
    check('inquiries_source_ck', sql`${t.source} in ${inList(INQUIRY_SOURCES)}`),
    check('inquiries_status_ck', sql`${t.status} in ${inList(INQUIRY_STATUSES)}`),
  ],
);

// ── announcements (spec §4.4) ───────────────────────────────────────────────
export const announcements = sqliteTable(
  'announcements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    excerpt: text('excerpt'),
    body: text('body').notNull(), // Markdown source
    coverImageR2Key: text('cover_image_r2_key'),
    author: text('author'),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index('announcements_published_idx').on(t.isPublished, t.publishedAt)],
);

// ── spare_parts (spec §4.5) ─────────────────────────────────────────────────
export const spareParts = sqliteTable(
  'spare_parts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    category: text('category'), // optional grouping label (free text)
    description: text('description'),
    price: real('price'),
    imageR2Key: text('image_r2_key'),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index('spare_parts_published_sort_idx').on(t.isPublished, t.sortOrder)],
);

// Inferred row types for use across queries.
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingImage = typeof listingImages.$inferSelect;
export type NewListingImage = typeof listingImages.$inferInsert;
export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type SparePart = typeof spareParts.$inferSelect;
export type NewSparePart = typeof spareParts.$inferInsert;
