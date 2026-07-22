/**
 * End-to-end tests for the bounty system.
 *
 * These tests drive the live Expo web build (served at http://localhost:80)
 * using window.__testHooks — a dev-only API exposed by game.tsx that lets
 * tests manipulate game state without playing through combat.
 *
 * Covers:
 *   1. HUD bounty panel shows completed state after kills
 *   2. UpgradeShop BOUNTIES tab lists exactly 3 bounties
 *   3. GHOST PROTOCOL bounty completes after an undamaged wave clear
 */
import { test, expect } from "@playwright/test";

const GAME_URL = "/game?newGame=1&gameMode=rig-defense";

/** Wait for window.__testHooks.isReady() to return true (game loop initialised). */
async function waitForGameReady(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () =>
      typeof (window as any).__testHooks !== "undefined" &&
      (window as any).__testHooks.isReady() === true,
    { timeout: 20_000 },
  );
}

// ---------------------------------------------------------------------------
// Scenario 1: HUD bounty panel shows completed state after kills
// ---------------------------------------------------------------------------
test("bounty panel shows completed state after triggering enough kills", async ({
  page,
}) => {
  await page.goto(GAME_URL);
  await waitForGameReady(page);

  // Inject BODY COUNT (kill_15) if not already drawn, then complete it.
  await page.evaluate(() => {
    (window as any).__testHooks.ensureBounty("kill_15");
    (window as any).__testHooks.triggerKills(15);
  });

  // Allow React to flush the re-render.
  await page.waitForTimeout(400);

  // Open the bounty panel.
  const toggle = page.getByTestId("bounty-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();

  // Verify the panel is open and BODY COUNT shows as completed.
  const panel = page.getByTestId("bounty-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("BODY COUNT");
  await expect(panel).toContainText("✓");
  await expect(panel).toContainText("+15⊙");
});

// ---------------------------------------------------------------------------
// Scenario 2: UpgradeShop BOUNTIES tab lists exactly 3 bounties
// ---------------------------------------------------------------------------
test("UpgradeShop BOUNTIES tab lists exactly 3 bounties", async ({ page }) => {
  await page.goto(GAME_URL);
  await waitForGameReady(page);

  // Jump directly to shop state (skips wave-clear animation / save flows).
  await page.evaluate(() => (window as any).__testHooks.jumpToShop());

  // Wait for the shop overlay to appear.
  const shop = page.getByTestId("upgrade-shop");
  await expect(shop).toBeVisible({ timeout: 5_000 });

  // Navigate to the BOUNTIES tab.
  await page.getByTestId("tab-bounties").click();

  // Section header should show a fraction out of 3.
  await expect(page.getByText(/BOUNTIES · \d\/3 COMPLETE/)).toBeVisible();

  // Exactly 3 status pills should be present.
  const statusPills = page.locator("text=● ACTIVE, text=✓ DONE, text=✕ FAILED");
  // Count all status indicators across the three cards.
  const activeCount = await page.getByText("● ACTIVE").count();
  const doneCount = await page.getByText("✓ DONE").count();
  const failedCount = await page.getByText("✕ FAILED").count();
  const totalPills = activeCount + doneCount + failedCount;
  expect(totalPills).toBe(3);
  void statusPills; // suppress unused-variable warning
});

// ---------------------------------------------------------------------------
// Scenario 3: GHOST PROTOCOL completes after undamaged wave clear
// ---------------------------------------------------------------------------
test("GHOST PROTOCOL bounty is completed after undamaged wave clear", async ({
  page,
}) => {
  await page.goto(GAME_URL);
  await waitForGameReady(page);

  // Ensure GHOST PROTOCOL is in the active bounty list.
  await page.evaluate(() =>
    (window as any).__testHooks.ensureBounty("no_damage_wave"),
  );

  // Trigger an undamaged wave clear.  The game loop (RAF) then calls
  // tickWaveClearBounties and transitions status to "shop" automatically.
  await page.evaluate(() =>
    (window as any).__testHooks.clearWaveUndamaged(),
  );

  // Wait for the game loop to process the waveclear → shop transition.
  await page.waitForFunction(
    () => (window as any).__testHooks?.getStatus?.() === "shop",
    { timeout: 8_000 },
  );
  await page.waitForTimeout(300);

  // Switch to the BOUNTIES tab.
  const shop = page.getByTestId("upgrade-shop");
  await expect(shop).toBeVisible();
  await page.getByTestId("tab-bounties").click();

  // GHOST PROTOCOL card should be marked "✓ DONE".
  const ghostCard = page.locator("text=GHOST PROTOCOL").locator("..");
  await expect(page.getByText("GHOST PROTOCOL")).toBeVisible();

  // Look for "✓ DONE" somewhere on the page (the completed status pill).
  await expect(page.getByText("✓ DONE")).toBeVisible();

  // "● ACTIVE" must NOT appear in the GHOST PROTOCOL card.
  // (Other bounties may still be active — we only care about this one.)
  const ghostSection = page
    .locator("text=GHOST PROTOCOL")
    .locator("xpath=ancestor::*[contains(@class,'card')]")
    .first();

  // Fallback: assert the completed pill is present anywhere on the page.
  // Active pill is allowed elsewhere, but not for GHOST PROTOCOL specifically.
  const allActive = await page.getByText("● ACTIVE").all();
  for (const el of allActive) {
    const parent = el.locator("xpath=ancestor::*[4]");
    const text = await parent.textContent();
    expect(text).not.toContain("GHOST PROTOCOL");
  }
  void ghostCard;
  void ghostSection;
});
