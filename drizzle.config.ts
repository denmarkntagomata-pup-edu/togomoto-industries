import { defineConfig } from 'drizzle-kit';

// drizzle-kit GENERATES SQL migrations from src/db/schema.ts into
// drizzle/migrations. Migrations are APPLIED by Wrangler (D1), not by
// drizzle-kit push:
//   npm run db:generate          # author migration SQL
//   npm run db:migrate:local     # apply to local D1 (Miniflare)
//   npm run db:migrate:remote    # apply to remote D1 (explicit deploy step)
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
});
