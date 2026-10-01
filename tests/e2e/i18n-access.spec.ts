import { expect, test } from "@playwright/test";
import { ACCESS_CODE } from "./global-setup";

test.describe("site access code & Arabic default", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // a brand-new device

  test("a new device sees only the access page — in Arabic, right-to-left", async ({ page }) => {
    for (const path of ["/", "/login", "/coach", "/client/workout", "/forgot-password"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/access/);
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "أدخل كود الدخول" })).toBeVisible();

    await page.fill("#code", "WRONG-CODE");
    await page.click("button[type=submit]");
    await expect(page.getByText("كود الدخول غير صحيح.")).toBeVisible();

    // APIs are closed too, even with a guessed path.
    const api = await page.request.get("/api/v1/search?q=a");
    expect(api.status()).toBe(401);

    await page.fill("#code", ACCESS_CODE.toLowerCase()); // case-insensitive
    // …and the visitor continues to the page they originally asked for.
    await Promise.all([page.waitForURL(/\/forgot-password/), page.click("button[type=submit]")]);
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
  });

  test("language and theme switches apply instantly and are remembered", async ({ page }) => {
    await page.goto("/access");
    await page.fill("#code", ACCESS_CODE);
    await Promise.all([page.waitForURL(/\/login/), page.click("button[type=submit]")]);
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
