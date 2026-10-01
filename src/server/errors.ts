/**
 * Typed application errors. Anything that is not an AppError is treated as an internal
 * failure: it is logged server-side and the user only sees a generic message.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super(message, 403, "forbidden");
  }
}

/** Also used for resources that exist but belong to someone else — avoids leaking existence. */
export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404, "not_found");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the highlighted fields.", fieldErrors?: Record<string, string[]>) {
    super(message, 422, "validation_error", fieldErrors);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}

export class RateLimitError extends AppError {
  constructor(public retryAfterSeconds: number) {
    super(`Too many attempts. Try again in ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute(s).`, 429, "rate_limited");
  }
}

export type SafeError = { status: number; code: string; message: string; fieldErrors?: Record<string, string[]> };

export function toSafeError(err: unknown): SafeError {
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, fieldErrors: err.fieldErrors };
  }
  // Never expose internals (SQL, stack traces, file paths) to the user.
  console.error("[kinetic] unexpected error", err);
  return { status: 500, code: "internal_error", message: "Something went wrong on our side. Please try again." };
}

/** Postgres unique_violation */
export const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
};
