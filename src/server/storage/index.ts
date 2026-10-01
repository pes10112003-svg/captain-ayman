/**
 * Private object storage. Files are NEVER placed under /public and never get public URLs:
 * every read goes through an authenticated route handler that re-checks authorization.
 */
import { env } from "../env";
import { DatabaseStorage } from "./database";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

import type { ObjectStorage } from "./keys";
export type { ObjectStorage } from "./keys";
export { assertSafeKey } from "./keys";

let instance: ObjectStorage | undefined;

export function storage(): ObjectStorage {
  if (!instance) {
    const e = env();
    instance =
      e.STORAGE_DRIVER === "s3" ? new S3Storage(e) : e.STORAGE_DRIVER === "local" ? new LocalStorage(e.STORAGE_LOCAL_DIR) : new DatabaseStorage();
  }
  return instance;
}
