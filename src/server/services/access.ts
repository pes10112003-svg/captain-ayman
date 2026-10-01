import "server-only";
import { assertCoach } from "../authz";
import { logActivity } from "../activity";
import { ValidationError } from "../errors";
import type { Actor } from "../auth/types";
import { getAccessCode, getGateState, isValidNewAccessCode, setAccessCode } from "../auth/gate";

/** Coach-only view of the site access code (decrypted so the coach can share it). */
export async function getAccessSettings(actor: Actor) {
  assertCoach(actor);
  const state = await getGateState(true);
  return { enabled: state.enabled, code: state.enabled ? await getAccessCode() : null };
}

/** Change (or turn off with null) the site access code. Every other device must enter the new code. */
export async function updateAccessCode(actor: Actor, code: string | null) {
  assertCoach(actor);
  const next = code?.trim() || null;
  if (next !== null && !isValidNewAccessCode(next)) {
    throw new ValidationError("Access code must be at least 6 letters or numbers.", { code: ["Access code must be at least 6 letters or numbers."] });
  }
  await setAccessCode(next, actor.userId);
  await logActivity({ actorId: actor.userId, coachId: actor.userId, action: "coach.access_code.changed", entityType: "site", metadata: { enabled: next !== null } });
}
