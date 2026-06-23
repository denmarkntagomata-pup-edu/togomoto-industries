// Admin dashboard aggregations (read-only). Powers /admin (admin/index.astro).
// Drizzle query builders only (parameterised, injection-safe; AGENTS.md §3); a
// single db.batch([...]) runs every aggregate in one round-trip (mirrors the
// batched group-by pattern in admin-listings.ts). NO writes, NO schema changes —
// every stat here is derivable from existing columns. Formatting stays out of
// this module; callers use lib/format.ts (formatPrice / labelForEnum / …).
import { count, desc, eq, gte } from 'drizzle-orm';
import { getDb } from '../db';
import { announcements, inquiries, listingImages, listings, spareParts } from '../db/schema';
import {
  CATEGORIES,
  INQUIRY_STATUSES,
  SALE_STATUSES,
  type Category,
  type InquiryStatus,
  type SaleStatus,
} from '../db/enums';

// Inquiry statuses that count as "open" work in the pipeline (not yet won/lost/
// archived). Order matters for the funnel rendering.
export const OPEN_INQUIRY_STATUSES = ['new', 'read', 'contacted', 'negotiating'] as const;

export interface CountByKey<K extends string> {
  key: K;
  count: number;
}

export interface RecentListing {
  id: number;
  title: string;
  category: Category;
  status: SaleStatus;
  price: number | null;
  priceOnApplication: boolean;
  isPublished: boolean;
  createdAt: Date;
}

export interface RecentInquiry {
  id: number;
  name: string;
  source: string;
  status: InquiryStatus;
  createdAt: Date;
  listingTitle: string | null;
}

export interface DashboardStats {
  listings: {
    total: number;
    published: number;
    drafts: number;
    poa: number;
    missingPrimaryImage: number;
    byStatus: CountByKey<SaleStatus>[];
    byCategory: CountByKey<Category>[];
    last7d: number;
    last30d: number;
  };
  inquiries: {
    total: number;
    open: number;
    won: number;
    lost: number;
    /** Win rate over decided (won + lost) inquiries, 0–1; null when none decided. */
    winRate: number | null;
    byStatus: CountByKey<InquiryStatus>[];
    last7d: number;
    last30d: number;
  };
  spareParts: { total: number; published: number };
  announcements: { total: number; published: number };
  recentListings: RecentListing[];
  recentInquiries: RecentInquiry[];
}

// Zero-fill a group-by result against a fixed enum order so every bucket renders
// even at count 0 (e.g. no "sold" units yet still shows a 0 row).
function tally<K extends string>(
  order: readonly K[],
  rows: { key: string; count: number }[],
): CountByKey<K>[] {
  const got = new Map(rows.map((r) => [r.key, r.count]));
  return order.map((key) => ({ key, count: got.get(key) ?? 0 }));
}

export async function getDashboardStats(env: Env): Promise<DashboardStats> {
  const db = getDb(env);

  // Unix-second cutoffs for trend windows (createdAt is a `timestamp` column;
  // Drizzle compares against a Date). Indexed by inquiries_created_at_idx.
  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000);
  const d30 = new Date(now - 30 * 86_400_000);

  const [
    listingTotal,
    listingPublished,
    listingPoa,
    listingByStatus,
    listingByCategory,
    listing7d,
    listing30d,
    primaryImageRows,
    listingIdRows,
    inquiryByStatus,
    inquiry7d,
    inquiry30d,
    sparePartsRows,
    sparePartsPublished,
    announcementRows,
    announcementsPublished,
    recentListingRows,
    recentInquiryRows,
  ] = await db.batch([
    db.select({ c: count() }).from(listings),
    db.select({ c: count() }).from(listings).where(eq(listings.isPublished, true)),
    db.select({ c: count() }).from(listings).where(eq(listings.priceOnApplication, true)),
    db
      .select({ key: listings.status, count: count() })
      .from(listings)
      .groupBy(listings.status),
    db
      .select({ key: listings.category, count: count() })
      .from(listings)
      .groupBy(listings.category),
    db.select({ c: count() }).from(listings).where(gte(listings.createdAt, d7)),
    db.select({ c: count() }).from(listings).where(gte(listings.createdAt, d30)),
    db
      .select({ listingId: listingImages.listingId })
      .from(listingImages)
      .where(eq(listingImages.isPrimary, true)),
    db.select({ id: listings.id }).from(listings),
    db
      .select({ key: inquiries.status, count: count() })
      .from(inquiries)
      .groupBy(inquiries.status),
    db.select({ c: count() }).from(inquiries).where(gte(inquiries.createdAt, d7)),
    db.select({ c: count() }).from(inquiries).where(gte(inquiries.createdAt, d30)),
    db.select({ c: count() }).from(spareParts),
    db.select({ c: count() }).from(spareParts).where(eq(spareParts.isPublished, true)),
    db.select({ c: count() }).from(announcements),
    db.select({ c: count() }).from(announcements).where(eq(announcements.isPublished, true)),
    db
      .select({
        id: listings.id,
        title: listings.title,
        category: listings.category,
        status: listings.status,
        price: listings.price,
        priceOnApplication: listings.priceOnApplication,
        isPublished: listings.isPublished,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .orderBy(desc(listings.createdAt))
      .limit(6),
    db
      .select({
        id: inquiries.id,
        name: inquiries.name,
        source: inquiries.source,
        status: inquiries.status,
        createdAt: inquiries.createdAt,
        listingTitle: listings.title,
      })
      .from(inquiries)
      .leftJoin(listings, eq(inquiries.listingId, listings.id))
      .orderBy(desc(inquiries.createdAt))
      .limit(6),
  ]);

  const total = listingTotal[0]?.c ?? 0;
  const published = listingPublished[0]?.c ?? 0;

  // Missing-primary-image: listing ids with no is_primary row. Computed in JS as
  // a set difference over the (small) full id list — cheaper than a NOT IN query.
  const withPrimary = new Set(primaryImageRows.map((r) => r.listingId));
  const missingPrimaryImage = listingIdRows.filter((r) => !withPrimary.has(r.id)).length;

  const inquiryStatusTally = tally(INQUIRY_STATUSES, inquiryByStatus);
  const byStatusMap = new Map(inquiryStatusTally.map((t) => [t.key, t.count]));
  const inquiryTotal = inquiryStatusTally.reduce((s, t) => s + t.count, 0);
  const open = OPEN_INQUIRY_STATUSES.reduce((s, k) => s + (byStatusMap.get(k) ?? 0), 0);
  const won = byStatusMap.get('won') ?? 0;
  const lost = byStatusMap.get('lost') ?? 0;
  const decided = won + lost;

  return {
    listings: {
      total,
      published,
      drafts: total - published,
      poa: listingPoa[0]?.c ?? 0,
      missingPrimaryImage,
      byStatus: tally(SALE_STATUSES, listingByStatus),
      byCategory: tally(CATEGORIES, listingByCategory),
      last7d: listing7d[0]?.c ?? 0,
      last30d: listing30d[0]?.c ?? 0,
    },
    inquiries: {
      total: inquiryTotal,
      open,
      won,
      lost,
      winRate: decided > 0 ? won / decided : null,
      byStatus: inquiryStatusTally,
      last7d: inquiry7d[0]?.c ?? 0,
      last30d: inquiry30d[0]?.c ?? 0,
    },
    spareParts: {
      total: sparePartsRows[0]?.c ?? 0,
      published: sparePartsPublished[0]?.c ?? 0,
    },
    announcements: {
      total: announcementRows[0]?.c ?? 0,
      published: announcementsPublished[0]?.c ?? 0,
    },
    recentListings: recentListingRows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category as Category,
      status: r.status as SaleStatus,
      price: r.price,
      priceOnApplication: r.priceOnApplication,
      isPublished: r.isPublished,
      createdAt: r.createdAt,
    })),
    recentInquiries: recentInquiryRows.map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      status: r.status as InquiryStatus,
      createdAt: r.createdAt,
      listingTitle: r.listingTitle ?? null,
    })),
  };
}
