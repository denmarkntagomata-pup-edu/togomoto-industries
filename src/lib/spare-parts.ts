// Spare-parts queries (spec §5.6 public, §8.7 admin, PLAN P2-4). Drizzle query
// builders only (parameterised, injection-safe; AGENTS.md §3). The public list
// shows only published records ordered by sort_order; the admin list shows all
// records (drafts too) in the same authoring order.
import { asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { spareParts, type SparePart } from '../db/schema';

// Published spare parts for the public page, in authoring order (sort_order asc,
// then newest as a stable tiebreaker).
export async function getPublishedSpareParts(env: Env): Promise<SparePart[]> {
  const db = getDb(env);
  return db
    .select()
    .from(spareParts)
    .where(eq(spareParts.isPublished, true))
    .orderBy(asc(spareParts.sortOrder), desc(spareParts.createdAt));
}

// All spare parts for the admin table (drafts included), same authoring order.
export async function getAdminSpareParts(env: Env): Promise<SparePart[]> {
  const db = getDb(env);
  return db
    .select()
    .from(spareParts)
    .orderBy(asc(spareParts.sortOrder), desc(spareParts.createdAt));
}

// One spare part (any publish state) by id, or null.
export async function getSparePart(env: Env, id: number): Promise<SparePart | null> {
  const db = getDb(env);
  const [row] = await db.select().from(spareParts).where(eq(spareParts.id, id)).limit(1);
  return row ?? null;
}
