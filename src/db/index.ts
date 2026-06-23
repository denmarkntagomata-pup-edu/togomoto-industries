import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// Single entry point for DB access. Always obtain `env` from
// context.locals.runtime.env (Astro 5 pattern) and pass it here.
//
//   const db = getDb(Astro.locals.runtime.env);
//
// REMINDER: D1 has no interactive transactions. For atomic multi-statement
// operations use db.batch([...]) — never db.transaction(). See AGENTS.md.
export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
