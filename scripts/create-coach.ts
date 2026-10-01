/**
 * Create (or reset the password of) a coach account — use this for real deployments instead of the demo seed.
 *
 *   npm run coach:create -- --email you@yourgym.com --name "Your Name"
 *
 * The password is read from the COACH_PASSWORD env var, or prompted for interactively (hidden).
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { sql } from "drizzle-orm";
import { db, pool } from "@/server/db";
import { coachSettings, users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { FIXED_COACH_SETTINGS } from "@/lib/validation";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function promptHidden(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput?: (s: string) => void; output: NodeJS.WriteStream };
  out._writeToOutput = (s: string) => {
    if (s.includes(question)) out.output.write(s);
  };
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() ?? "Coach";
  if (!email || !email.includes("@")) throw new Error('Usage: npm run coach:create -- --email you@example.com --name "Your Name"');
  const password = process.env.COACH_PASSWORD ?? (await promptHidden("Password (min 12 chars recommended): "));
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (existing) {
    if (existing.role !== "coach") throw new Error("That email belongs to a client account.");
    await db.update(users).set({ passwordHash, name, isActive: true, mustChangePassword: false }).where(sql`${users.id} = ${existing.id}`);
    console.log(`✓ Updated coach ${email}`);
  } else {
    const [u] = await db.insert(users).values({ email, name, role: "coach", passwordHash }).returning();
    await db.insert(coachSettings).values({ coachId: u!.id, ...FIXED_COACH_SETTINGS });
    console.log(`✓ Created coach ${email}`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await pool.end();
  process.exit(1);
});
