import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { clients, passwordResetTokens, sessions, users } from "../db/schema";
import { AppError, ForbiddenError, ValidationError } from "../errors";
import { env } from "../env";
import { logActivity } from "../activity";
import { authorizeSelf } from "../authz";
import { sendMail } from "../mail";
import { assertNotLimited, assertRateLimit, clearRateLimit, hitRateLimit } from "../auth/rate-limit";
import { fakeVerify, hashPassword, verifyPassword } from "../auth/password";
import { generateToken, hashToken } from "../auth/tokens";
import type { Actor } from "../auth/types";

const INVALID = () => new AppError("Invalid email or password.", 401, "invalid_credentials");

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  return user ?? null;
}

/** Verifies credentials with brute-force protection. Returns the user on success. */
export async function authenticate(emailInput: string, password: string, ip: string | null) {
  const email = emailInput.trim().toLowerCase();
  // Brute-force protection counts FAILED attempts only: 8 per account and 40 per IP per 15 minutes.
  const emailKey = `login:email:${email}`;
  const ipKey = ip ? `login:ip:${ip}` : null;
  await assertNotLimited(emailKey, 8);
  if (ipKey) await assertNotLimited(ipKey, 40);
  const fail = async () => {
    await hitRateLimit(emailKey, 8, 15 * 60);
    if (ipKey) await hitRateLimit(ipKey, 40, 15 * 60);
    return INVALID();
  };

  const user = await findUserByEmail(email);
  if (!user) {
    await fakeVerify(password);
    throw await fail();
  }
  if (!(await verifyPassword(user.passwordHash, password))) throw await fail();

  const disabled = new ForbiddenError("This account has been disabled. Please contact your coach.");
  if (!user.isActive) throw disabled;

  let clientId: string | null = null;
  let coachId: string = user.id;
  if (user.role === "client") {
    const [client] = await db.select().from(clients).where(eq(clients.userId, user.id)).limit(1);
    if (!client || client.status !== "active") throw disabled;
    clientId = client.id;
    coachId = client.coachId;
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await clearRateLimit(emailKey);
  await logActivity({ actorId: user.id, clientId, coachId, action: "auth.login", entityType: "user", entityId: user.id });
  return user;
}

export async function changePassword(actor: Actor, currentPassword: string | undefined, newPassword: string) {
  const [user] = await db.select().from(users).where(eq(users.id, actor.userId)).limit(1);
  if (!user) throw new ForbiddenError();
  if (actor.role === "client" && !user.mustChangePassword) {
    // Clients may only change the coach-issued password when the coach allows it.
    await authorizeSelf(actor, "changeOwnPassword");
  }
  if (!user.mustChangePassword) {
    if (!currentPassword || !(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new ValidationError("Current password is incorrect.", { currentPassword: ["Current password is incorrect."] });
    }
  }
  if (await verifyPassword(user.passwordHash, newPassword)) {
    throw new ValidationError("Choose a password you haven't used here.", { newPassword: ["Choose a new password."] });
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: new Date() })
    .where(eq(users.id, user.id));
  // Sign out every other device.
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, actor.sessionId)));
  await logActivity({
    actorId: user.id,
    clientId: actor.clientId,
    coachId: actor.coachId,
    action: "auth.password_changed",
    entityType: "user",
    entityId: user.id,
  });
  return user.id;
}

/** Creates a single-use reset token. Returns the absolute URL. */
export async function createPasswordResetLink(userId: string, createdById: string | null, ttlMinutes: number) {
  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    createdById,
  });
  return `${env().APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

/** Always resolves silently so the response never reveals whether an email is registered. */
export async function requestPasswordReset(emailInput: string, ip: string | null) {
  const email = emailInput.trim().toLowerCase();
  await assertRateLimit(`reset:email:${email}`, 3, 60 * 60);
  if (ip) await assertRateLimit(`reset:ip:${ip}`, 20, 60 * 60);
  const user = await findUserByEmail(email);
  if (!user || !user.isActive) return;
  const url = await createPasswordResetLink(user.id, null, 60);
  await sendMail({
    to: user.email,
    subject: `Reset your ${env().APP_NAME} password`,
    text: `Hi ${user.name},\n\nUse this link within 60 minutes to choose a new password:\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) throw new ValidationError("This reset link is invalid or has expired. Ask for a new one.");

  const passwordHash = await hashPassword(newPassword);
  const userId = await db.transaction(async (tx) => {
    // Claim the token atomically so it can't be used twice.
    const claimed = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });
    if (!claimed.length) throw new ValidationError("This reset link has already been used.");
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: false, passwordChangedAt: new Date() })
      .where(eq(users.id, row.userId));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
    return row.userId;
  });

  const [client] = await db.select({ id: clients.id, coachId: clients.coachId }).from(clients).where(eq(clients.userId, userId)).limit(1);
  await logActivity({
    actorId: userId,
    clientId: client?.id ?? null,
    coachId: client?.coachId ?? userId,
    action: "auth.password_reset",
    entityType: "user",
    entityId: userId,
  });
  return userId;
}
