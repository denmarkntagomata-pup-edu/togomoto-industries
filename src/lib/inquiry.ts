// Shared field names for the public inquiry flow, so the form (P1-6) and the
// endpoint (P1-5) agree without magic strings drifting apart.

// Honeypot: a field hidden from humans; bots that fill it are rejected (AGENTS.md
// §4). Named to look plausible to a naive bot.
export const HONEYPOT_FIELD = 'website';

// Cloudflare Turnstile token field (the widget renders this name by default).
// Token is captured now; server-side verification lands in P2-7.
export const TURNSTILE_FIELD = 'cf-turnstile-response';
