/// <reference types="astro/client" />

// Cloudflare bindings available on the Worker. Accessed in code ONLY via
// context.locals.runtime.env.<BINDING> (Astro 5 pattern). Do NOT use the
// Astro 6 typed-Env pattern. See AGENTS.md.
interface Env {
  DB: import('@cloudflare/workers-types').D1Database;
  BUCKET: import('@cloudflare/workers-types').R2Bucket;
  ASSETS: import('@cloudflare/workers-types').Fetcher;
  // Turnstile SITE key (public; wrangler.jsonc vars in prod, .dev.vars locally)
  TURNSTILE_SITE_KEY: string;
  // Secrets (local: .dev.vars; prod: `wrangler secret put`)
  TURNSTILE_SECRET_KEY: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
