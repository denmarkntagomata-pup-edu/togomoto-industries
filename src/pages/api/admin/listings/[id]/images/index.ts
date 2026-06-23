import type { APIContext } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../../../db';
import { listingImages, listings } from '../../../../../../db/schema';
import { imageReorderSchema } from '../../../../../../db/validators';
import { listingHasImages, nextImageSortOrder } from '../../../../../../lib/admin-listings';
import { MAX_EDGE, MAX_FILE_BYTES, sniffImage } from '../../../../../../lib/image-validate';

// Admin image management for a listing (spec §8.3, §9, PLAN P1-8). Access-gated.
//   POST  — multipart upload (one or more `file` parts) to R2 + DB rows.
//   PATCH — reorder existing images (ordered id array) via db.batch.
// Type + size + longest-edge validated server-side from the header bytes, NOT
// from the client Content-Type (AGENTS.md §8). Bindings via runtime.env.
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function parseId(context: APIContext): number | null {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(context: APIContext): Promise<Response> {
  const listingId = parseId(context);
  if (listingId === null) return json({ error: 'Invalid listing id' }, 400);

  const env = context.locals.runtime.env;
  const db = getDb(env);

  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) return json({ error: 'Listing not found' }, 404);

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return json({ error: 'Body must be multipart/form-data' }, 400);
  }

  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return json({ error: 'No files provided' }, 422);

  // Validate ALL files before writing anything (so a bad file rejects the batch
  // without leaving partial uploads).
  const prepared: { bytes: Uint8Array; mime: string; ext: string; name: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return json({ error: `"${file.name}" exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit` }, 422);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImage(bytes);
    if (!sniffed) {
      return json({ error: `"${file.name}" is not a supported image (JPEG, PNG or WebP)` }, 422);
    }
    if (Math.max(sniffed.width, sniffed.height) > MAX_EDGE) {
      return json(
        { error: `"${file.name}" is ${sniffed.width}×${sniffed.height}px; longest edge must be ≤ ${MAX_EDGE}px` },
        422,
      );
    }
    prepared.push({ bytes, mime: sniffed.mime, ext: sniffed.ext, name: file.name });
  }

  let sortOrder = await nextImageSortOrder(env, listingId);
  let hasImages = await listingHasImages(env, listingId);

  const created: { id: number; r2Key: string; isPrimary: boolean; sortOrder: number }[] = [];
  for (const item of prepared) {
    const r2Key = `listings/${listingId}/${crypto.randomUUID()}.${item.ext}`;
    await env.BUCKET.put(r2Key, item.bytes, { httpMetadata: { contentType: item.mime } });

    const isPrimary = !hasImages; // first image overall becomes primary
    const [row] = await db
      .insert(listingImages)
      .values({ listingId, r2Key, sortOrder, isPrimary })
      .returning({ id: listingImages.id });

    created.push({ id: row.id, r2Key, isPrimary, sortOrder });
    sortOrder++;
    hasImages = true;
  }

  // Touch the listing so the admin table reflects the change.
  await db.update(listings).set({ updatedAt: new Date() }).where(eq(listings.id, listingId));

  return json({ ok: true, images: created }, 201);
}

export async function PATCH(context: APIContext): Promise<Response> {
  const listingId = parseId(context);
  if (listingId === null) return json({ error: 'Invalid listing id' }, 400);

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const parsed = imageReorderSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);

  // Scope updates to images that actually belong to this listing (ignore stray
  // ids). sort_order follows array position.
  const statements = parsed.data.order.map((imageId, index) =>
    db
      .update(listingImages)
      .set({ sortOrder: index })
      .where(and(eq(listingImages.id, imageId), eq(listingImages.listingId, listingId))),
  );
  if (statements.length === 0) return json({ error: 'Nothing to reorder' }, 422);

  const [first, ...rest] = statements;
  await db.batch([first, ...rest]);
  return json({ ok: true });
}
