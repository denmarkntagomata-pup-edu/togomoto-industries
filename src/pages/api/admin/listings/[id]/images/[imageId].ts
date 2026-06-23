import type { APIContext } from 'astro';
import { and, asc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../../../db';
import { listingImages, listings } from '../../../../../../db/schema';
import { imageMetaSchema } from '../../../../../../db/validators';

// Per-image metadata + delete (spec §8.3, §4.2, PLAN P1-8). Access-gated.
//   PATCH  — set alt, sort_order, or promote to primary (exactly one primary,
//            so promoting demotes the rest in one db.batch).
//   DELETE — remove the DB row AND the R2 object; if the deleted image was
//            primary, promote the lowest-sort survivor.
// Bindings via context.locals.runtime.env (AGENTS.md §2).
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function parseIds(context: APIContext): { listingId: number; imageId: number } | null {
  const listingId = Number(context.params.id);
  const imageId = Number(context.params.imageId);
  if (!Number.isInteger(listingId) || listingId <= 0) return null;
  if (!Number.isInteger(imageId) || imageId <= 0) return null;
  return { listingId, imageId };
}

export async function PATCH(context: APIContext): Promise<Response> {
  const ids = parseIds(context);
  if (!ids) return json({ error: 'Invalid id' }, 400);

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const parsed = imageMetaSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);

  const [img] = await db
    .select({ id: listingImages.id })
    .from(listingImages)
    .where(and(eq(listingImages.id, ids.imageId), eq(listingImages.listingId, ids.listingId)))
    .limit(1);
  if (!img) return json({ error: 'Image not found' }, 404);

  const { alt, isPrimary, sortOrder } = parsed.data;
  const fields: Record<string, unknown> = {};
  if (alt !== undefined) fields.alt = alt;
  if (sortOrder !== undefined) fields.sortOrder = sortOrder;

  if (isPrimary) {
    // Atomic: demote every other image for the listing, promote this one, and
    // apply any alt/sort change in the same write.
    await db.batch([
      db
        .update(listingImages)
        .set({ isPrimary: false })
        .where(and(eq(listingImages.listingId, ids.listingId), ne(listingImages.id, ids.imageId))),
      db
        .update(listingImages)
        .set({ ...fields, isPrimary: true })
        .where(eq(listingImages.id, ids.imageId)),
      db.update(listings).set({ updatedAt: new Date() }).where(eq(listings.id, ids.listingId)),
    ]);
  } else {
    await db.batch([
      db.update(listingImages).set(fields).where(eq(listingImages.id, ids.imageId)),
      db.update(listings).set({ updatedAt: new Date() }).where(eq(listings.id, ids.listingId)),
    ]);
  }

  return json({ ok: true });
}

export async function DELETE(context: APIContext): Promise<Response> {
  const ids = parseIds(context);
  if (!ids) return json({ error: 'Invalid id' }, 400);

  const env = context.locals.runtime.env;
  const db = getDb(env);

  const [img] = await db
    .select({ id: listingImages.id, r2Key: listingImages.r2Key, isPrimary: listingImages.isPrimary })
    .from(listingImages)
    .where(and(eq(listingImages.id, ids.imageId), eq(listingImages.listingId, ids.listingId)))
    .limit(1);
  if (!img) return json({ error: 'Image not found' }, 404);

  await db.delete(listingImages).where(eq(listingImages.id, ids.imageId));
  await env.BUCKET.delete(img.r2Key);

  // Keep exactly one primary: if we removed the primary, promote the survivor
  // with the lowest sort_order (spec §4.2).
  if (img.isPrimary) {
    const [next] = await db
      .select({ id: listingImages.id })
      .from(listingImages)
      .where(eq(listingImages.listingId, ids.listingId))
      .orderBy(asc(listingImages.sortOrder))
      .limit(1);
    if (next) {
      await db.update(listingImages).set({ isPrimary: true }).where(eq(listingImages.id, next.id));
    }
  }

  await db.update(listings).set({ updatedAt: new Date() }).where(eq(listings.id, ids.listingId));
  return json({ ok: true });
}
