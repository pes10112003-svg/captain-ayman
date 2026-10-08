import { expect, test, type Page } from "@playwright/test";
import { CLIENT_A, COACH, newSession, seedIds } from "./helpers";

let ids: Awaited<ReturnType<typeof seedIds>>;
test.beforeAll(async ({ browser }) => {
  ids = await seedIds(browser);
});

/** The page must never be wider than the phone — otherwise mobile browsers zoom out into "desktop view". */
async function expectFitsWidth(page: Page, label: string) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
  expect(sw, `${label} is wider than the screen`).toBeLessThanOrEqual(w + 1);
}

test("@mobile every coach and client page fits the phone width, even with many workout days", async ({ browser }) => {
  const coach = await newSession(browser, COACH);
  const p = coach.page;
  await p.setViewportSize({ width: 360, height: 780 });
  const base = `/coach/clients/${ids.a}`;
  for (const path of [
    "/coach",
    "/coach/clients",
    "/coach/clients/new",
    "/coach/nutrition",
    "/coach/reports",
    "/coach/settings",
    base,
    `${base}/workouts`,
    `${base}/nutrition`,
    `${base}/progress`,
    `${base}/photos`,
    `${base}/settings`,
  ]) {
    await p.goto(path);
    await expectFitsWidth(p, path);
  }
  await p.goto(`${base}/workouts`);
  const addDay = p.getByRole("button", { name: "Add table (training day)" });
  await expect(async () => {
    await addDay.click();
    await expect(p.getByText("Unsaved changes")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await addDay.click();
  await addDay.click();
  await expectFitsWidth(p, "training sheet with extra tables");
  // The save bar stays on screen.
  const save = p.getByRole("button", { name: "Save plan" });
  await expect(save).toBeInViewport();
  await coach.context.close();

  const client = await newSession(browser, CLIENT_A);
  await client.page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/client", "/client/workout", "/client/nutrition", "/client/progress", "/client/profile"]) {
    await client.page.goto(path);
    await expectFitsWidth(client.page, path);
  }
  await client.context.close();
});
