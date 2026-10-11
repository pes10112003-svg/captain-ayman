import { devices, expect, test, type Browser } from "@playwright/test";
import { STATE_PATH } from "./global-setup";
import { APP_UA, CLIENT_A, COACH, login } from "./helpers";

const ANDROID_CHROME = devices["Pixel 7"].userAgent;
const IPHONE_SAFARI = devices["iPhone 13"].userAgent;
const DESKTOP_CHROME = devices["Desktop Chrome"].userAgent;

async function session(browser: Browser, userAgent: string, who: { email: string; password: string } = CLIENT_A, init?: () => void) {
  // Playwright can't fake the User-Agent of service-worker requests (real phones send their own), so keep it out.
  const context = await browser.newContext({ storageState: STATE_PATH, reducedMotion: "reduce", userAgent, serviceWorkers: "block" });
  const page = await context.newPage();
  if (init) await page.addInitScript(init);
  await login(page, who);
  return { context, page };
}

test("client pages open only in the Android app or on iPhone", async ({ browser }) => {
  // Android browser → install page with the APK.
  const android = await session(browser, ANDROID_CHROME);
  await android.page.goto("/client/nutrition");
  await expect(android.page).toHaveURL(/\/get-app$/);
  await expect(android.page.getByRole("link", { name: "Download the app" })).toHaveAttribute("href", "/downloads/captain-ayman.apk");
  await expect(android.page.getByRole("link", { name: /Open the app/ })).toHaveAttribute("href", /^intent:\/\/.*package=com\.captainayman\.app/);
  await android.context.close();

  // Computer → "open it from your phone".
  const desktop = await session(browser, DESKTOP_CHROME);
  await desktop.page.goto("/client");
  await expect(desktop.page).toHaveURL(/\/get-app$/);
  await expect(desktop.page.getByRole("heading", { name: "Open it from your phone" })).toBeVisible();
  await desktop.context.close();

  // iPhone (no Android app there) and the app itself → the client area.
  for (const ua of [IPHONE_SAFARI, APP_UA]) {
    const ok = await session(browser, ua);
    await ok.page.goto("/client/nutrition");
    await expect(ok.page).toHaveURL(/\/client\/nutrition$/);
    await ok.context.close();
  }
});

test("the coach can work from any browser", async ({ browser }) => {
  const coach = await session(browser, ANDROID_CHROME, COACH);
  await coach.page.goto("/coach");
  await expect(coach.page).toHaveURL(/\/coach$/);
  await coach.context.close();
});

test("inside the app, the client's meal times are handed to the phone for reminders", async ({ browser }) => {
  const app = await session(browser, APP_UA, CLIENT_A, () => {
    const w = window as unknown as { __reminders: string[]; CaptainAymanApp: object };
    w.__reminders = [];
    w.CaptainAymanApp = { setMealReminders: (json: string) => w.__reminders.push(json), version: () => "0" };
  });
  // Signing in lands on /client — no reload, so the once-per-session update notice is still on screen.
  await expect(app.page).toHaveURL(/\/client$/);
  await expect.poll(() => app.page.evaluate(() => (window as unknown as { __reminders: string[] }).__reminders.length)).toBeGreaterThan(0);
  const sent = await app.page.evaluate(() => (window as unknown as { __reminders: string[] }).__reminders.at(-1)!);
  const schedule = JSON.parse(sent) as { tz: string; meals: { time: string; title: string; body: string }[] };
  expect(schedule.tz).toBe("Africa/Cairo");
  expect(schedule.meals.length).toBeGreaterThan(0);
  expect(schedule.meals[0]!.time).toMatch(/^\d\d:\d\d$/);
  expect(schedule.meals.map((m) => m.title)).toContain("Time for Lunch");
  // An older app (version 0) is offered the new APK.
  await expect(app.page.getByText("A new version of the app is ready")).toBeVisible();
  await app.context.close();
});

test("site links open in the app (Android App Links file)", async ({ request }) => {
  const res = await request.get("/.well-known/assetlinks.json");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[];
  expect(body[0]!.target.package_name).toBe("com.captainayman.app");
  expect(body[0]!.target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});

test("the APK is downloadable", async ({ request }) => {
  const res = await request.get("/downloads/captain-ayman.apk");
  expect(res.status()).toBe(200);
  const body = await res.body();
  expect(body.subarray(0, 2).toString()).toBe("PK"); // a zip, as every APK is
  expect(body.length).toBeGreaterThan(20_000);
});
