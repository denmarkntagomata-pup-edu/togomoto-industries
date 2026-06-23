// R2 maintenance — orphan detection (spec §14.3, PLAN P3-5). R2 objects are
// durable but listing/spare-part/announcement deletes are supposed to remove their
// objects in app code; if a delete ever half-fails, the object is "orphaned"
// (present in R2 but referenced by no D1 row). These helpers reconcile the bucket
// against every D1 column that holds an R2 key. Drizzle-only reads (AGENTS.md §3);
// R2 access via the binding (AGENTS.md §2/§8). Read-only — callers decide whether
// to delete.
import { isNotNull } from 'drizzle-orm';
import { getDb } from '../db';
import { listingImages, spareParts, announcements } from '../db/schema';

// Every R2 key referenced by a D1 row: listing images (NOT NULL), plus the single
// optional spare-part and announcement cover images.
export async function getReferencedR2Keys(env: Env): Promise<Set<string>> {
  const db = getDb(env);
  const [imgs, parts, anns] = await Promise.all([
    db.select({ k: listingImages.r2Key }).from(listingImages),
    db
      .select({ k: spareParts.imageR2Key })
      .from(spareParts)
      .where(isNotNull(spareParts.imageR2Key)),
    db
      .select({ k: announcements.coverImageR2Key })
      .from(announcements)
      .where(isNotNull(announcements.coverImageR2Key)),
  ]);
  const set = new Set<string>();
  for (const row of [...imgs, ...parts, ...anns]) {
    if (row.k) set.add(row.k);
  }
  return set;
}

// List every object in the bucket (paginated via the R2 cursor) and return the
// keys that no D1 row references. Read-only.
export async function findOrphanR2Keys(env: Env): Promise<string[]> {
  const referenced = await getReferencedR2Keys(env);
  const orphans: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({ cursor, limit: 1000 });
    for (const obj of page.objects) {
      if (!referenced.has(obj.key)) orphans.push(obj.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return orphans;
}
