// Cache-Control posture for public, anonymous SSR responses (spec §10.1, PLAN
// P3-3). Every public page renders identically for all visitors — no per-user
// state, no auth, no cookies — so a short SHARED-cache TTL lets Cloudflare's edge
// serve repeat hits and cut Worker invocations, while a low max-age keeps CMS
// edits visible within a minute. stale-while-revalidate avoids a latency cliff
// when an entry expires.
//
// Call ONLY from public SSR pages. NEVER call it on /admin/* (gated content),
// /api/* or POST /api/inquiries — those stay no-store (see setNoStore / the admin
// layout). Astro.response is passed straight through ({ headers: Headers }).
export function setPublicCache(response: { headers: Headers }): void {
  response.headers.set(
    'Cache-Control',
    'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  );
}

// Explicit no-store for responses that must never be cached by the edge or the
// browser (admin pages/endpoints, the public inquiry POST).
export function setNoStore(response: { headers: Headers }): void {
  response.headers.set('Cache-Control', 'no-store');
}
