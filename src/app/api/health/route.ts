import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/** Liveness/readiness probe for load balancers. Exposes no data. */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
