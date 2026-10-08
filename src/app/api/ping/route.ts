import { NextResponse } from "next/server";

/**
 * Keep-warm ping (no database): an external scheduler can call this every few minutes so the
 * server doesn't fall asleep between clients. It deliberately doesn't touch the database, so it
 * doesn't keep the free Neon compute awake (that has a monthly hour budget).
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
