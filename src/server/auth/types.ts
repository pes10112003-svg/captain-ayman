export type Role = "coach" | "client";

/** The authenticated principal, resolved server-side from the session cookie on every request. */
export type Actor = {
  sessionId: string;
  userId: string;
  role: Role;
  name: string;
  email: string;
  /** For clients: their own client record. Always derived from the session — never from a URL/body. */
  clientId: string | null;
  /** For coaches: themselves. For clients: the coach who owns them. */
  coachId: string;
  mustChangePassword: boolean;
};
