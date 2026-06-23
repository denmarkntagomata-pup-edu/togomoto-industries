import type { APIContext } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { announcements } from '../../../../db/schema';
import { announcementUpdateSchema } from '../../../../db/validators';
import { generateUniqueAnnouncementSlug } from '../../../../lib/announcements';
import { prepareImageUpload } from '../../../../lib/image-validate';

// Admin announcement update + delete (spec §5.8/§4.4, PLAN P2-5). Access-gated
// (AGENTS.md §5); Zod-validated before any write (AGENTS.md §4). The cover image
// is app-managed: a replace uploads the new object then frees the old, and
// DELETE removes the object after the row. published_at is set on first publish
// and preserved thereafter. Bindings via context.locals.runtime.env.
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
  if (id === null) return json({ error: 'Invalid announcement id' }, 400);

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return json({ error: 'Body must be multipart/form-data' }, 400);
  }

  const candidate = {
    title: form.get('title'),
    excerpt: form.get('excerpt'),
    body: form.get('body'),
    author: form.get('author'),
    slug: form.get('slug'),
    isPublished: form.has('isPublished'),
  };
  const parsed = announcementUpdateSchema.safeParse(candidate);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);

  const [existing] = await db
    .select({ coverImageR2Key: announcements.coverImageR2Key, publishedAt: announcements.publishedAt })
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1);
  if (!existing) return json({ error: 'Announcement not found' }, 404);

  // Cover image action: a new file replaces (and frees the old); `removeImage`
  // clears it; otherwise the existing cover is left untouched.
  let coverKeyUpdate: string | null | undefined;
  let keyToDelete: string | null = null;
  const file = form.get('coverImage');
  if (file instanceof File && file.size > 0) {
    const prep = await prepareImageUpload(file);
    if (!prep.ok) return json({ error: prep.error, fields: { coverImage: [prep.error] } }, 422);
    coverKeyUpdate = `announcements/${crypto.randomUUID()}.${prep.data.ext}`;
    await env.BUCKET.put(coverKeyUpdate, prep.data.bytes, {
      httpMetadata: { contentType: prep.data.mime },
    });
    keyToDelete = existing.coverImageR2Key;
  } else if (form.get('removeImage') != null && form.get('removeImage') !== '') {
    coverKeyUpdate = null;
    keyToDelete = existing.coverImageR2Key;
  }

  const { slug, ...rest } = parsed.data;
  const uniqueSlug = await generateUniqueAnnouncementSlug(env, slug, id);
  // Set published_at on first publish; preserve it afterwards (re-publishing keeps
  // the original date). Unpublished rows are hidden by the public query regardless.
  const publishedAt =
    parsed.data.isPublished && existing.publishedAt == null ? new Date() : existing.publishedAt;

  await db
    .update(announcements)
    .set({
      ...rest,
      slug: uniqueSlug,
      publishedAt,
      ...(coverKeyUpdate !== undefined ? { coverImageR2Key: coverKeyUpdate } : {}),
      updatedAt: new Date(),
    })
    .where(eq(announcements.id, id));

  if (keyToDelete) await env.BUCKET.delete(keyToDelete);

  return json({ ok: true, id, slug: uniqueSlug });
}

export async function DELETE(context: APIContext): Promise<Response> {
  const id = parseId(context);
  if (id === null) return json({ error: 'Invalid announcement id' }, 400);

  const env = context.locals.runtime.env;
  const db = getDb(env);

  const deleted = await db
    .delete(announcements)
    .where(eq(announcements.id, id))
    .returning({ coverImageR2Key: announcements.coverImageR2Key });
  if (deleted.length === 0) return json({ error: 'Announcement not found' }, 404);

  // App-level R2 cleanup — the row is gone; drop its cover image object.
  const key = deleted[0].coverImageR2Key;
  if (key) await env.BUCKET.delete(key);

  return json({ ok: true, id });
}
