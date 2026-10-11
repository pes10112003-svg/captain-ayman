/**
 * The Android app (android/) is a thin shell around this site. It adds this mark to its
 * User-Agent and blocks screenshots on the phone. Android browsers can't open the site at all
 * (src/proxy.ts sends them to /get-app); iPhones use the browser (there's no iPhone app).
 * On computers the coach works as usual, while client pages still need the app or an iPhone.
 *
 * Not a security boundary (a User-Agent can be faked) — it keeps ordinary clients inside the
 * screenshot-proof app. Authorization is unchanged and happens on the server for every request.
 */
export const APP_UA_MARK = "CaptainAymanApp/";
export const APP_PACKAGE = "com.captainayman.app";
export const APK_PATH = "/downloads/captain-ayman.apk";
/** Bump together with android/VERSION when a new APK is published, so older apps offer the update. */
export const APP_LATEST_VERSION = 1;

export type ClientDevice = "app" | "ios" | "android" | "other";

export function clientDevice(userAgent: string | null | undefined): ClientDevice {
  const ua = userAgent ?? "";
  if (ua.includes(APP_UA_MARK)) return "app";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export const clientAreaAllowed = (userAgent: string | null | undefined) => {
  const d = clientDevice(userAgent);
  return d === "app" || d === "ios";
};

/** The installed app's version from its User-Agent ("CaptainAymanApp/1"), or null outside the app. */
export function appVersion(userAgent: string | null | undefined): number | null {
  const m = (userAgent ?? "").match(/CaptainAymanApp\/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Opens the installed app at `path` from Android Chrome (falls back to the APK download). */
export function appIntentUrl(host: string, path: string) {
  const fallback = encodeURIComponent(`https://${host}${APK_PATH}`);
  return `intent://${host}${path}#Intent;scheme=https;package=${APP_PACKAGE};S.browser_fallback_url=${fallback};end`;
}
