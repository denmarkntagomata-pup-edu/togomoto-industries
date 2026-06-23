// Admin inventory queries + slug helpers (PLAN P1-8, spec §8.2). Kept separate
// from the public src/lib/listings.ts: the admin views show DRAFTS too (no
// is_published filter) and order by recency of edit. Drizzle query builders only
// (parameterised, injection-safe; AGENTS.md §3).
import { and, asc, count, desc, eq, like, ne, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { listingImages, listings, type Listing } from '../db/schema';
import type { Category, SaleStatus } from '../db/enums';

// Title -> URL slug: lowercase, strip accents, non-alphanumerics to hyphens,
// collapse + trim hyphens. Empty result falls back to 'listing'.
export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'listing';
}

// Generate a unique slug from a title, de-duplicating against existing rows by
// appending -2, -3, … (spec §8.2). `excludeId` lets an edit keep its own slug.
export async function generateUniqueSlug(
  env: Env,
  title: string,
  excludeId?: number,
): Promise<string> {
  const db = getDb(env);
  const base = slugify(title);

  // Pull existing slugs that could collide (base or base-<n>) in one query.
  const rows = await db
    .select({ slug: listings.slug, id: listings.id })
    .from(listings)
    .where(like(listings.slug, `${base.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));

  const taken = new Set(
    rows.filter((r) => r.id !== excludeId).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface AdminListingFilters {
  category?: Category;
  status?: SaleStatus;
  published?: 'published' | 'draft';
}

export interface AdminListingRow {
  listing: Listing;
  primaryKey: string | null;
  imageCount: number;
}

// Listings for the admin table (drafts included), each with its primary image
// key + image count, newest-edited first.
export async function getAdminListings(
  env: Env,
  filters: AdminListingFilters = {},
): Promise<AdminListingRow[]> {
  const db = getDb(env);
  const conds = [];
  if (filters.category) conds.push(eq(listings.category, filters.category));
  if (filters.status) conds.push(eq(listings.status, filters.status));
  if (filters.published === 'published') conds.push(eq(listings.isPublished, true));
  if (filters.published === 'draft') conds.push(eq(listings.isPublished, false));

  const rows = await db
    .select()
    .from(listings)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(listings.updatedAt));

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  // Image counts + primary key per listing, in two small aggregate reads.
  const [counts, primaries] = await db.batch([
    db
      .select({ listingId: listingImages.listingId, c: count() })
      .from(listingImages)
      .groupBy(listingImages.listingId),
    db
      .select({ listingId: listingImages.listingId, r2Key: listingImages.r2Key })
      .from(listingImages)
      .where(eq(listingImages.isPrimary, true)),
  ]);
  const countBy = new Map(counts.map((r) => [r.listingId, r.c]));
  const primaryBy = new Map(primaries.map((r) => [r.listingId, r.r2Key]));

  return rows.map((listing) => ({
    listing,
    primaryKey: primaryBy.get(listing.id) ?? null,
    imageCount: countBy.get(listing.id) ?? 0,
  }));
}

export interface ListingWithImages {
  listing: Listing;
  images: {
    id: number;
    r2Key: string;
    alt: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }[];
}

// One listing (any publish state) + all its images, primary first then by
// sort_order. Null when the id doesn't exist.
export async function getListingWithImages(
  env: Env,
  id: number,
): Promise<ListingWithImages | null> {
  const db = getDb(env);
  const [found] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!found) return null;

  const images = await db
    .select({
      id: listingImages.id,
      r2Key: listingImages.r2Key,
      alt: listingImages.alt,
      sortOrder: listingImages.sortOrder,
      isPrimary: listingImages.isPrimary,
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, id))
    .orderBy(desc(listingImages.isPrimary), asc(listingImages.sortOrder));

  return { listing: found, images };
}

// Next sort_order for an appended image (current max + 1, or 0 for the first).
export async function nextImageSortOrder(env: Env, listingId: number): Promise<number> {
  const db = getDb(env);
  const [row] = await db
    .select({ max: sql<number | null>`max(${listingImages.sortOrder})` })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId));
  return (row?.max ?? -1) + 1;
}

// True when the listing currently has no images (so the first upload becomes
// primary). Uses ne(id, -1) only to keep a single, simple count query shape.
export async function listingHasImages(env: Env, listingId: number): Promise<boolean> {
  const db = getDb(env);
  const [row] = await db
    .select({ c: count() })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, listingId), ne(listingImages.id, -1)));
  return (row?.c ?? 0) > 0;
}
