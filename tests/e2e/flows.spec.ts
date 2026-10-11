import { expect, test } from "@playwright/test";
import { CLIENT_A, COACH, newSession, seedIds } from "./helpers";

let ids: Awaited<ReturnType<typeof seedIds>>;
test.beforeAll(async ({ browser }) => {
  ids = await seedIds(browser);
});

test("@mobile client logs a full set, a partial set and a meal — coach sees exact results", async ({ browser }) => {
  const { context, page } = await newSession(browser, CLIENT_A);
  await page.goto("/client/workout");
  await expect(page.getByRole("list", { name: "Exercises" })).toBeVisible();

  // Tick set 1 of the first exercise at full target reps.
  const firstExercise = page.getByRole("list", { name: "Exercises" }).getByRole("listitem").first();
  const set1 = firstExercise.getByRole("button", { name: /Mark set 1 as done|Set 1 done/ });
  if ((await set1.getAttribute("aria-pressed")) === "true") {
    await set1.click(); // start clean
    await expect(set1).toHaveAttribute("aria-pressed", "false");
  }
  // Full target reps (the stepper may still hold a partial value from an earlier run / seed data).
  const mine = (await (await page.request.get("/api/v1/me/today")).json()) as { workout: { log: { exercises: { sets: { targetReps: number }[] }[] } } };
  await firstExercise.getByLabel("Reps completed, set 1").fill(String(mine.workout.log.exercises[0]!.sets[0]!.targetReps));
  await set1.click();
  await expect(firstExercise.getByRole("button", { name: /Set 1 done/ })).toHaveAttribute("aria-pressed", "true");

  // Set 2 → only 8 reps: set the stepper then tick.
  const set2 = firstExercise.getByRole("button", { name: /Mark set 2 as done|Set 2 done/ });
  if ((await set2.getAttribute("aria-pressed")) === "true") {
    await set2.click(); // start clean (re-runs on the same seed)
    await expect(set2).toHaveAttribute("aria-pressed", "false");
  }
  await firstExercise.getByLabel("Reps completed, set 2").fill("8");
  await set2.click();
  await expect(firstExercise.getByRole("button", { name: /Set 2 done/ })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);

  // Meal: tap "Mark as eaten" — no time input exists; the server stamps it.
  await page.goto("/client/nutrition");
  await expect(page.getByRole("list", { name: "Meals" })).toBeVisible();
  if ((await page.getByRole("button", { name: "Mark as eaten" }).count()) === 0) {
    await page.getByRole("button", { name: "Undo" }).first().click(); // re-runs: free up a meal
    await expect(page.getByRole("button", { name: "Mark as eaten" }).first()).toBeVisible();
  }
  const before = Date.now();
  await page.getByRole("button", { name: "Mark as eaten" }).first().click();
  await expect(page.getByText(/Eaten at/).first()).toBeVisible();
  await context.close();

  // Coach verifies via the API.
  const coach = await newSession(browser, COACH);
  const logs = await (await coach.page.request.get(`/api/v1/clients/${ids.a}/workout-logs`)).json();
  const today = logs.today as string;
  const todayLog = logs.logs.find((l: { date: string }) => l.date === today);
  const sets = todayLog.exercises[0].sets;
  expect(sets[0]).toMatchObject({ status: "completed", actualReps: sets[0].targetReps });
  expect(sets[1]).toMatchObject({ status: "partial", actualReps: 8 });
  expect(sets[1].completedAt).toBeTruthy();

  const meals = await (await coach.page.request.get(`/api/v1/clients/${ids.a}/meal-logs?days=1`)).json();
  const eaten = meals.groups[0].logs.filter((l: { consumedAt: string | null }) => l.consumedAt);
  expect(eaten.length).toBeGreaterThan(0);
  const latest = Math.max(...eaten.map((l: { consumedAt: string }) => Date.parse(l.consumedAt)));
  expect(latest).toBeGreaterThanOrEqual(before - 5000);
  expect(latest).toBeLessThanOrEqual(Date.now() + 5000);

  // And in the coach UI
  await coach.page.goto(`/coach/clients/${ids.a}/nutrition/history`);
  await expect(coach.page.getByText("Completed").first()).toBeVisible();
  await coach.context.close();
});

test("coach disables a client → their live session stops working immediately", async ({ browser }) => {
  const client = await newSession(browser, CLIENT_A);
  expect((await client.page.request.get(`/api/v1/clients/${ids.a}`)).status()).toBe(200);

  const coach = await newSession(browser, COACH);
  await coach.page.goto(`/coach/clients/${ids.a}/settings`);
  await coach.page.getByRole("button", { name: "Disable account" }).click();
  await coach.page.getByRole("dialog").getByRole("button", { name: "Disable account" }).click();
  await expect(coach.page.getByRole("button", { name: "Re-activate account" })).toBeVisible();

  expect((await client.page.request.get(`/api/v1/clients/${ids.a}`)).status()).toBe(401);

  // Restore for other tests.
  await coach.page.getByRole("button", { name: "Re-activate account" }).click();
  await coach.page.getByRole("dialog").getByRole("button", { name: "Re-activate" }).click();
  await expect(coach.page.getByRole("button", { name: "Disable account" })).toBeVisible();
  await coach.context.close();
  await client.context.close();
});

test("coach creates a client with 'choose own password' on, who must set a password at first sign-in", async ({ browser, page }) => {
  const coach = await newSession(browser, COACH);
  const email = `e2e-${Date.now()}@kinetic.test`;
  await coach.page.goto("/coach/clients/new");
  await coach.page.fill("#fullName", "E2E Tester");
  await coach.page.fill("#email", email);
  await coach.page.fill("#startingWeight", "70");
  await coach.page.getByLabel(/choose their own password/).check();
  await coach.page.getByRole("button", { name: "Create client" }).click();
  await expect(coach.page.getByText("Client account created")).toBeVisible();
  const temp = (await coach.page.locator("p.font-mono.text-base").textContent())!.trim();
  await coach.context.close();

  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", temp);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/change-password/);
  await page.goto("/client");
  await expect(page).toHaveURL(/\/change-password/); // can't skip it
  await page.fill("#newPassword", "MyOwnPass!2026");
  await page.fill("#confirmPassword", "MyOwnPass!2026");
  await page.getByRole("button", { name: /Save & continue/ }).click();
  await expect(page).toHaveURL(/\/client$/);
  await expect(page.getByText("No workout assigned for today.")).toBeVisible();
});

test("coach sets the client's password; client signs in directly and can't change it by default", async ({ browser, page }) => {
  const coach = await newSession(browser, COACH);
  const email = `e2e-set-${Date.now()}@kinetic.test`;
  await coach.page.goto("/coach/clients/new");
  await coach.page.fill("#fullName", "Set Password");
  await coach.page.fill("#email", email);
  await coach.page.fill("#password", "CoachChose!2026");
  await coach.page.getByRole("button", { name: "Create client" }).click();
  await expect(coach.page.getByText("Client account created")).toBeVisible();
  await expect(coach.page.getByText(/Android phone\? Install the app: .*\/get-app/)).toBeVisible(); // ready-to-send invite message
  await coach.page.getByRole("link", { name: "Open profile" }).click();
  await coach.page.waitForURL(/\/coach\/clients\/[0-9a-f-]{36}$/);
  const clientUrl = coach.page.url();

  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "CoachChose!2026");
  await Promise.all([page.waitForURL(/\/client$/), page.click("button[type=submit]")]);
  await page.goto("/client/profile");
  await expect(page.getByText("Your coach manages your password")).toBeVisible();
  await expect(page.locator("#currentPassword")).toHaveCount(0);

  // The coach sets a new password → the client's session ends and the old password stops working.
  await coach.page.goto(`${clientUrl}/settings`);
  await coach.page.fill("#client-new-password", "Rotated!2026xx");
  await coach.page.getByRole("button", { name: "Set password" }).click();
  await expect(coach.page.getByRole("dialog")).toContainText("Rotated!2026xx");
  await coach.context.close();

  await page.goto("/client");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#email", email);
  await page.fill("#password", "CoachChose!2026");
  await page.click("button[type=submit]");
  await expect(page.getByText(/Invalid email or password/)).toBeVisible();
});
