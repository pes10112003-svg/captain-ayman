import "server-only";
import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError } from "./errors";

/** Turns authorization failures in page data-loading into a 404 (never leaks other clients' data). */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound();
    throw err;
  }
}
