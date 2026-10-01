import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __kineticPool?: Pool };

const pool =
  globalForDb.__kineticPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Serverless functions each hold their own pool → keep it small (Neon's pooler multiplexes).
    max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
    idleTimeoutMillis: 30_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__kineticPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;
export { pool, schema };
