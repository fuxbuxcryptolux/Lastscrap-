/**
 * End-to-end test: Boss Rush score-entry panel.
 *
 * Drives the live Expo web build at http://localhost:80 using
 * window.__testHooks to bypass playing through combat.
 *
 * Covers:
 *   1. The score-entry panel ([ BOSS RUSH LEADERBOARD ]) appears after a
 *      Boss Rush game over with wavesCleared > 0.
 *   2. The panel shows the correct wave count.
 *   3. The SUBMIT and SKIP buttons are visible and interactive.
 */
import { test, expect } from "@playwright/test";

const BOSS_RUSH_URL = "/game?newGame=1&gameMode=boss-rush";

async function waitForGameReady(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () =>
      typeof (window as any).__testHooks !== "undefined" &&
      (window as any).__testHooks.isReady() === true,
    { timeout: 20_000 },
  );
}

// ---------------------------------------------------------------------------
// Scenario 1: Score-entry panel appears after Boss Rush game over
// ---------------------------------------------------------------------------
test("score-entry panel appears after Boss Rush game over", async ({
  page,
}) => {
  await page.goto(BOSS_RUSH_URL);
  await waitForGameReady(page);

  // Trigger a Boss Rush game over with 3 waves cleared
  await page.evaluate(() => {
    (window as any).__testHooks.triggerBossRushGameOver(3, 15, 500);
  });

  // Allow React to flush the state update
  await page.waitForTimeout(400);

  // The leaderboard tag must be visible
  await expect(page.getByText("[ BOSS RUSH LEADERBOARD ]")).toBeVisible();

  // The "SUBMIT SCORE" heading must appear
  await expect(page.getByText("SUBMIT SCORE")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Scenario 2: Panel displays the correct wave count
// ---------------------------------------------------------------------------
test("score-entry panel shows correct wave number", async ({ page }) => {
  await page.goto(BOSS_RUSH_URL);
  await waitForGameReady(page);

  await page.evaluate(() => {
    (window as any).__testHooks.triggerBossRushGameOver(7, 42, 1200);
  });

  await page.waitForTimeout(400);

  // "WAVE 7" must appear in the panel
  await expect(page.getByText("WAVE 7")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Scenario 3: SUBMIT and SKIP buttons are both present
// ---------------------------------------------------------------------------
test("score-entry panel has SUBMIT and SKIP buttons", async ({ page }) => {
  await page.goto(BOSS_RUSH_URL);
  await waitForGameReady(page);

  await page.evaluate(() => {
    (window as any).__testHooks.triggerBossRushGameOver(2, 8, 300);
  });

  await page.waitForTimeout(400);

  await expect(page.getByText("SUBMIT ▸")).toBeVisible();
  await expect(page.getByText("SKIP")).toBeVisible();
});
