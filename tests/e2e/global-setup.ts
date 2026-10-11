import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const STATE_PATH = "tests/e2e/.auth/state.json";

/** Saves the English-UI cookie for every test context. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
  const url = new URL(baseURL);
  await context.addCookies([{ name: "ca_locale", value: "en", domain: url.hostname, path: "/" }]);
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  await context.storageState({ path: STATE_PATH });
  await browser.close();
}
