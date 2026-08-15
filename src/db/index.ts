import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema";

/**
 * One database module, two backends.
 *
 * With DATABASE_URL set we talk to a real Postgres over postgres.js. Without
 * it we fall back to PGlite, which is Postgres compiled to WASM running in
 * this process against a local directory. That means `npm run dev` works on a
 * clean checkout with no Docker, no service to start, and no credentials —
 * while the SQL stays genuine Postgres, so nothing written against the dev
 * database has to be rewritten for production.
 */

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Where PGlite persists to. Relative to the project root and git-ignored.
 * Overridable via PGLITE_DATA_DIR: PGlite takes an exclusive lock on its
 * directory, so anything wanting to query concurrently — parallel test runs,
 * a scratch script alongside a live dev server — needs its own copy.
 */
const PGLITE_DATA_DIR = process.env.PGLITE_DATA_DIR ?? "./.pglite";

async function createDatabase(): Promise<Database> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const [{ drizzle }, postgresModule] = await Promise.all([
      import("drizzle-orm/postgres-js"),
      import("postgres"),
    ]);
    const postgres = postgresModule.default;
    // Keep the pool small: serverless runtimes open one per instance, and
    // Postgres connection slots run out far sooner than request volume does.
    const client = postgres(url, { max: 5 });
    return drizzle(client, { schema }) as unknown as Database;
  }

  const [{ drizzle }, { PGlite }] = await Promise.all([
    import("drizzle-orm/pglite"),
    import("@electric-sql/pglite"),
  ]);
  const client = new PGlite(PGLITE_DATA_DIR);
  return drizzle(client, { schema }) as unknown as Database;
}

/**
 * Cached on globalThis rather than in a module-scoped variable. Next.js
 * discards and re-evaluates modules on every hot reload in development, which
 * would otherwise open a new PGlite instance against the same directory on
 * each file save until the lock contention breaks the dev server.
 */
const globalForDb = globalThis as unknown as {
  __ltvDb?: Promise<Database>;
};

export function getDb(): Promise<Database> {
  globalForDb.__ltvDb ??= createDatabase();
  return globalForDb.__ltvDb;
}

export function isUsingPglite(): boolean {
  return !process.env.DATABASE_URL;
}

/**
 * Runs a raw SQL query and returns plain rows.
 *
 * The two drivers disagree about what execute() resolves to: postgres-js hands
 * back an array-like of rows, PGlite hands back a { rows } envelope. Every
 * analytics query goes through here so that difference is handled once, rather
 * than in each caller where it would work in dev and break in production.
 *
 * Callers supply the row type. It is not checked at runtime — keep the type
 * parameter in step with the columns the SQL actually selects.
 */
export async function query<T = Record<string, unknown>>(
  statement: Parameters<Database["execute"]>[0],
): Promise<T[]> {
  const db = await getDb();
  const result = (await db.execute(statement)) as unknown;

  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === "object" &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export { schema };
