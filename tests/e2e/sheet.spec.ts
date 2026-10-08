import { expect, test } from "@playwright/test";
import { CLIENT_A, COACH, newSession, seedIds } from "./helpers";

let ids: Awaited<ReturnType<typeof seedIds>>;
test.beforeAll(async ({ browser }) => {
  ids = await seedIds(browser);
});

test("coach builds a training-sheet table (weeks stacked) and the client trains this week's numbers", async ({ browser }) => {
  const coach = await newSession(browser, COACH);
  const p = coach.page;
  await p.goto(`/coach/clients/${ids.a}/workouts`);

  // The seeded plan is a 3-week sheet: every table shows Week (1)…(3) under each other.
  const first = p.locator("section[data-sheet-table]").first();
  await expect(first.getByText("Week (3)")).toBeVisible();
  await expect(p.getByText(/Now: week 2 of 3/)).toBeVisible();

  // Add a new table (= a new training day) with one exercise and numbers for week 2 (this week).
  const addTable = p.getByRole("button", { name: "Add table (training day)" });
  await expect(async () => {
    await addTable.click();
    await expect(p.getByText("Unsaved changes")).toBeVisible({ timeout: 1000 });
  }).toPass();
  const table = p.locator("section[data-sheet-table]").last();
  await table.getByLabel("Day name").fill("ARMS");
  await table.getByLabel("Exercise name").first().fill("Hammer Curl");
  for (const week of [1, 2, 3]) {
    await table.getByLabel(`Hammer Curl · Week (${week}) · set 1 · wt`).fill(String(10 + week));
    await table.getByLabel(`Hammer Curl · Week (${week}) · set 1 · Rep`).fill("12");
  }
  // Train it on Fridays.
  await table.getByRole("button", { name: "Fri", exact: true }).click();
  await expect(table.getByRole("button", { name: "Fri", exact: true })).toHaveAttribute("aria-pressed", "true");
  await p.getByRole("button", { name: "Save plan" }).click();
  await expect(p.getByText("Workout plan saved", { exact: false })).toBeVisible();

  // Saved: after a reload the table and its numbers are still there.
  await p.reload();
  const saved = p.locator("section[data-sheet-table][aria-label='ARMS']");
  await expect(saved).toBeVisible();
  await expect(saved.getByLabel("Hammer Curl · Week (2) · set 1 · wt")).toHaveValue("12");
  await expect(saved.getByRole("button", { name: "Fri", exact: true })).toHaveAttribute("aria-pressed", "true");
  await coach.context.close();

  // The client's workout shows which week of the cycle they're in.
  const client = await newSession(browser, CLIENT_A);
  await client.page.goto("/client/workout");
  await expect(client.page.getByText("Week 2 of 3")).toBeVisible();
  await client.context.close();
});
