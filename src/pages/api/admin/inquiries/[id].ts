import type { APIContext } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { inquiries } from '../../../../db/schema';
import { inquiryStatusUpdateSchema } from '../../../../db/validators';

// Admin inquiry status update. Gated by Cloudflare Access at the edge (AGENTS.md
// §5); no in-app auth. Server-authoritative: the status is Zod-validated against
// the inquiry-status enum BEFORE any DB write (AGENTS.md §4). Single-row update,
// so a plain .update() is correct — db.batch() is only for atomic multi-statement.
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function PATCH(context: APIContext): Promise<Response> {
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: 'Invalid inquiry id' }, 400);
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const parsed = inquiryStatusUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const db = getDb(context.locals.runtime.env);
  const updated = await db
    .update(inquiries)
    .set({ status: parsed.data.status })
    .where(eq(inquiries.id, id))
    .returning({ id: inquiries.id, status: inquiries.status });

  if (updated.length === 0) {
    return json({ error: 'Inquiry not found' }, 404);
  }

  return json({ ok: true, inquiry: updated[0] });
}
