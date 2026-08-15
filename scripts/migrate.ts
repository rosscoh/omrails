/**
 * Applies the generated SQL migrations to whichever backend is configured.
 *
 *   npm run db:migrate               # -> ./.pglite
 *   DATABASE_URL=postgres://... npm run db:migrate
 *
 * The migrator is imported per-backend rather than through src/db, because the
 * two migrate() implementations want their own concrete database types.
 */

const MIGRATIONS_FOLDER = "./drizzle";

async function main() {
  const url = process.env.DATABASE_URL;

  if (url) {
    const [{ drizzle }, { migrate }, postgresModule] = await Promise.all([
      import("drizzle-orm/postgres-js"),
      import("drizzle-orm/postgres-js/migrator"),
      import("postgres"),
    ]);
    // max: 1 — running migrations over a pool risks two connections applying
    // the same migration concurrently.
    const client = postgresModule.default(url, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    await client.end();
    console.log("Migrations applied to Postgres.");
    return;
  }

  const [{ drizzle }, { migrate }, { PGlite }] = await Promise.all([
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
    import("@electric-sql/pglite"),
  ]);
  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? "./.pglite");
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  await client.close();
  console.log("Migrations applied to local PGlite database (./.pglite).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
