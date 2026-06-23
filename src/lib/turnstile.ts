// Cloudflare Turnstile helpers (spec §6.4/§7, AGENTS.md §4, PLAN P2-7).

// Public Turnstile SITE key (safe to expose). Used as the build-time FALLBACK on
// prerendered (SSG) form pages — `/services/*`, `/about`, `/contact` — where the
// Cloudflare runtime binding is NOT populated during prerender, so the widget
// would otherwise render without a sitekey. Keep this in sync with wrangler.jsonc
// `vars.TURNSTILE_SITE_KEY`. At runtime (dev + SSR pages) the binding wins, so
// local dev still uses the test key from .dev.vars.
export const PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Server-side token verification. Returns true only when Cloudflare confirms the
// token is valid for our secret. Fail-closed: a missing token/secret or any
// network/parse error returns false (the caller rejects the submission). The
// secret comes from context.locals.runtime.env.TURNSTILE_SECRET_KEY (a Wrangler
// secret in prod; the Cloudflare test secret in .dev.vars locally).
export async function verifyTurnstile(
  token: string | undefined | null,
  secret: string | undefined | null,
  ip?: string | null,
): Promise<boolean> {
  if (!token || !secret) return false;

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
