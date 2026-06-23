// Announcement queries (spec §5.8 public, §8.x admin, PLAN P2-5). Drizzle query
// builders only (parameterised, injection-safe; AGENTS.md §3). Public reads are
// filtered to published rows ordered by published_at DESC; admin reads include
// drafts. The Markdown body is rendered to sanitised HTML at the page (lib/
// markdown.ts) — never stored as HTML.
import { and, count, desc, eq, isNotNull, like } from 'drizzle-orm';
import { getDb } from '../db';
import { announcements, type Announcement } from '../db/schema';
import { slugify } from './admin-listings';

// Unique announcement slug from a title, de-duped against OTHER announcements by
// appending -2, -3, … (mirrors the listings helper but scoped to this table —
// announcements.slug has its own UNIQUE constraint). `excludeId` lets an edit
// keep its own slug. Reuses the generic slugify().
export async function generateUniqueAnnouncementSlug(
  env: Env,
  title: string,
  excludeId?: number,
): Promise<string> {
  const db = getDb(env);
  const base = slugify(title);
  const rows = await db
    .select({ slug: announcements.slug, id: announcements.id })
    .from(announcements)
    .where(like(announcements.slug, `${base.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));

  const taken = new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export const ANNOUNCEMENTS_PAGE_SIZE = 9;

export interface PublishedAnnouncementsResult {
  rows: Announcement[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

// Published announcements, newest first, offset-paginated. A row counts as
// published only when is_published = 1 AND published_at is set (so a published
// row without a date never surfaces with a null date).
export async function getPublishedAnnouncements(
  env: Env,
  page = 1,
): Promise<PublishedAnnouncementsResult> {
  const db = getDb(env);
  const where = and(eq(announcements.isPublished, true), isNotNull(announcements.publishedAt))!;

  const [{ total }] = await db.select({ total: count() }).from(announcements).where(where);
  const pageCount = Math.max(1, Math.ceil(total / ANNOUNCEMENTS_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows = await db
    .select()
    .from(announcements)
    .where(where)
    .orderBy(desc(announcements.publishedAt))
    .limit(ANNOUNCEMENTS_PAGE_SIZE)
    .offset((current - 1) * ANNOUNCEMENTS_PAGE_SIZE);

  return { rows, total, page: current, pageCount, pageSize: ANNOUNCEMENTS_PAGE_SIZE };
}

export interface SitemapAnnouncement {
  slug: string;
  updatedAt: Date | null;
}

// All published announcements (slug + lastmod) for the SSR sitemap. Same public
// predicate as the index (is_published = 1 AND published_at set), newest-edited
// first; only the columns the sitemap needs.
export async function getSitemapAnnouncements(env: Env): Promise<SitemapAnnouncement[]> {
  const db = getDb(env);
  return db
    .select({ slug: announcements.slug, updatedAt: announcements.updatedAt })
    .from(announcements)
    .where(and(eq(announcements.isPublished, true), isNotNull(announcements.publishedAt)))
    .orderBy(desc(announcements.updatedAt));
}

// A single published announcement by slug, or null (used by the detail page;
// it 404s on null). Must also be published_at-dated to be publicly visible.
export async function getPublishedAnnouncementBySlug(
  env: Env,
  slug: string,
): Promise<Announcement | null> {
  const db = getDb(env);
  const [row] = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.slug, slug),
        eq(announcements.isPublished, true),
        isNotNull(announcements.publishedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

// All announcements for the admin table (drafts included), newest-edited first.
export async function getAdminAnnouncements(env: Env): Promise<Announcement[]> {
  const db = getDb(env);
  return db.select().from(announcements).orderBy(desc(announcements.updatedAt));
}

// One announcement (any state) by id, or null.
export async function getAnnouncement(env: Env, id: number): Promise<Announcement | null> {
  const db = getDb(env);
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  return row ?? null;
}
