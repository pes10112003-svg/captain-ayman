import { eq } from "drizzle-orm";
import { db } from "../db";
import { storedFiles } from "../db/schema";
import { assertSafeKey, type ObjectStorage } from "./keys";

/** Stores private files inside PostgreSQL — no extra service needed (ideal for Vercel/serverless). */
export class DatabaseStorage implements ObjectStorage {
  async put(key: string, body: Buffer, contentType: string) {
    assertSafeKey(key);
    await db
      .insert(storedFiles)
      .values({ key, content: body, contentType, size: body.length })
      .onConflictDoUpdate({ target: storedFiles.key, set: { content: body, contentType, size: body.length } });
  }

  async get(key: string) {
    assertSafeKey(key);
    const [row] = await db.select({ content: storedFiles.content }).from(storedFiles).where(eq(storedFiles.key, key)).limit(1);
    return row ? Buffer.from(row.content) : null;
  }

  async delete(key: string) {
    assertSafeKey(key);
    await db.delete(storedFiles).where(eq(storedFiles.key, key));
  }
}
