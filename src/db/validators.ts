import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { inquiries } from './schema';
import {
  CATEGORIES,
  CONDITIONS,
  FUEL_TYPES,
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  SALE_STATUSES,
  TRANSMISSION_TYPES,
} from './enums';

// Server-authoritative validation (spec §8.1, §10.5). Every state-changing
// endpoint MUST validate its payload with Zod before any DB/R2 op. This file
// holds the public inquiry schema; admin payload schemas are added in Phase 1
// alongside the /api/admin/* endpoints.

// Fields a public submitter is allowed to set. `source` is set by the host page
// and constrained to the enum; `listingId` is present only for product_detail.
export const inquiryInputSchema = createInsertSchema(inquiries)
  .pick({
    source: true,
    listingId: true,
    name: true,
    email: true,
    contactNumber: true,
    company: true,
    message: true,
  })
  .extend({
    source: z.enum(INQUIRY_SOURCES),
    listingId: z.number().int().positive().nullish(),
    name: z.string().trim().min(1).max(200),
    email: z.email().max(254),
    contactNumber: z.string().trim().min(1).max(50),
    company: z.string().trim().max(200).nullish(),
    message: z.string().trim().min(1).max(5000),
  });

export type InquiryInput = z.infer<typeof inquiryInputSchema>;

// Admin status-update payload (PATCH /api/admin/inquiries/:id). Driven off the
// enum array so it always accepts exactly the values the DB CHECK allows. The
// consuming endpoint is built in TASK B (P1-7).
export const inquiryStatusUpdateSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
});
export type InquiryStatusUpdate = z.infer<typeof inquiryStatusUpdateSchema>;

// ── Admin listings (PLAN P1-8, spec §8.2/§8.3) ──────────────────────────────
// Server-authoritative payload schemas for the admin inventory endpoints. All
// state-changing admin routes validate against these BEFORE any DB/R2 op
// (AGENTS.md §4). Slug is NOT accepted on create (auto-generated + de-duped in
// src/lib/admin-listings.ts); the edit form re-submits it (de-duped excl. self).
//
// The admin form always submits the FULL object, so a blanked field means
// "clear the column". Nullable columns therefore map '' -> null; structured
// spec keys map '' -> undefined (dropped from the stored JSON instead).

// Nullable free-text column: '' -> null, otherwise trimmed string.
const nullableText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v),
    z.string().max(max).nullable().default(null),
  );

// Nullable enum column: '' -> null, else constrained to the enum.
const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.enum(values).nullable().default(null),
  );

// Nullable numeric column: '' -> null, numeric strings coerced to number.
const nullableNumber = (opts: { int?: boolean; min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return null;
      if (typeof v === 'string') {
        const n = Number(v);
        return Number.isNaN(n) ? v : n;
      }
      return v;
    },
    (() => {
      let n = z.number();
      if (opts.int) n = n.int();
      if (opts.min !== undefined) n = n.min(opts.min);
      if (opts.max !== undefined) n = n.max(opts.max);
      return n.nullable().default(null);
    })(),
  );

// A structured-spec field: '' -> undefined (dropped), else trimmed string.
const specText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v),
    z.string().max(max).optional(),
  );

// Structured extended specs (spec §4.7). Every key optional; `dimensions` is a
// single free-text field in the admin form (SpecBlocks renders string-or-object).
export const listingSpecsSchema = z.object({
  net_weight: specText(120),
  gross_weight: specText(120),
  payload: specText(120),
  engine: specText(200),
  top_speed: specText(120),
  acceleration_0_62: specText(120),
  drive_type: specText(120),
  gearbox: specText(120),
  dimensions: specText(200),
  weight: specText(120),
});
export type ListingSpecsInput = z.infer<typeof listingSpecsSchema>;

// Drop keys that resolved to undefined so the stored JSON stays minimal (the
// renderer omits absent keys anyway). Returns undefined when nothing is set.
export function cleanSpecs(input: ListingSpecsInput): ListingSpecsInput | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? (out as ListingSpecsInput) : undefined;
}

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase words separated by hyphens');

// Full set of admin-settable listing columns (the form submits all of them).
// `category`/`title`/`status` are required; the rest are nullable. Booleans
// default false (draft / unfeatured).
const listingCoreShape = {
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(1).max(200),
  referenceNumber: nullableText(120),
  maker: nullableText(120),
  model: nullableText(120),
  body: nullableText(120),
  yearOfManufacture: nullableNumber({ int: true, min: 1900, max: 2100 }),
  mileage: nullableNumber({ int: true, min: 0 }),
  color: nullableText(80),
  location: nullableText(120),
  condition: nullableEnum(CONDITIONS),
  transmissionType: nullableEnum(TRANSMISSION_TYPES),
  fuelType: nullableEnum(FUEL_TYPES),
  status: z.enum(SALE_STATUSES).default('available'),
  price: nullableNumber({ min: 0 }),
  priceOnApplication: z.coerce.boolean().default(false),
  description: nullableText(10000),
  specs: listingSpecsSchema.default({}),
  isFeatured: z.coerce.boolean().default(false),
  isPublished: z.coerce.boolean().default(false),
};

// Create payload (slug auto-generated from title).
export const listingInputSchema = z.object(listingCoreShape);
export type ListingInput = z.infer<typeof listingInputSchema>;

// Edit payload: same full object plus the (editable, de-duped) slug.
export const listingUpdateSchema = z.object({ ...listingCoreShape, slug: slugField });
export type ListingUpdate = z.infer<typeof listingUpdateSchema>;

// Per-image metadata update (PATCH /api/admin/listings/:id/images/:imageId).
// `isPrimary` may only be SET (true) — clearing happens implicitly when another
// image is promoted (spec §4.2: exactly one primary).
export const imageMetaSchema = z
  .object({
    alt: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().max(300).nullable().optional(),
    ),
    isPrimary: z.literal(true).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((v) => v.alt !== undefined || v.isPrimary !== undefined || v.sortOrder !== undefined, {
    message: 'No fields to update',
  });
export type ImageMetaUpdate = z.infer<typeof imageMetaSchema>;

// Collection reorder (PATCH /api/admin/listings/:id/images): ordered image ids.
export const imageReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});
export type ImageReorder = z.infer<typeof imageReorderSchema>;

// ── Admin spare parts (PLAN P2-4, spec §4.5/§8.7) ───────────────────────────
// Non-file fields for the spare-part create/edit endpoints. Submitted as
// multipart/form-data (to carry the single optional image), so values arrive as
// strings; the nullable* preprocessors map '' -> null and coerce numbers. The
// image File itself is validated separately (prepareImageUpload). sort_order is
// NOT NULL DEFAULT 0, so blanks resolve to 0 rather than null.
const sparePartCoreShape = {
  name: z.string().trim().min(1).max(200),
  category: nullableText(120),
  description: nullableText(5000),
  price: nullableNumber({ min: 0 }),
  isPublished: z.coerce.boolean().default(false),
  sortOrder: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : typeof v === 'string' ? Number(v) : v),
    z.number().int().min(0).default(0),
  ),
};
export const sparePartInputSchema = z.object(sparePartCoreShape);
export type SparePartInput = z.infer<typeof sparePartInputSchema>;
// Edit shares the same shape (spare parts have no slug/identity field to update).
export const sparePartUpdateSchema = z.object(sparePartCoreShape);
export type SparePartUpdate = z.infer<typeof sparePartUpdateSchema>;

// ── Admin announcements (PLAN P2-5, spec §4.4/§5.8) ─────────────────────────
// Non-file fields for the announcement create/edit endpoints. Multipart (the
// optional cover image rides along). `body` is Markdown source stored verbatim
// and rendered to sanitised HTML on the public detail page (lib/markdown.ts) —
// never stored as HTML. `publishedAt` is derived server-side (set on first
// publish), not submitted. Slug is auto-generated on create, editable on edit
// (de-duped excl. self), reusing slugField + generateUniqueSlug like listings.
const announcementCoreShape = {
  title: z.string().trim().min(1).max(200),
  excerpt: nullableText(500),
  body: z.string().trim().min(1).max(50000),
  author: nullableText(120),
  isPublished: z.coerce.boolean().default(false),
};
export const announcementInputSchema = z.object(announcementCoreShape);
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
export const announcementUpdateSchema = z.object({ ...announcementCoreShape, slug: slugField });
export type AnnouncementUpdate = z.infer<typeof announcementUpdateSchema>;
