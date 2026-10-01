import { expect, test } from "@playwright/test";
import { CLIENT_A, CLIENT_B, COACH, newSession, seedIds } from "./helpers";

let ids: Awaited<ReturnType<typeof seedIds>>;
test.beforeAll(async ({ browser }) => {
  ids = await seedIds(browser);
});

test("unauthenticated requests are rejected everywhere", async ({ request, page }) => {
  expect((await request.get(`/api/v1/clients/${ids.a}`)).status()).toBe(401);
  expect((await request.get(`/api/media/photos/${ids.aPhoto}?size=thumb`)).status()).toBe(401);
  expect((await request.post(`/api/v1/me/meals/${ids.bMealLog}`, { data: { consumed: true } })).status()).toBe(401);
  await page.goto(`/coach/clients/${ids.a}`);
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/client/workout");
  await expect(page).toHaveURL(/\/login/);
});

test("coach can access every client of theirs", async ({ browser }) => {
  const { context, page } = await newSession(browser, COACH);
  for (const id of [ids.a, ids.b]) {
    expect((await page.request.get(`/api/v1/clients/${id}`)).status()).toBe(200);
    expect((await page.request.get(`/api/v1/clients/${id}/workout-logs`)).status()).toBe(200);
  }
  expect((await page.request.get(`/api/media/photos/${ids.bPhoto}?size=thumb`)).status()).toBe(200);
  await page.goto(`/coach/clients/${ids.b}`);
  await expect(page.getByRole("heading", { name: CLIENT_B.name })).toBeVisible();
  await context.close();
});

test("client A cannot reach client B by editing URLs or API ids", async ({ browser }) => {
  const { context, page } = await newSession(browser, CLIENT_A);
  // Own data works
  expect((await page.request.get(`/api/v1/clients/${ids.a}`)).status()).toBe(200);
  expect((await page.request.get(`/api/media/photos/${ids.aPhoto}?size=thumb`)).status()).toBe(200);

  // Every B resource is a 404 (existence is not even revealed)
  for (const path of ["", "/workout-logs", "/meal-logs", "/measurements", "/photos"]) {
    const res = await page.request.get(`/api/v1/clients/${ids.b}${path}`);
    expect(res.status(), path).toBe(404);
    expect(await res.text()).not.toContain(CLIENT_B.name);
  }
  expect((await page.request.get(`/api/media/photos/${ids.bPhoto}?size=full`)).status()).toBe(404);
  expect((await page.request.get(`/api/media/avatars/${ids.b}`)).status()).toBe(404);
  expect((await page.request.post(`/api/v1/me/meals/${ids.bMealLog}`, { data: { consumed: true } })).status()).toBe(404);

  // Coach-only API and pages
  expect((await page.request.get(`/api/v1/search?q=Mariam`)).status()).toBe(403);
  await page.goto(`/coach/clients/${ids.b}`);
  await expect(page).toHaveURL(/\/client$/);
  expect(await page.content()).not.toContain(CLIENT_B.name);
  await context.close();
});

test("cross-site state-changing API calls are blocked", async ({ browser }) => {
  const { context, page } = await newSession(browser, CLIENT_A);
  const res = await page.request.post(`/api/v1/me/meals/${ids.bMealLog}`, {
    data: { consumed: true },
    headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
  });
  expect(res.status()).toBe(403);
  await context.close();
});

test("security headers and private caching are set", async ({ browser }) => {
  const { context, page } = await newSession(browser, COACH);
  const html = await page.request.get("/coach");
  const h = html.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  const img = await page.request.get(`/api/media/photos/${ids.aPhoto}?size=thumb`);
  expect(img.headers()["cache-control"]).toContain("private");
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name.includes("kinetic_session"))!;
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe("Lax");
  await context.close();
});

test("login is rate limited", async ({ page }) => {
  for (let i = 0; i < 9; i++) {
    await page.goto("/login");
    await page.fill("#email", "nobody@kinetic.test");
    await page.fill("#password", `wrong-${i}`);
    await page.click("button[type=submit]");
    await expect(page.getByText(/Invalid email or password|Too many attempts/)).toBeVisible();
  }
  await expect(page.getByText(/Too many attempts/)).toBeVisible();
});
