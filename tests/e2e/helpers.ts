import { expect, type Browser, type Page } from "@playwright/test";
import { STATE_PATH } from "./global-setup";

export const COACH = { email: "coach@kinetic.test", password: "CoachDemo!2026" };
export const CLIENT_A = { email: "omar@kinetic.test", password: "ClientDemo!2026", name: "Omar Hassan" };
export const CLIENT_B = { email: "mariam@kinetic.test", password: "ClientDemo!2026", name: "Mariam Adel" };

export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
}

export async function newSession(browser: Browser, who: { email: string; password: string }) {
  const context = await browser.newContext({ storageState: STATE_PATH, reducedMotion: "reduce" });
  const page = await context.newPage();
  await login(page, who);
  return { context, page };
}

/** Resolve seed ids through the coach's own API (coach can see all of their clients). */
export async function seedIds(browser: Browser) {
  const { context, page } = await newSession(browser, COACH);
  const find = async (q: string) => {
    const res = await page.request.get(`/api/v1/search?q=${encodeURIComponent(q)}`);
    expect(res.status()).toBe(200);
    return ((await res.json()) as { results: { id: string; fullName: string }[] }).results.find((r) => r.fullName === q)!.id;
  };
  const a = await find(CLIENT_A.name);
  const b = await find(CLIENT_B.name);
  const bPhotos = (await (await page.request.get(`/api/v1/clients/${b}/photos`)).json()) as { photos: { id: string }[] };
  const aPhotos = (await (await page.request.get(`/api/v1/clients/${a}/photos`)).json()) as { photos: { id: string }[] };
  const bMeals = (await (await page.request.get(`/api/v1/clients/${b}/meal-logs?days=3`)).json()) as { groups: { logs: { id: string }[] }[] };
  await context.close();
  return { a, b, bPhoto: bPhotos.photos[0]!.id, aPhoto: aPhotos.photos[0]!.id, bMealLog: bMeals.groups[0]!.logs[0]!.id };
}
