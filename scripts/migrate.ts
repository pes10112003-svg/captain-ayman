import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  // Migrations need a direct (non-pooled) connection when the host provides one (Neon on Vercel does).
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);
  console.log("→ Applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Database is up to date");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
