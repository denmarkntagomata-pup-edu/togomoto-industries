import type { APIContext } from 'astro';

// Public R2 object origin. Image Transformations (/cdn-cgi/image/.../media/<key>)
// fetch the original from here; in dev the <img> hits this route directly. Read
// only — uploads go through the protected admin endpoints (spec §9). Bindings are
// accessed via context.locals.runtime.env (AGENTS.md §2).
export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const key = context.params.key;
  if (!key) return new Response('Not found', { status: 404 });

  const env = context.locals.runtime.env;
  const object = await env.BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers: Record<string, string> = {
    'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    etag: object.httpEtag,
    // Immutable-ish: image bytes for a key never change (re-upload uses a new key).
    'cache-control': 'public, max-age=31536000, immutable',
  };

  // R2's ReadableStream is typed via @cloudflare/workers-types and differs from
  // the DOM lib's; the runtime accepts it directly, so bridge the type here.
  return new Response(object.body as unknown as BodyInit, { headers });
}
