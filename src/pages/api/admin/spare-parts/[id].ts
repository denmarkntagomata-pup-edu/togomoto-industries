import type { APIContext } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { spareParts } from '../../../../db/schema';
import { sparePartUpdateSchema } from '../../../../db/validators';
import { prepareImageUpload } from '../../../../lib/image-validate';

// Admin spare-part update + delete (spec §8.7/§4.5, PLAN P2-4). Access-gated
// (AGENTS.md §5); Zod-validated before any write (AGENTS.md §4). The R2 image is
// app-managed — a replace uploads the new object then deletes the old one, and
// DELETE removes the object after the row (spec §4.5: spare-part deletion MUST
// remove its R2 image). Bindings via context.locals.runtime.env.
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

export async function PATCH(context: APIContext): Promise<Response> {
  const id = parseId(context);
  if (id === null) return json({ error: 'Invalid spare-part id' }, 400);

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return json({ error: 'Body must be multipart/form-data' }, 400);
  }

  const candidate = {
    name: form.get('name'),
    category: form.get('category'),
    description: form.get('description'),
    price: form.get('price'),
    sortOrder: form.get('sortOrder'),
    isPublished: form.has('isPublished'),
  };
  const parsed = sparePartUpdateSchema.safeParse(candidate);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);

  const [existing] = await db
    .select({ imageR2Key: spareParts.imageR2Key })
    .from(spareParts)
    .where(eq(spareParts.id, id))
    .limit(1);
  if (!existing) return json({ error: 'Spare part not found' }, 404);

  // Image action: a new file replaces (and frees the old); `removeImage` clears
  // it; otherwise the existing image is left untouched.
  let imageKeyUpdate: string | null | undefined;
  let keyToDelete: string | null = null;
  const file = form.get('image');
  if (file instanceof File && file.size > 0) {
    const prep = await prepareImageUpload(file);
    if (!prep.ok) return json({ error: prep.error, fields: { image: [prep.error] } }, 422);
    imageKeyUpdate = `spare-parts/${crypto.randomUUID()}.${prep.data.ext}`;
    await env.BUCKET.put(imageKeyUpdate, prep.data.bytes, {
      httpMetadata: { contentType: prep.data.mime },
    });
    keyToDelete = existing.imageR2Key;
  } else if (form.get('removeImage') != null && form.get('removeImage') !== '') {
    imageKeyUpdate = null;
    keyToDelete = existing.imageR2Key;
  }

  await db
    .update(spareParts)
    .set({
      ...parsed.data,
      ...(imageKeyUpdate !== undefined ? { imageR2Key: imageKeyUpdate } : {}),
      updatedAt: new Date(),
    })
    .where(eq(spareParts.id, id));

  // Free the superseded R2 object only after the row points elsewhere.
  if (keyToDelete) await env.BUCKET.delete(keyToDelete);

  return json({ ok: true, id });
}

export async function DELETE(context: APIContext): Promise<Response> {
  const id = parseId(context);
  if (id === null) return json({ error: 'Invalid spare-part id' }, 400);

  const env = context.locals.runtime.env;
  const db = getDb(env);

  const deleted = await db
    .delete(spareParts)
    .where(eq(spareParts.id, id))
    .returning({ imageR2Key: spareParts.imageR2Key });
  if (deleted.length === 0) return json({ error: 'Spare part not found' }, 404);

  // App-level R2 cleanup (spec §4.5) — the row is gone; drop its image object.
  const key = deleted[0].imageR2Key;
  if (key) await env.BUCKET.delete(key);

  return json({ ok: true, id });
}
