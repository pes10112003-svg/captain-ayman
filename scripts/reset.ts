/** Development helper: drops and recreates the public schema. Refuses to run in production. */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("db:reset is disabled in production");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  console.log("✓ Schema dropped");
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
