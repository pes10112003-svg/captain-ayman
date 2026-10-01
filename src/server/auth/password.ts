import { hash, verify } from "@node-rs/argon2";

/** Argon2id with OWASP-recommended minimum parameters (19 MiB, t=2, p=1). */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;
/** Burn equivalent CPU when the account doesn't exist, so response time doesn't reveal valid emails. */
export async function fakeVerify(password: string) {
  dummyHash ??= hashPassword("kinetic-timing-equaliser");
  await verifyPassword(await dummyHash, password);
  return false;
}

/** Human-typable temporary password, e.g. "Kx7m-Qp4r-Zt9w". */
export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}
