import type { APIContext } from 'astro';
import { z } from 'zod';
import { getDb } from '../../db';
import { inquiries } from '../../db/schema';
import { inquiryInputSchema } from '../../db/validators';
import { HONEYPOT_FIELD, TURNSTILE_FIELD } from '../../lib/inquiry';
import { verifyTurnstile } from '../../lib/turnstile';

// Public inquiry submission (spec §7, PLAN P1-5). SSR endpoint. Server-side Zod
// is authoritative (AGENTS.md §4): the payload is validated BEFORE any DB op.
// Mirrors the json()/safeParse/flattenError shape of the admin endpoints.
// This route stays OUTSIDE Cloudflare Access (AGENTS.md §5).
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    // Never cache the inquiry endpoint at the edge or in the browser (P3-3).
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// Accept both JSON (fetch) and form-encoded (no-JS fallback) submissions.
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function POST(context: APIContext): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readBody(context.request);
  } catch {
    return json({ error: 'Malformed request body' }, 400);
  }

  const env = context.locals.runtime.env;

  // Honeypot: a real visitor never fills this; bots that do are rejected before
  // any work happens.
  const honeypot = body[HONEYPOT_FIELD];
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return json({ error: 'Submission rejected' }, 400);
  }

  // Turnstile: verify the token against our secret via Cloudflare's siteverify
  // BEFORE any DB op (AGENTS.md §4). Fail-closed — no/invalid token is rejected.
  // (Local dev uses Cloudflare test keys in .dev.vars, so this always passes.)
  const tokenRaw = body[TURNSTILE_FIELD];
  const token = typeof tokenRaw === 'string' ? tokenRaw : undefined;
  const turnstileOk = await verifyTurnstile(
    token,
    env.TURNSTILE_SECRET_KEY,
    context.request.headers.get('CF-Connecting-IP'),
  );
  if (!turnstileOk) {
    return json({ error: 'Captcha verification failed. Please try again.' }, 403);
  }

  // Normalise loosely-typed transport values before validation.
  const listingIdRaw = body.listingId;
  const listingId =
    listingIdRaw == null || listingIdRaw === '' ? null : Number(listingIdRaw);

  const candidate = {
    source: body.source,
    listingId,
    name: body.name,
    email: body.email,
    contactNumber: body.contactNumber,
    company: body.company === '' ? null : body.company,
    message: body.message,
  };

  const parsed = inquiryInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return json({ error: 'Validation failed', fields: flat.fieldErrors, form: flat.formErrors }, 422);
  }

  // listing_id is only meaningful for product_detail inquiries (spec §4.3); drop
  // it for every other source regardless of what was submitted.
  const data = parsed.data;
  const resolvedListingId = data.source === 'product_detail' ? (data.listingId ?? null) : null;

  const db = getDb(env);
  const [inserted] = await db
    .insert(inquiries)
    .values({
      source: data.source,
      listingId: resolvedListingId,
      name: data.name,
      email: data.email,
      contactNumber: data.contactNumber,
      company: data.company ?? null,
      message: data.message,
      userAgent: context.request.headers.get('user-agent') ?? null,
    })
    .returning({ id: inquiries.id });

  return json({ ok: true, id: inserted.id }, 201);
}
