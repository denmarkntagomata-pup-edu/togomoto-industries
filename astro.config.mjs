// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Astro 5 + @astrojs/cloudflare (Workers, output: server).
// Bindings are accessed at runtime via context.locals.runtime.env.<BINDING>
// (see src/env.d.ts). platformProxy makes those bindings available in `astro dev`.
// https://docs.astro.build/en/guides/integrations-guide/cloudflare/
export default defineConfig({
  site: 'https://togomoto-industries.example.com',
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
    // We deliver inventory media ourselves via Cloudflare Image Transformations
    // URLs (src/lib/images.ts) + the /media R2 route, and never use Astro's
    // <Image>/getImage pipeline (AGENTS.md §8). 'passthrough' avoids bundling the
    // 'cloudflare' image service, whose chunk imports node:crypto and would
    // otherwise force the nodejs_compat flag ON (spec §2.5 keeps it OFF).
    imageService: 'passthrough',
  }),
});
