// Category-listing queries (spec §5.2, PLAN P1-3). All filtering is driven by URL
// query params on the SSR page route — there is no JSON endpoint. Uses Drizzle
// query builders only (parameterised, injection-safe; AGENTS.md §3). Filter
// option lists are derived from distinct PUBLISHED values within the category.
import { and, asc, count, desc, eq, inArray, isNotNull, like, ne, or, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { getDb } from '../db';
import { listingImages, listings, type Listing } from '../db/schema';
import type { Category } from '../db/enums';

export const PAGE_SIZE = 12;

// The filterable facets (spec §5.2). `search` is free text; the rest are exact
// matches chosen from the derived option lists.
export interface ListingFilters {
  search: string;
  maker: string;
  model: string;
  body: string;
  fuel: string;
  location: string;
  condition: string;
  transmission: string;
  status: string;
  page: number;
}

const FACET_KEYS = [
  'search',
  'maker',
  'model',
  'body',
  'fuel',
  'location',
  'condition',
  'transmission',
  'status',
] as const;

// Read filters from the request URL; unknown/blank params collapse to ''.
export function parseFilters(params: URLSearchParams): ListingFilters {
  const get = (k: string) => (params.get(k) ?? '').trim();
  const pageRaw = Number(params.get('page'));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return {
    search: get('search'),
    maker: get('maker'),
    model: get('model'),
    body: get('body'),
    fuel: get('fuel'),
    location: get('location'),
    condition: get('condition'),
    transmission: get('transmission'),
    status: get('status'),
    page,
  };
}

// True when any facet (not pagination) is active — used for the empty state.
export function hasActiveFilters(f: ListingFilters): boolean {
  return FACET_KEYS.some((k) => f[k] !== '');
}

// Escape LIKE wildcards in user input so a literal % or _ doesn't act as a glob.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function buildWhere(category: Category, f: ListingFilters): SQL {
  const conds: SQL[] = [eq(listings.category, category), eq(listings.isPublished, true)];

  if (f.search) {
    const term = `%${escapeLike(f.search)}%`;
    conds.push(
      or(
        like(listings.title, term),
        like(listings.maker, term),
        like(listings.model, term),
      )!,
    );
  }
  if (f.maker) conds.push(eq(listings.maker, f.maker));
  if (f.model) conds.push(eq(listings.model, f.model));
  if (f.body) conds.push(eq(listings.body, f.body));
  if (f.fuel) conds.push(eq(listings.fuelType, f.fuel));
  if (f.location) conds.push(eq(listings.location, f.location));
  if (f.condition) conds.push(eq(listings.condition, f.condition));
  if (f.transmission) conds.push(eq(listings.transmissionType, f.transmission));
  if (f.status) conds.push(eq(listings.status, f.status));

  return and(...conds)!;
}

export interface ListingCardRow {
  listing: Listing;
  image: { r2Key: string; alt: string | null } | null;
}

export interface CategoryListingsResult {
  rows: ListingCardRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

// One published-category page of listings (featured first, then newest), each
// paired with its primary image. Offset pagination, page size 12.
export async function getCategoryListings(
  env: Env,
  category: Category,
  filters: ListingFilters,
): Promise<CategoryListingsResult> {
  const db = getDb(env);
  const where = buildWhere(category, filters);

  const [{ total }] = await db.select({ total: count() }).from(listings).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const rows = await db
    .select()
    .from(listings)
    .where(where)
    .orderBy(desc(listings.isFeatured), desc(listings.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const ids = rows.map((r) => r.id);
  const images = ids.length
    ? await db
        .select({ listingId: listingImages.listingId, r2Key: listingImages.r2Key, alt: listingImages.alt })
        .from(listingImages)
        .where(and(inArray(listingImages.listingId, ids), eq(listingImages.isPrimary, true)))
    : [];
  const imageByListing = new Map(images.map((i) => [i.listingId, { r2Key: i.r2Key, alt: i.alt }]));

  return {
    rows: rows.map((listing) => ({ listing, image: imageByListing.get(listing.id) ?? null })),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

// ── Site-wide search (header search box → /search) ──────────────────────────

export interface SearchResult {
  rows: ListingCardRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  query: string;
}

// Free-text search across ALL published listings (title / maker / model / body),
// regardless of category. Drives the header "Search Products/Service" box; the
// /search page renders the rows as ListingCards. Same injection-safe LIKE +
// image-pairing pattern as getCategoryListings; offset pagination, page size 12.
export async function searchListings(
  env: Env,
  query: string,
  page = 1,
): Promise<SearchResult> {
  const q = query.trim();
  const empty: SearchResult = { rows: [], total: 0, page: 1, pageCount: 1, pageSize: PAGE_SIZE, query: q };
  if (!q) return empty;

  const db = getDb(env);
  const term = `%${escapeLike(q)}%`;
  const where = and(
    eq(listings.isPublished, true),
    or(
      like(listings.title, term),
      like(listings.maker, term),
      like(listings.model, term),
      like(listings.body, term),
    )!,
  )!;

  const [{ total }] = await db.select({ total: count() }).from(listings).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const rows = await db
    .select()
    .from(listings)
    .where(where)
    .orderBy(desc(listings.isFeatured), desc(listings.createdAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const ids = rows.map((r) => r.id);
  const images = ids.length
    ? await db
        .select({ listingId: listingImages.listingId, r2Key: listingImages.r2Key, alt: listingImages.alt })
        .from(listingImages)
        .where(and(inArray(listingImages.listingId, ids), eq(listingImages.isPrimary, true)))
    : [];
  const imageByListing = new Map(images.map((i) => [i.listingId, { r2Key: i.r2Key, alt: i.alt }]));

  return {
    rows: rows.map((listing) => ({ listing, image: imageByListing.get(listing.id) ?? null })),
    total,
    page: safePage,
    pageCount,
    pageSize: PAGE_SIZE,
    query: q,
  };
}

export interface FilterOptions {
  maker: string[];
  model: string[];
  body: string[];
  fuel: string[];
  location: string[];
  condition: string[];
  transmission: string[];
  status: string[];
}

// Distinct, non-null values per facet within the published category (spec §5.2).
export async function getFilterOptions(env: Env, category: Category): Promise<FilterOptions> {
  const db = getDb(env);
  const base = and(eq(listings.category, category), eq(listings.isPublished, true))!;

  const distinct = async (col: AnySQLiteColumn): Promise<string[]> => {
    const rows = await db
      .selectDistinct({ v: col })
      .from(listings)
      .where(and(base, isNotNull(col)))
      .orderBy(asc(col));
    return rows
      .map((r) => r.v as string | null)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
  };

  const [maker, model, body, fuel, location, condition, transmission, status] = await Promise.all([
    distinct(listings.maker),
    distinct(listings.model),
    distinct(listings.body),
    distinct(listings.fuelType),
    distinct(listings.location),
    distinct(listings.condition),
    distinct(listings.transmissionType),
    distinct(listings.status),
  ]);

  return { maker, model, body, fuel, location, condition, transmission, status };
}

// ── Home recent arrivals (spec §5.1b/c, PLAN P2-1) ──────────────────────────

// Newest published listings of one category, each paired with its primary image
// for a card. Home uses this for the cars and trucks carousels; heavy equipment
// is intentionally excluded from the home rows (AGENTS.md §7), so callers only
// pass used_car / used_truck.
export async function getRecentArrivals(
  env: Env,
  category: Category,
  limit = 10,
): Promise<ListingCardRow[]> {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.category, category), eq(listings.isPublished, true)))
    .orderBy(desc(listings.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const images = ids.length
    ? await db
        .select({ listingId: listingImages.listingId, r2Key: listingImages.r2Key, alt: listingImages.alt })
        .from(listingImages)
        .where(and(inArray(listingImages.listingId, ids), eq(listingImages.isPrimary, true)))
    : [];
  const imageByListing = new Map(images.map((i) => [i.listingId, { r2Key: i.r2Key, alt: i.alt }]));
  return rows.map((listing) => ({ listing, image: imageByListing.get(listing.id) ?? null }));
}

// ── Sitemap (spec §10.2, PLAN P3-1) ─────────────────────────────────────────

export interface SitemapListing {
  category: Category;
  slug: string;
  updatedAt: Date | null;
}

// All published listings (category + slug + lastmod) for the SSR sitemap. Kept
// lean — only the columns the sitemap needs — and ordered newest-edited first.
export async function getSitemapListings(env: Env): Promise<SitemapListing[]> {
  const db = getDb(env);
  const rows = await db
    .select({ category: listings.category, slug: listings.slug, updatedAt: listings.updatedAt })
    .from(listings)
    .where(eq(listings.isPublished, true))
    .orderBy(desc(listings.updatedAt));
  return rows.map((r) => ({ category: r.category as Category, slug: r.slug, updatedAt: r.updatedAt }));
}

// ── Detail view (spec §5.3, PLAN P1-4) ──────────────────────────────────────

// A single published listing by slug, or null. The page additionally checks the
// stored category matches the URL category before rendering (else 404).
export async function getPublishedListingBySlug(env: Env, slug: string): Promise<Listing | null> {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.slug, slug), eq(listings.isPublished, true)))
    .limit(1);
  return rows[0] ?? null;
}

export interface DetailImage {
  r2Key: string;
  alt: string | null;
}

// All images for a listing, primary first then by sort_order (spec §5.3a).
export async function getListingImages(env: Env, listingId: number): Promise<DetailImage[]> {
  const db = getDb(env);
  return db
    .select({ r2Key: listingImages.r2Key, alt: listingImages.alt })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(desc(listingImages.isPrimary), asc(listingImages.sortOrder));
}

// Related products: same category, excluding the current listing, newest first
// (spec §5.3f). Each paired with its primary image for the card.
export async function getRelatedListings(
  env: Env,
  category: Category,
  excludeId: number,
  limit = 4,
): Promise<ListingCardRow[]> {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(listings)
    .where(
      and(eq(listings.category, category), eq(listings.isPublished, true), ne(listings.id, excludeId)),
    )
    .orderBy(desc(listings.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const images = ids.length
    ? await db
        .select({ listingId: listingImages.listingId, r2Key: listingImages.r2Key, alt: listingImages.alt })
        .from(listingImages)
        .where(and(inArray(listingImages.listingId, ids), eq(listingImages.isPrimary, true)))
    : [];
  const imageByListing = new Map(images.map((i) => [i.listingId, { r2Key: i.r2Key, alt: i.alt }]));
  return rows.map((listing) => ({ listing, image: imageByListing.get(listing.id) ?? null }));
}
