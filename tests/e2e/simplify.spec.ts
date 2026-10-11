import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { STATE_PATH } from "./global-setup";
import { COACH, newSession, seedIds, APP_UA } from "./helpers";

let ids: Awaited<ReturnType<typeof seedIds>>;
test.beforeAll(async ({ browser }) => {
  ids = await seedIds(browser);
});

test("opening animation plays once per session, without hydration errors", async ({ browser }) => {
  const context = await browser.newContext({ storageState: STATE_PATH, reducedMotion: "no-preference", userAgent: APP_UA });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/login");
  const splash = page.locator(".ca-splash");
  await expect(splash).toBeVisible();
  await expect(splash).toBeHidden({ timeout: 8000 });
  await expect(page.locator("#email")).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-splash", "off");
  await expect(splash).toBeHidden();
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  await context.close();
});

test("client page: one Settings tab holds permissions; activity tab and app units are gone", async ({ browser }) => {
  const { context, page } = await newSession(browser, COACH);
  await page.goto(`/coach/clients/${ids.a}`);
  const tabs = page.getByRole("navigation", { name: "Sections" });
  await expect(tabs.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Photos" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Activity" })).toHaveCount(0);
  await expect(tabs.getByRole("link", { name: "Permissions" })).toHaveCount(0);

  // Old links keep working.
  await page.goto(`/coach/clients/${ids.a}/permissions`);
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Permissions" })).toBeVisible();

  await page.goto("/coach/settings");
  await expect(page.locator('select[name="timezone"]')).toHaveCount(0);
  await expect(page.locator('[name="weightUnit"]')).toHaveCount(0);
  await context.close();
});

test("meal editor keeps nutrition values optional", async ({ browser }) => {
  const { context, page } = await newSession(browser, COACH);
  await page.goto(`/coach/clients/${ids.a}/nutrition`);
  await expect(page.getByRole("button", { name: "Nutrition values (optional)" }).first()).toBeVisible();
  await context.close();
});

test("coach uploads several «before» photos (body + InBody) in one go", async ({ browser }) => {
  const { context, page } = await newSession(browser, COACH);
  await page.goto(`/coach/clients/${ids.a}/photos`);
  const before = page.getByRole("region", { name: /^Before/ });
  await expect(before).toBeVisible();
  await expect(page.getByRole("region", { name: /^After/ })).toBeVisible();
  const startCount = await before.getByRole("listitem").count();

  const png = (color: string) =>
    sharp({ create: { width: 300, height: 400, channels: 3, background: color } })
      .png()
      .toBuffer();
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) await before.getByRole("button", { name: "Add" }).click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(dialog.getByRole("button", { name: "Before" })).toHaveAttribute("aria-pressed", "true");
  await dialog.locator("input[type=file]").setInputFiles([
    { name: "front.png", mimeType: "image/png", buffer: await png("#7a9a3a") },
    { name: "inbody.png", mimeType: "image/png", buffer: await png("#dddddd") },
  ]);
  await dialog.getByRole("combobox", { name: "Type" }).nth(1).selectOption("inbody");
  await dialog.getByRole("button", { name: "Upload (2)" }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(before.getByRole("listitem")).toHaveCount(startCount + 2);
  await expect(before.getByText("InBody").first()).toBeVisible();
  await context.close();
});
