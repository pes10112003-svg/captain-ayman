"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { APK_PATH, APP_LATEST_VERSION } from "@/lib/app-shell";
import type { MealReminders } from "@/server/services/nutrition";

/** Methods the Android app (android/src/.../MainActivity.java) exposes to the page. */
type AppApi = { setMealReminders?: (json: string) => void; version?: () => string };
declare global {
  interface Window {
    CaptainAymanApp?: AppApi;
  }
}

/**
 * Talks to the Android app when the page runs inside it (no-op in browsers):
 * hands over today's meal schedule so the phone reminds the client at each meal time
 * (an empty list clears them), and offers an update when the installed app is older than the latest APK.
 */
export function AppBridge({ reminders }: { reminders: MealReminders | null }) {
  const { t } = useI18n();
  const json = JSON.stringify(reminders ?? { tz: "Africa/Cairo", meals: [] });

  useEffect(() => {
    try {
      window.CaptainAymanApp?.setMealReminders?.(json);
    } catch {
      /* older app without reminders */
    }
  }, [json]);

  useEffect(() => {
    const app = window.CaptainAymanApp;
    if (!app) return;
    const installed = Number(app.version?.() ?? 0);
    if (installed >= APP_LATEST_VERSION) return;
    try {
      if (sessionStorage.getItem("ca-app-update")) return;
      sessionStorage.setItem("ca-app-update", "1");
    } catch {
      /* storage unavailable */
    }
    toast(t.app.updateTitle, {
      description: t.app.updateText,
      duration: 15000,
      action: { label: t.app.updateAction, onClick: () => window.location.assign(APK_PATH) },
    });
  }, [t]);

  return null;
}

/** Clears reminders when nobody is signed in as a client (login screens). */
export function AppBridgeSignedOut() {
  useEffect(() => {
    try {
      window.CaptainAymanApp?.setMealReminders?.(JSON.stringify({ tz: "Africa/Cairo", meals: [] }));
    } catch {
      /* not in the app */
    }
  }, []);
  return null;
}
