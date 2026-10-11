import { expect, test } from "@playwright/test";

test.describe("Arabic default, straight to sign-in", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // a brand-new device

  test("a new device lands on sign-in — in Arabic, right-to-left; private pages and APIs stay closed", async ({ page }) => {
    for (const path of ["/", "/access", "/coach", "/client/workout"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "أهلًا بعودتك" })).toBeVisible();
    const api = await page.request.get("/api/v1/search?q=a");
    expect(api.status()).toBe(401);
  });

  test("language and theme switches apply instantly and are remembered", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /English/ }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await page.getByRole("button", { name: /Theme/ }).click();
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme === "dark" || theme === "light").toBe(true);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
  });
});
