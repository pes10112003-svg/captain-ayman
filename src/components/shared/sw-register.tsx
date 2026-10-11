"use client";

import { useEffect } from "react";
import { APP_UA_MARK } from "@/lib/app-shell";

/** Registers the PWA service worker (static-asset cache + offline page; never caches private data). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Not inside the Android app: it has its own offline screen, and requests a service worker
    // makes don't carry the app's User-Agent mark, so client pages would think it's a browser.
    if (navigator.userAgent.includes(APP_UA_MARK)) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => undefined);
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
