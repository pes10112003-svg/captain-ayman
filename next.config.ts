import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(isProd && process.env.APP_URL?.startsWith("https://")
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // Self-hosting (Docker) uses the standalone server; Vercel builds its own output.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2", "sharp", "pg"],
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME ?? "Captain Ayman",
    NEXT_PUBLIC_APP_NAME_AR: process.env.APP_NAME_AR ?? "كابتن أيمن",
  },
  experimental: {
    // Progress photos are uploaded through server actions (validated & re-encoded server-side).
    serverActions: { bodySizeLimit: "12mb" },
    proxyClientMaxBodySize: "12mb",
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
