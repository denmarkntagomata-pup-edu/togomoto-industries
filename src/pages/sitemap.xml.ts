import type { APIContext } from 'astro';
import { SLUG_BY_CATEGORY } from '../db/enums';
import { getSitemapListings } from '../lib/listings';
import { getSitemapAnnouncements } from '../lib/announcements';

// Generated sitemap (spec §3.1, §10.2, PLAN P3-1). SSR, NOT @astrojs/sitemap:
// listing/announcement slugs and publish-state are dynamic D1 data resolved at
// request time, whereas @astrojs/sitemap is build-time only and would freeze a
// stale (or, given the empty prod build DB, empty) URL set. This route queries
// live published content so the sitemap always reflects what is actually public.
// Admin/API/utility routes are excluded by construction (robots.txt also blocks
// /admin + /api). Stays OUTSIDE Cloudflare Access (AGENTS.md §5).
export const prerender = false;

// Static, always-public routes (the SSG/SSR pages without per-row slugs).
const STATIC_PATHS = [
  '/',
  `/products/${SLUG_BY_CATEGORY.used_car}`,
  `/products/${SLUG_BY_CATEGORY.used_truck}`,
  `/products/${SLUG_BY_CATEGORY.used_heavy_equipment}`,
  '/services/auction-request',
  '/services/vehicle-shipping',
  '/spare-parts',
  '/announcements',
  '/about',
  '/contact',
  '/privacy',
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface Entry {
  loc: string;
  lastmod?: string;
}

function urlTag({ loc, lastmod }: Entry): string {
  const last = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
  return `<url><loc>${xmlEscape(loc)}</loc>${last}</url>`;
}

export async function GET(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const origin = (context.site ?? new URL(context.url.origin)).origin;
  const abs = (path: string) => origin + path;

  const [listings, announcements] = await Promise.all([
    getSitemapListings(env),
    getSitemapAnnouncements(env),
  ]);

  const entries: Entry[] = [
    ...STATIC_PATHS.map((path) => ({ loc: abs(path) })),
    ...listings.map((l) => ({
      loc: abs(`/products/${SLUG_BY_CATEGORY[l.category]}/${l.slug}`),
      lastmod: l.updatedAt?.toISOString(),
    })),
    ...announcements.map((a) => ({
      loc: abs(`/announcements/${a.slug}`),
      lastmod: a.updatedAt?.toISOString(),
    })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    entries.map(urlTag).join('') +
    `</urlset>`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Short shared-cache TTL — content edits surface within minutes (P3-3).
      'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
