import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated once and applied to either backend. The dialect is
 * postgresql in both cases — PGlite is real Postgres, so a single set of
 * migration files is valid against the local dev database and production.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : { driver: "pglite", dbCredentials: { url: "./.pglite" } }),
  strict: true,
  verbose: true,
});
