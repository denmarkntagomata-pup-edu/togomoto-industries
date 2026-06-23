import type { APIContext } from 'astro';
import { z } from 'zod';
import { findOrphanR2Keys } from '../../../../lib/r2-maintenance';

// R2 orphan-cleanup helper (spec §14.3, PLAN P3-5). Access-gated at the edge like
// every /api/admin/* route (AGENTS.md §5); bindings via context.locals.runtime.env.
//   GET  → read-only DRY-RUN: list R2 objects referenced by no D1 row.
//   POST → delete ONLY the keys explicitly confirmed in the body, AND only if each
//          is still an orphan at delete time (re-checked) — so a referenced key can
//          never be removed even if the caller passes a stale list. Zod-validated
//          before any R2 op (AGENTS.md §4). This runs against whichever bucket the
//          binding points at (local in dev, prod when deployed).
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function GET(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const orphans = await findOrphanR2Keys(env);
  return json({ ok: true, count: orphans.length, orphans });
}

const deleteSchema = z.object({
  confirm: z.literal(true),
  keys: z.array(z.string().min(1)).min(1),
});

export async function POST(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Malformed JSON body' }, 400);
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  // Re-derive the live orphan set; only delete requested keys that are STILL
  // orphaned (never a key a D1 row now references).
  const orphanSet = new Set(await findOrphanR2Keys(env));
  const requested = new Set(parsed.data.keys);
  const toDelete = [...requested].filter((k) => orphanSet.has(k));
  const skipped = [...requested].filter((k) => !orphanSet.has(k));

  if (toDelete.length > 0) await env.BUCKET.delete(toDelete);

  return json({ ok: true, deleted: toDelete, skipped });
}
