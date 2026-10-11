import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a running app with the demo seed loaded:
 *   npm run db:reset && npm run build && npm start   (or npm run dev)
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Access-code cookie + English UI (tests assert English labels; Arabic is covered in i18n.spec.ts).
    storageState: "tests/e2e/.auth/state.json",
    trace: "retain-on-failure",
    // Skip the opening splash & entrance animations (covered on their own in simplify.spec.ts).
    contextOptions: { reducedMotion: "reduce" },
    // Requests made by a service worker can't carry a test User-Agent.
    serviceWorkers: "block",
  },
  projects: [
    // Client pages only open in the Android app (its User-Agent carries "CaptainAymanApp/") or on iPhone.
    { name: "desktop", use: { ...devices["Desktop Chrome"], userAgent: `${devices["Desktop Chrome"].userAgent} CaptainAymanApp/1` } },
    { name: "mobile", use: { ...devices["Pixel 7"], userAgent: `${devices["Pixel 7"].userAgent} CaptainAymanApp/1` }, grep: /@mobile/ },
  ],
});
