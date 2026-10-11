import { expect, test } from "@playwright/test";
import { ACCESS_CODE, STATE_PATH } from "./global-setup";
import { COACH, newSession, APP_UA } from "./helpers";

// Runs last (file order): rotating the code invalidates the shared access cookie of earlier specs.
test("changing the access code locks out every other device until it enters the new code", async ({ browser }) => {
  const coach = await newSession(browser, COACH);
  const other = await browser.newContext({ storageState: STATE_PATH, reducedMotion: "reduce", userAgent: APP_UA });
  const otherPage = await other.newPage();
  await otherPage.goto("/login");
  await expect(otherPage).toHaveURL(/\/login/);

  await coach.page.goto("/coach/settings");
  await coach.page.fill("#access-code", "TEMP-CODE-77");
  await coach.page.getByRole("button", { name: "Save access code" }).click();
  await expect(coach.page.getByText(/Access code updated/)).toBeVisible();

  await otherPage.goto("/login");
  await expect(otherPage).toHaveURL(/\/access/);
  await coach.page.reload(); // the coach's own device keeps working
  await expect(coach.page.getByText("Access code is ON")).toBeVisible();

  // Restore the demo code and refresh the shared test state for the remaining specs.
  await coach.page.fill("#access-code", ACCESS_CODE);
  await coach.page.getByRole("button", { name: "Save access code" }).click();
  await expect(coach.page.getByText(/Access code updated/)).toBeVisible();
  await otherPage.goto("/access");
  await otherPage.fill("#code", ACCESS_CODE);
  await Promise.all([otherPage.waitForURL(/\/login/), otherPage.click("button[type=submit]")]);
  await other.storageState({ path: STATE_PATH });
  await other.close();
  await coach.context.close();
});
