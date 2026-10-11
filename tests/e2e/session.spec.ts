import { expect, test } from "@playwright/test";
import { CLIENT_A, newSession } from "./helpers";

test("the sign-in cookie is renewed on every page load, and signing out still ends it", async ({ browser }) => {
  const { context, page } = await newSession(browser, CLIENT_A);
  const res = await page.goto("/client");
  const setCookie = (await res!.allHeaders())["set-cookie"] ?? "";
  expect(setCookie).toMatch(/kinetic_session=.*Max-Age=2592000/i); // 30 more days from now

  await page.goto("/client/profile");
  await Promise.all([page.waitForURL(/\/login/), page.getByRole("button", { name: "Sign out" }).click()]);
  await page.goto("/client");
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});
