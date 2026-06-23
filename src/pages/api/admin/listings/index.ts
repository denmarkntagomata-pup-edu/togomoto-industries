import type { APIContext } from 'astro';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { listings } from '../../../../db/schema';
import { cleanSpecs, listingInputSchema } from '../../../../db/validators';
import { generateUniqueSlug } from '../../../../lib/admin-listings';

// Admin listing creation (spec §8.2, PLAN P1-8). Gated by Cloudflare Access at
// the edge (AGENTS.md §5). Server-authoritative: the payload is Zod-validated
// BEFORE any DB op (AGENTS.md §4); the slug is generated from the title and
// de-duplicated. Bindings via context.locals.runtime.env (AGENTS.md §2).
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(context: APIContext): Promise<Response> {
  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const parsed = listingInputSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);
  const { specs, ...data } = parsed.data;
  const slug = await generateUniqueSlug(env, data.title);

  const [created] = await db
    .insert(listings)
    .values({ ...data, slug, specs: cleanSpecs(specs) ?? null })
    .returning({ id: listings.id, slug: listings.slug });

  return json({ ok: true, listing: created }, 201);
}
