import type { APIContext } from 'astro';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { announcements } from '../../../../db/schema';
import { announcementInputSchema } from '../../../../db/validators';
import { generateUniqueAnnouncementSlug } from '../../../../lib/announcements';
import { prepareImageUpload } from '../../../../lib/image-validate';

// Admin announcement creation (spec §5.8/§4.4, PLAN P2-5). Access-gated at the
// edge (AGENTS.md §5). Multipart so the optional cover image rides along. Non-file
// fields are Zod-validated BEFORE any DB/R2 op (AGENTS.md §4); the slug is
// generated from the title + de-duped (reuses the listings helper); published_at
// is set on first publish. Bindings via context.locals.runtime.env (AGENTS.md §2).
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(context: APIContext): Promise<Response> {
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
    isPublished: form.has('isPublished'),
  };
  const parsed = announcementInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);

  // Optional cover image — validate + upload to R2 before the insert.
  let coverImageR2Key: string | null = null;
  const file = form.get('coverImage');
  if (file instanceof File && file.size > 0) {
    const prep = await prepareImageUpload(file);
    if (!prep.ok) return json({ error: prep.error, fields: { coverImage: [prep.error] } }, 422);
    coverImageR2Key = `announcements/${crypto.randomUUID()}.${prep.data.ext}`;
    await env.BUCKET.put(coverImageR2Key, prep.data.bytes, {
      httpMetadata: { contentType: prep.data.mime },
    });
  }

  const slug = await generateUniqueAnnouncementSlug(env, parsed.data.title);
  const publishedAt = parsed.data.isPublished ? new Date() : null;

  const [created] = await db
    .insert(announcements)
    .values({ ...parsed.data, slug, coverImageR2Key, publishedAt })
    .returning({ id: announcements.id, slug: announcements.slug });

  return json({ ok: true, announcement: created }, 201);
}
