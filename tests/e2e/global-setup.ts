import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const STATE_PATH = "tests/e2e/.auth/state.json";
export const ACCESS_CODE = process.env.E2E_ACCESS_CODE ?? "AYMAN-2026";

/** Enters the site access code once and saves the cookies (access + English UI) for every test context. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
  const url = new URL(baseURL);
  await context.addCookies([{ name: "ca_locale", value: "en", domain: url.hostname, path: "/" }]);
  const page = await context.newPage();
  await page.goto("/login");
  if (new URL(page.url()).pathname === "/access") {
    await page.fill("#code", ACCESS_CODE);
    await Promise.all([page.waitForURL((u) => u.pathname === "/login"), page.click("button[type=submit]")]);
  }
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  await context.storageState({ path: STATE_PATH });
  await browser.close();
}
