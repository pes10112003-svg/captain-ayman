import { createHash, randomBytes } from "node:crypto";

/** 256-bit opaque token, URL-safe. */
export const generateToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
