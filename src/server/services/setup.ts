import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { coachSettings, sessions, users } from "../db/schema";
import { env } from "../env";
import { safeEqual } from "../crypto";
import { ValidationError } from "../errors";
import { hashPassword } from "../auth/password";
import { assertNotLimited, clearRateLimit, hitRateLimit } from "../auth/rate-limit";
import { FIXED_COACH_SETTINGS } from "@/lib/validation";

/**
 * Admin setup & recovery (/setup). Protected by ADMIN_KEY from the hosting environment — whoever
 * controls the hosting controls the app. Used once to create the coach account, and later to
 * recover if the coach forgets their password.
 */
export async function setupStatus() {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(eq(users.role, "coach"));
  return { enabled: !!env().ADMIN_KEY, hasCoach: (row?.n ?? 0) > 0 };
}

export type SetupInput = {
  adminKey: string;
  mode: "create" | "reset";
  name?: string;
  email: string;
  password: string;
};

const LIMIT = 5;
const WINDOW = 15 * 60;

export async function runSetup(input: SetupInput, ip: string | null) {
  const adminKey = env().ADMIN_KEY;
  if (!adminKey) throw new ValidationError("Admin setup is disabled on this server.");
  const rlKey = `setup:${ip ?? "unknown"}`;
  await assertNotLimited(rlKey, LIMIT);
  if (!safeEqual(input.adminKey, adminKey)) {
    await hitRateLimit(rlKey, LIMIT, WINDOW);
    throw new ValidationError("The admin key is incorrect.", {
      adminKey: ["The admin key is incorrect."],
    });
  }
  await clearRateLimit(rlKey);

  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  if (input.mode === "create") {
    const { hasCoach } = await setupStatus();
    if (hasCoach) throw new ValidationError("A coach account already exists.");
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (taken)
      throw new ValidationError("That email is already in use.", {
        email: ["That email is already in use."],
      });
    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          email,
          name: input.name?.trim() || "Coach",
          role: "coach",
          passwordHash,
          mustChangePassword: false,
        })
        .returning({ id: users.id });
      await tx.insert(coachSettings).values({ coachId: u!.id, ...FIXED_COACH_SETTINGS });
    });
  } else {
    const [coach] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email} AND ${users.role} = 'coach'`)
      .limit(1);
    if (!coach)
      throw new ValidationError("No coach account with that email.", {
        email: ["No coach account with that email."],
      });
    await db
      .update(users)
      .set({
        passwordHash,
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      })
      .where(eq(users.id, coach.id));
    await db.delete(sessions).where(eq(sessions.userId, coach.id));
  }
}
