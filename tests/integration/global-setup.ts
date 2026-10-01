import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Recreates the test database schema from the real migrations before the suite runs. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/kinetic_test";
  if (!/test/i.test(url)) throw new Error(`Refusing to run tests against a non-test database: ${url}`);
  const pool = new Pool({ connectionString: url, max: 1 });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
