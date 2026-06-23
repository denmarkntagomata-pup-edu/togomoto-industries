import type { APIContext } from 'astro';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { spareParts } from '../../../../db/schema';
import { sparePartInputSchema } from '../../../../db/validators';
import { prepareImageUpload } from '../../../../lib/image-validate';

// Admin spare-part creation (spec §8.7, PLAN P2-4). Access-gated at the edge
// (AGENTS.md §5). Multipart so the single optional image rides along. Non-file
// fields are Zod-validated BEFORE any DB/R2 op (AGENTS.md §4); the image is
// sniffed + size/edge-capped server-side (NOT trusting Content-Type). Bindings
// via context.locals.runtime.env (AGENTS.md §2).
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
    name: form.get('name'),
    category: form.get('category'),
    description: form.get('description'),
    price: form.get('price'),
    sortOrder: form.get('sortOrder'),
    isPublished: form.has('isPublished'),
  };
  const parsed = sparePartInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);

  // Optional single image — validate + upload to R2 before the insert.
  let imageR2Key: string | null = null;
  const file = form.get('image');
  if (file instanceof File && file.size > 0) {
    const prep = await prepareImageUpload(file);
    if (!prep.ok) return json({ error: prep.error, fields: { image: [prep.error] } }, 422);
    imageR2Key = `spare-parts/${crypto.randomUUID()}.${prep.data.ext}`;
    await env.BUCKET.put(imageR2Key, prep.data.bytes, {
      httpMetadata: { contentType: prep.data.mime },
    });
  }

  const [created] = await db
    .insert(spareParts)
    .values({ ...parsed.data, imageR2Key })
    .returning({ id: spareParts.id });

  return json({ ok: true, sparePart: created }, 201);
}
