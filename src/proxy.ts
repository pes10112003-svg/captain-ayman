import { NextResponse, type NextRequest } from "next/server";
import { clientAreaAllowed } from "@/lib/app-shell";

/**
 * Edge of the app: per-request CSP nonce, a pathname hint for post-login redirects, and a fast
 * redirect for obviously unauthenticated visits to protected areas.
 *
 * NOTE: this is a UX shortcut, not the security boundary. Every page, server action and API
 * route re-validates the session and authorizes the specific resource on the server.
 */
const PROTECTED = ["/coach", "/client", "/change-password"];

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_DAYS ?? 30) * 86_400;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = request.cookies.get("__Host-kinetic_session") ?? request.cookies.get("kinetic_session");
  const hasSession = !!sessionCookie;

  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/change-password" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Client pages open only in the Android app or on iPhone (see src/lib/app-shell.ts).
  if ((pathname === "/client" || pathname.startsWith("/client/")) && !clientAreaAllowed(request.headers.get("user-agent"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/get-app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const https = (process.env.APP_URL ?? "").startsWith("https://");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by charts and animations; no inline <script> is ever allowed.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", pathname + search);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  // Keep the sign-in cookie alive while the app is in use (the database session slides too — see
  // resolveSessionToken). Page loads only: never on POSTs, so sign-out's cookie deletion always wins.
  if (sessionCookie && request.method === "GET") {
    response.cookies.set(sessionCookie.name, sessionCookie.value, {
      httpOnly: true,
      secure: sessionCookie.name.startsWith("__Host-") || https,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|icons/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
