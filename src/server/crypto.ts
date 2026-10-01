import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

let warned = false;
function secret() {
  const s = env().AUTH_SECRET;
  if (s) return s;
  if (!warned) {
    console.warn("[app] AUTH_SECRET is not set — using a development-only fallback secret.");
    warned = true;
  }
  return `dev-only:${process.env.DATABASE_URL ?? "local"}`;
}
const key = (purpose: string) => createHash("sha256").update(`${purpose}:${secret()}`).digest();

/** AES-256-GCM → "v1.<iv>.<tag>.<ciphertext>" (base64url). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("enc"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(blob: string): string | null {
  try {
    const [v, iv, tag, data] = blob.split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", key("enc"), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const sign = (value: string) => createHmac("sha256", key("mac")).update(value).digest("base64url");

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
