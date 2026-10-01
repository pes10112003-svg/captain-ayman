/** Human-typable random password for the coach to hand out, e.g. "Kx7m-Qp4r-Zt9w" (≈ 70 bits). Browser & server safe. */
export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

/** Short access code that's easy to read out loud, e.g. "FIT-7K2Q9". */
export function generateAccessCode(prefix = "FIT") {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}
