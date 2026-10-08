import { expect, test } from "@playwright/test";
import { CLIENT_A, COACH, newSession } from "./helpers";

test("client pages carry a name watermark and hide on screenshot shortcuts @mobile", async ({ browser }, info) => {
  const { context, page } = await newSession(browser, CLIENT_A);
  await page.goto("/client");
  const mark = page.locator(".ca-watermark");
  await expect(mark).toHaveCount(1);
  const bg = await mark.evaluate((el) => decodeURIComponent(getComputedStyle(el).backgroundImage));
  expect(bg).toContain(CLIENT_A.name);
  expect(await mark.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  await page.screenshot({ path: `test-results/watermark-${info.project.name}.png` });

  if (info.project.name === "desktop") {
    const privacy = () => page.evaluate(() => document.documentElement.dataset.privacy ?? "");
    await page.keyboard.down("Meta");
    await page.keyboard.down("Shift");
    expect(await privacy()).toBe("on");
    expect(await page.evaluate(() => getComputedStyle(document.body).visibility)).toBe("hidden");
    await page.keyboard.up("Shift");
    await page.keyboard.up("Meta");
    await page.mouse.click(5, 300); // back to normal on the next click
    expect(await privacy()).toBe("");
    await page.keyboard.press("PrintScreen");
    expect(await privacy()).toBe("on");
  }
  await context.close();
});

test("the coach area has no watermark", async ({ browser }) => {
  const { context, page } = await newSession(browser, COACH);
  await page.goto("/coach");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator(".ca-watermark")).toHaveCount(0);
  await context.close();
});
