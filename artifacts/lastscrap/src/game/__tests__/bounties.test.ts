import { describe, it, expect, beforeEach } from "vitest";
import {
  createState,
  startWave,
  tick,
  tickBountyProgress,
} from "../engine";
import type { GameState } from "../engine";
import type { GameMode } from "../types";
import {
  drawBounties,
  tickWaveClearBounties,
  awardCompletedBounties,
  createBountyTracking,
  resetWaveBountyTracking,
  BOUNTY_POOL,
} from "../bounties";
import type { Bounty } from "../bounties";

const VP = { w: 390, h: 844 };

function makeState(
  mode: Parameters<typeof createState>[3] = "rig-defense",
): GameState {
  return createState(VP.w, VP.h, "standard", mode);
}

function makeBounty(templateId: string): Bounty {
  const template = BOUNTY_POOL.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown bounty template: ${templateId}`);
  return {
    templateId: template.id,
    name: template.name,
    description: template.description,
    progress: 0,
    target: template.target,
    reward: template.reward,
    state: "active",
    completedWave: null,
    justCompleted: false,
    rewardAwarded: false,
  };
}

function clearWaveInstantly(s: GameState) {
  s.spawnQueue = 0;
  s.zombies = [];
  s.isHorde = false;
  s.hordeWarning = 0;
  s.hordeTimer = 0;
  s.bossWarning = 0;
  s.bossSpawned = true;
}

// ─── drawBounties ─────────────────────────────────────────────────────────────

describe("drawBounties", () => {
  it("always returns exactly 3 bounties", () => {
    const bounties = drawBounties(42);
    expect(bounties).toHaveLength(3);
  });

  it("returns 3 bounties for every standard game mode", () => {
    const modes = ["rig-defense", "boss-rush", "scavenge"] as const;
    for (const mode of modes) {
      const bounties = drawBounties(99, mode);
      expect(bounties).toHaveLength(3);
    }
  });

  it("each drawn bounty starts as active with progress 0", () => {
    const bounties = drawBounties(7);
    for (const b of bounties) {
      expect(b.state).toBe("active");
      expect(b.progress).toBe(0);
      expect(b.rewardAwarded).toBe(false);
      expect(b.completedWave).toBeNull();
      expect(b.justCompleted).toBe(false);
    }
  });

  it("no bounty is drawn twice in the same set", () => {
    const bounties = drawBounties(1234);
    const ids = bounties.map((b) => b.templateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("excludes boss-rush-excluded templates in boss-rush mode", () => {
    const excluded = BOUNTY_POOL.filter((t) =>
      t.excludeModes?.includes("boss-rush"),
    ).map((t) => t.id);

    for (let seed = 0; seed < 100; seed++) {
      const bounties = drawBounties(seed, "boss-rush");
      for (const b of bounties) {
        expect(excluded).not.toContain(b.templateId);
      }
    }
  });

  it("excludes scavenge-excluded templates in scavenge mode", () => {
    const excluded = BOUNTY_POOL.filter((t) =>
      t.excludeModes?.includes("scavenge"),
    ).map((t) => t.id);

    for (let seed = 0; seed < 100; seed++) {
      const bounties = drawBounties(seed, "scavenge");
      for (const b of bounties) {
        expect(excluded).not.toContain(b.templateId);
      }
    }
  });

  it("each bounty has a non-empty name and description", () => {
    const bounties = drawBounties(555);
    for (const b of bounties) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.description.length).toBeGreaterThan(0);
    }
  });

  it("each bounty has a positive reward and target", () => {
    const bounties = drawBounties(555);
    for (const b of bounties) {
      expect(b.reward).toBeGreaterThan(0);
      expect(b.target).toBeGreaterThan(0);
    }
  });
});

// ─── Kill-count bounty (BODY COUNT = 15 kills) ────────────────────────────────

describe("BODY COUNT bounty (total_kills)", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("kill_15")];
  });

  it("starts active with progress 0", () => {
    const b = s.activeBounties[0];
    expect(b.state).toBe("active");
    expect(b.progress).toBe(0);
  });

  it("tracks partial kill progress before completion", () => {
    s.stats.kills = 10;
    tickBountyProgress(s);
    const b = s.activeBounties[0];
    expect(b.state).toBe("active");
    expect(b.progress).toBe(10);
  });

  it("completes when kill count reaches target (15)", () => {
    s.stats.kills = 15;
    tickBountyProgress(s);
    const b = s.activeBounties[0];
    expect(b.state).toBe("completed");
    expect(b.progress).toBe(15);
    expect(b.justCompleted).toBe(true);
    expect(b.completedWave).toBe(s.wave);
  });

  it("completes when kill count exceeds target", () => {
    s.stats.kills = 20;
    tickBountyProgress(s);
    const b = s.activeBounties[0];
    expect(b.state).toBe("completed");
  });

  it("progress is capped at target even when kills exceed it", () => {
    s.stats.kills = 100;
    tickBountyProgress(s);
    const b = s.activeBounties[0];
    expect(b.progress).toBe(b.target);
  });

  it("awards scrap immediately upon completion", () => {
    const scrapBefore = s.scrap;
    s.stats.kills = 15;
    tickBountyProgress(s);
    const b = s.activeBounties[0];
    expect(b.rewardAwarded).toBe(true);
    expect(s.scrap).toBe(scrapBefore + b.reward);
  });

  it("does not award scrap twice on subsequent ticks", () => {
    s.stats.kills = 15;
    tickBountyProgress(s);
    const scrapAfterFirst = s.scrap;
    tickBountyProgress(s);
    expect(s.scrap).toBe(scrapAfterFirst);
  });

  it("CULLING FIELD (kill_30) also completes via total_kills", () => {
    s.activeBounties = [makeBounty("kill_30")];
    s.stats.kills = 30;
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("completed");
  });
});

// ─── Upgrade shop: BOUNTIES tab shows 3 bounties ─────────────────────────────

describe("UpgradeShop BOUNTIES tab: 3 bounties in game state", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("rig-defense");
    startWave(s);
  });

  it("game state has exactly 3 active bounties at wave start", () => {
    expect(s.activeBounties).toHaveLength(3);
  });

  it("all 3 bounties are in active state at wave start", () => {
    for (const b of s.activeBounties) {
      expect(b.state).toBe("active");
    }
  });

  it("each bounty has the required display fields (name, description, target, reward)", () => {
    for (const b of s.activeBounties) {
      expect(typeof b.name).toBe("string");
      expect(b.name.length).toBeGreaterThan(0);
      expect(typeof b.description).toBe("string");
      expect(b.description.length).toBeGreaterThan(0);
      expect(b.target).toBeGreaterThan(0);
      expect(b.reward).toBeGreaterThan(0);
    }
  });

  it("bounties persist through a wave clear and into waveclear status", () => {
    clearWaveInstantly(s);
    tick(s, 0.016);
    expect(s.status).toBe("waveclear");
    expect(s.activeBounties).toHaveLength(3);
  });

  it("each bounty has a templateId matching a BOUNTY_POOL entry", () => {
    const poolIds = new Set(BOUNTY_POOL.map((t) => t.id));
    for (const b of s.activeBounties) {
      expect(poolIds.has(b.templateId)).toBe(true);
    }
  });
});

// ─── GHOST PROTOCOL bounty (no_damage_wave) ───────────────────────────────────

describe("GHOST PROTOCOL bounty (no_damage_wave)", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("no_damage_wave")];
  });

  it("starts active with 0 progress", () => {
    const b = s.activeBounties[0];
    expect(b.state).toBe("active");
    expect(b.progress).toBe(0);
  });

  it("tickBountyProgress does not complete it mid-wave (only checked at wave clear)", () => {
    s.bountyTracking.tookDamageThisWave = false;
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("active");
  });

  it("completes on wave clear when player took no damage", () => {
    s.bountyTracking.tookDamageThisWave = false;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    const b = s.activeBounties[0];
    expect(b.state).toBe("completed");
    expect(b.progress).toBe(1);
    expect(b.justCompleted).toBe(true);
    expect(b.completedWave).toBe(s.wave);
  });

  it("does NOT complete on wave clear when player took damage", () => {
    s.bountyTracking.tookDamageThisWave = true;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].state).toBe("active");
  });

  it("reward is awarded after completing via awardCompletedBounties", () => {
    s.bountyTracking.tookDamageThisWave = false;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);

    let awarded = 0;
    awardCompletedBounties(s.activeBounties, (reward) => {
      awarded += reward;
    });

    const b = s.activeBounties[0];
    expect(awarded).toBe(b.reward);
    expect(b.rewardAwarded).toBe(true);
  });

  it("reward is awarded exactly once even if awardCompletedBounties is called twice", () => {
    s.bountyTracking.tookDamageThisWave = false;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);

    let callCount = 0;
    awardCompletedBounties(s.activeBounties, () => { callCount++; });
    awardCompletedBounties(s.activeBounties, () => { callCount++; });
    expect(callCount).toBe(1);
  });

  it("bounty damage flag resets between waves via resetWaveBountyTracking", () => {
    s.bountyTracking.tookDamageThisWave = true;
    resetWaveBountyTracking(s.bountyTracking);
    expect(s.bountyTracking.tookDamageThisWave).toBe(false);
  });

  it("GHOST PROTOCOL can complete on a second wave if first wave had damage", () => {
    s.bountyTracking.tookDamageThisWave = true;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].state).toBe("active");

    resetWaveBountyTracking(s.bountyTracking);
    s.wave++;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].state).toBe("completed");
  });
});

// ─── SPEED CLEAR bounty (fast_wave_clear) ─────────────────────────────────────

describe("SPEED CLEAR bounty (fast_wave_clear)", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("fast_wave")];
  });

  it("completes when wave cleared in under 45 seconds", () => {
    s.bountyTracking.waveTimer = 30;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].state).toBe("completed");
  });

  it("completes at exactly 45 seconds", () => {
    s.bountyTracking.waveTimer = 45;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].state).toBe("completed");
  });

  it("does NOT complete when wave took more than 45 seconds", () => {
    s.bountyTracking.waveTimer = 60;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].state).toBe("active");
  });

  it("does NOT complete when waveTimer is 0 (wave not started)", () => {
    s.bountyTracking.waveTimer = 0;
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].state).toBe("active");
  });
});

// ─── awardCompletedBounties ───────────────────────────────────────────────────

describe("awardCompletedBounties", () => {
  it("calls the callback for each completed, un-awarded bounty", () => {
    const b1 = makeBounty("kill_15");
    b1.state = "completed";
    const b2 = makeBounty("kill_30");
    b2.state = "active";

    const awarded: number[] = [];
    awardCompletedBounties([b1, b2], (reward) => awarded.push(reward));

    expect(awarded).toHaveLength(1);
    expect(awarded[0]).toBe(b1.reward);
  });

  it("marks bounties as rewardAwarded after calling the callback", () => {
    const b = makeBounty("kill_15");
    b.state = "completed";
    awardCompletedBounties([b], () => {});
    expect(b.rewardAwarded).toBe(true);
  });

  it("skips already-awarded bounties", () => {
    const b = makeBounty("kill_15");
    b.state = "completed";
    b.rewardAwarded = true;

    let callCount = 0;
    awardCompletedBounties([b], () => { callCount++; });
    expect(callCount).toBe(0);
  });

  it("skips failed bounties", () => {
    const b = makeBounty("kill_15");
    b.state = "failed";

    let callCount = 0;
    awardCompletedBounties([b], () => { callCount++; });
    expect(callCount).toBe(0);
  });
});

// ─── createBountyTracking ─────────────────────────────────────────────────────

describe("createBountyTracking", () => {
  it("initialises all counters to zero", () => {
    const t = createBountyTracking();
    expect(t.tookDamageThisWave).toBe(false);
    expect(t.scrapThisWave).toBe(0);
    expect(t.earnedScrapThisWave).toBe(0);
    expect(t.hordeKillsThisRun).toBe(0);
    expect(t.waveTimer).toBe(0);
    expect(t.explosiveKills).toBe(0);
    for (const v of Object.values(t.kindKills)) {
      expect(v).toBe(0);
    }
  });
});

// ─── resetWaveBountyTracking ──────────────────────────────────────────────────

describe("resetWaveBountyTracking", () => {
  it("resets wave-scoped fields but leaves run-scoped fields intact", () => {
    const t = createBountyTracking();
    t.tookDamageThisWave = true;
    t.scrapThisWave = 50;
    t.earnedScrapThisWave = 50;
    t.waveTimer = 30;
    t.hordeKillsThisRun = 8;
    t.explosiveKills = 3;

    resetWaveBountyTracking(t);

    expect(t.tookDamageThisWave).toBe(false);
    expect(t.scrapThisWave).toBe(0);
    expect(t.earnedScrapThisWave).toBe(0);
    expect(t.waveTimer).toBe(0);
    // Run-scoped fields must survive the wave reset
    expect(t.hordeKillsThisRun).toBe(8);
    expect(t.explosiveKills).toBe(3);
  });
});

// ─── Bounty reward payouts must not inflate HOARDER / SCRAP BARON totals ──────

describe("bounty scrap reward does not inflate HOARDER or SCRAP BARON totals", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("rig-defense");
    startWave(s);
  });

  it("completing a bounty increments totalScrap but NOT earnedScrap", () => {
    s.activeBounties = [makeBounty("kill_15")];
    const earnedBefore = s.stats.earnedScrap;
    const totalBefore = s.stats.totalScrap;

    s.stats.kills = 15;
    tickBountyProgress(s);

    const b = s.activeBounties[0];
    expect(b.state).toBe("completed");
    expect(b.rewardAwarded).toBe(true);
    // totalScrap grows by the reward
    expect(s.stats.totalScrap).toBe(totalBefore + b.reward);
    // earnedScrap must be untouched — bounty payouts are not player-earned scrap
    expect(s.stats.earnedScrap).toBe(earnedBefore);
  });

  it("completing a bounty does NOT increment earnedScrapThisWave", () => {
    s.activeBounties = [makeBounty("kill_15")];
    const earnedThisWaveBefore = s.bountyTracking.earnedScrapThisWave;

    s.stats.kills = 15;
    tickBountyProgress(s);

    expect(s.activeBounties[0].state).toBe("completed");
    expect(s.bountyTracking.earnedScrapThisWave).toBe(earnedThisWaveBefore);
  });

  it("HOARDER progress uses earnedScrap, not totalScrap", () => {
    s.activeBounties = [makeBounty("total_scrap")];
    // Simulate a scenario where totalScrap is inflated by a prior bounty payout
    // but the player has only earned 100 scrap themselves.
    s.stats.totalScrap = 200;
    s.stats.earnedScrap = 100;

    tickBountyProgress(s);

    const b = s.activeBounties[0];
    // Target is 150; earnedScrap is 100 so still active
    expect(b.state).toBe("active");
    expect(b.progress).toBe(100);
  });

  it("HOARDER completes only when earnedScrap reaches target, ignoring totalScrap inflation", () => {
    s.activeBounties = [makeBounty("total_scrap")];
    s.stats.totalScrap = 300; // heavily inflated by bounty rewards
    s.stats.earnedScrap = 150; // exactly at target

    tickBountyProgress(s);

    expect(s.activeBounties[0].state).toBe("completed");
  });

  it("SCRAP BARON progress uses earnedScrapThisWave, not totalScrap", () => {
    s.activeBounties = [makeBounty("scrap_wave")];
    // totalScrap inflated well above the target but earned-this-wave is low
    s.stats.totalScrap = 500;
    s.bountyTracking.earnedScrapThisWave = 40;

    tickBountyProgress(s);

    const b = s.activeBounties[0];
    // Target is 80; earnedScrapThisWave is 40 so still active
    expect(b.state).toBe("active");
    expect(b.progress).toBe(40);
  });

  it("SCRAP BARON completes only when earnedScrapThisWave reaches target", () => {
    s.activeBounties = [makeBounty("scrap_wave")];
    s.stats.totalScrap = 500;
    s.bountyTracking.earnedScrapThisWave = 80; // exactly at target

    tickBountyProgress(s);

    expect(s.activeBounties[0].state).toBe("completed");
  });

  it("multiple bounty payouts in one run never accumulate into earnedScrap", () => {
    // Complete 3 bounties in sequence and verify earnedScrap stays at 0
    s.activeBounties = [
      makeBounty("kill_15"),
      makeBounty("kill_30"),
      makeBounty("kill_60"),
    ];
    s.stats.kills = 60;
    tickBountyProgress(s);

    const totalReward = s.activeBounties.reduce((sum, b) => sum + b.reward, 0);
    expect(s.stats.totalScrap).toBe(totalReward);
    expect(s.stats.earnedScrap).toBe(0);
    expect(s.bountyTracking.earnedScrapThisWave).toBe(0);
  });
});

// ─── justCompleted flag — HUD toast lifecycle ─────────────────────────────────

describe("justCompleted flag — HUD toast lifecycle", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("kill_15")];
  });

  it("justCompleted is true immediately after tickBountyProgress completes a bounty", () => {
    s.stats.kills = 15;
    tickBountyProgress(s);
    expect(s.activeBounties[0].justCompleted).toBe(true);
  });

  it("a second tickBountyProgress on an already-completed bounty does NOT re-set justCompleted to false", () => {
    s.stats.kills = 15;
    tickBountyProgress(s);
    expect(s.activeBounties[0].justCompleted).toBe(true);
    // Second tick — bounty is already completed so the engine skips it;
    // justCompleted must remain true so the HUD can still read the flag.
    tickBountyProgress(s);
    expect(s.activeBounties[0].justCompleted).toBe(true);
  });

  it("justCompleted and rewardAwarded are both set on completion but serve different purposes", () => {
    s.stats.kills = 15;
    tickBountyProgress(s);
    const b = s.activeBounties[0];

    // Both flags are true after the first completing tick
    expect(b.justCompleted).toBe(true);
    expect(b.rewardAwarded).toBe(true);

    // rewardAwarded guards against double-awarding scrap: a second tick must
    // not add scrap again even though justCompleted is still true.
    const scrapAfterFirst = s.scrap;
    tickBountyProgress(s);
    expect(s.scrap).toBe(scrapAfterFirst);

    // justCompleted remains set (HUD display flag); rewardAwarded remains set
    // (payment guard) — they are independently meaningful.
    expect(b.justCompleted).toBe(true);
    expect(b.rewardAwarded).toBe(true);
  });

  it("justCompleted starts false and only becomes true at the completing tick", () => {
    // Partial progress — not yet completed
    s.stats.kills = 10;
    tickBountyProgress(s);
    expect(s.activeBounties[0].justCompleted).toBe(false);

    // Completing tick
    s.stats.kills = 15;
    tickBountyProgress(s);
    expect(s.activeBounties[0].justCompleted).toBe(true);
  });

  it("wave-clear bounty (no_damage_wave) sets justCompleted via tickWaveClearBounties, not tickBountyProgress", () => {
    s.activeBounties = [makeBounty("no_damage_wave")];
    s.bountyTracking.tookDamageThisWave = false;

    // Mid-wave tick must NOT set justCompleted
    tickBountyProgress(s);
    expect(s.activeBounties[0].justCompleted).toBe(false);

    // Wave-clear handler must set it
    tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
    expect(s.activeBounties[0].justCompleted).toBe(true);
  });
});

// ─── drawBounties — mode filtering (named-bounty checks) ─────────────────────
//
// The generic excludeModes tests above verify the mechanism works for whatever
// the pool contains at query time.  These tests pin the *specific* bounties and
// modes that the task spec calls out so a future pool edit cannot silently
// re-introduce an unachievable bounty without a test failing.

/**
 * Draw bounties across `samples` seeds for the given mode and return a flat
 * array of every templateId that appeared.
 */
function drawMany(
  mode: Parameters<typeof drawBounties>[1],
  samples = 500,
): string[] {
  const ids: string[] = [];
  for (let seed = 0; seed < samples; seed++) {
    for (const b of drawBounties(seed, mode)) {
      ids.push(b.templateId);
    }
  }
  return ids;
}

function countId(ids: string[], id: string): number {
  return ids.filter((x) => x === id).length;
}

describe("drawBounties — horde_kills exclusion by mode", () => {
  it("horde_kills is NEVER drawn in boss-rush (500 seeds)", () => {
    const drawn = drawMany("boss-rush", 500);
    expect(drawn).not.toContain("horde_kills");
  });

  it("horde_kills is NEVER drawn in scavenge (500 seeds)", () => {
    const drawn = drawMany("scavenge", 500);
    expect(drawn).not.toContain("horde_kills");
  });

  it("horde_kills CAN appear in rig-defense (at least once in 500 seeds)", () => {
    const drawn = drawMany("rig-defense", 500);
    expect(drawn).toContain("horde_kills");
  });

  it("horde_kills CAN appear in story (at least once in 500 seeds)", () => {
    const drawn = drawMany("story", 500);
    expect(drawn).toContain("horde_kills");
  });
});

describe("drawBounties — kill_brutes / kill_runners / kill_crawlers / kill_bombers excluded from boss-rush", () => {
  const excluded = ["kill_brutes", "kill_runners", "kill_crawlers", "kill_bombers"] as const;

  it("none of the four kind-kill bounties ever appear in boss-rush (500 seeds)", () => {
    const drawn = drawMany("boss-rush", 500);
    for (const id of excluded) {
      expect(drawn, `'${id}' must never appear in boss-rush`).not.toContain(id);
    }
  });

  it("kill_brutes is NEVER drawn in boss-rush (500 seeds)", () => {
    expect(drawMany("boss-rush", 500)).not.toContain("kill_brutes");
  });

  it("kill_runners is NEVER drawn in boss-rush (500 seeds)", () => {
    expect(drawMany("boss-rush", 500)).not.toContain("kill_runners");
  });

  it("kill_crawlers is NEVER drawn in boss-rush (500 seeds)", () => {
    expect(drawMany("boss-rush", 500)).not.toContain("kill_crawlers");
  });

  it("kill_bombers is NEVER drawn in boss-rush (500 seeds)", () => {
    expect(drawMany("boss-rush", 500)).not.toContain("kill_bombers");
  });

  it("all four kind-kill bounties CAN appear in rig-defense (500 seeds)", () => {
    const drawn = drawMany("rig-defense", 500);
    for (const id of excluded) {
      expect(drawn, `'${id}' should be drawable in rig-defense`).toContain(id);
    }
  });
});

describe("drawBounties — kill_boss weighted more heavily in boss-rush than rig-defense", () => {
  it("kill_boss appears more often in boss-rush than rig-defense over 500 seeds (modeWeight: 4)", () => {
    const rigIds = drawMany("rig-defense", 500);
    const bossIds = drawMany("boss-rush", 500);

    const rigCount = countId(rigIds, "kill_boss");
    const bossCount = countId(bossIds, "kill_boss");

    // With modeWeight: { "boss-rush": 4 } and a smaller eligible pool in boss-rush,
    // kill_boss should dominate.  Over 500 samples the LCG is deterministic so
    // this comparison is stable — not a flaky probabilistic check.
    expect(bossCount).toBeGreaterThan(rigCount);
  });

  it("kill_boss appears in at least 30% of all boss-rush draw slots (500 seeds × 3 slots = 1500)", () => {
    const bossIds = drawMany("boss-rush", 500);
    const rate = countId(bossIds, "kill_boss") / bossIds.length;
    expect(rate).toBeGreaterThan(0.3);
  });

  it("kill_boss appears in boss-rush across diverse seeds spread over the full range", () => {
    let hitCount = 0;
    for (let seed = 0; seed < 500; seed += 10) {
      if (drawBounties(seed, "boss-rush").some((b) => b.templateId === "kill_boss")) {
        hitCount++;
      }
    }
    // Expect hits from at least 10 distinct seed clusters (not just a narrow range)
    expect(hitCount).toBeGreaterThan(10);
  });
});

// ─── Player scrap pickup increments earnedScrap and totalScrap ────────────────
//
// These are integration tests — they place a scrap entity at the player's
// position and run tick() so the real engine pickup path is exercised.
// A regression in the pickup code (e.g. forgetting to write earnedScrap)
// will be caught here without relying on manual state mutation.

describe("player scrap pickup increments earnedScrap and totalScrap", () => {
  function placeScrapAtPlayer(s: GameState, value: number) {
    s.scraps.push({
      id: s.nextId++,
      pos: { x: s.player.pos.x, y: s.player.pos.y }, // distance 0 → immediate pickup
      vel: { x: 0, y: 0 },
      radius: 8,
      value,
      ttl: 30,
    });
  }

  it("tick() increments earnedScrap, totalScrap, and earnedScrapThisWave when player touches scrap", () => {
    const s = makeState("rig-defense");
    startWave(s);

    const pickupValue = 25;
    placeScrapAtPlayer(s, pickupValue);

    const earnedBefore = s.stats.earnedScrap;
    const totalBefore = s.stats.totalScrap;
    const waveBefore = s.bountyTracking.earnedScrapThisWave;

    tick(s, 0.016);

    expect(s.stats.earnedScrap).toBe(earnedBefore + pickupValue);
    expect(s.stats.totalScrap).toBe(totalBefore + pickupValue);
    expect(s.bountyTracking.earnedScrapThisWave).toBe(waveBefore + pickupValue);
    // The scrap entity must be consumed
    expect(s.scraps).toHaveLength(0);
  });

  it("earnedScrap and totalScrap increase by the same amount on pickup", () => {
    const s = makeState("rig-defense");
    startWave(s);

    placeScrapAtPlayer(s, 40);
    tick(s, 0.016);

    expect(s.stats.earnedScrap).toBe(s.stats.totalScrap);
  });

  it("HOARDER reaches completion when earnedScrap hits target through real pickups", () => {
    const s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("total_scrap")]; // target = 150

    // Simulate the player collecting exactly 150 scrap via pickups
    placeScrapAtPlayer(s, 150);
    tick(s, 0.016);
    tickBountyProgress(s);

    expect(s.activeBounties[0].state).toBe("completed");
    expect(s.activeBounties[0].progress).toBe(150);
  });

  it("SCRAP BARON reaches completion when earnedScrapThisWave hits target through real pickups", () => {
    const s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("scrap_wave")]; // target = 80

    placeScrapAtPlayer(s, 80);
    tick(s, 0.016);
    tickBountyProgress(s);

    expect(s.activeBounties[0].state).toBe("completed");
    expect(s.activeBounties[0].progress).toBe(80);
  });

  it("a bounty reward awarded during the same tick does NOT further inflate earnedScrap", () => {
    const s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("total_scrap")]; // target = 150

    // Player collects 150 scrap — HOARDER will complete inside tickBountyProgress
    placeScrapAtPlayer(s, 150);
    tick(s, 0.016);
    tickBountyProgress(s);

    const b = s.activeBounties[0];
    expect(b.state).toBe("completed");
    expect(b.rewardAwarded).toBe(true);
    // After bounty payout, totalScrap = 150 (pickup) + reward
    // But earnedScrap must remain at exactly what the player picked up
    expect(s.stats.earnedScrap).toBe(150);
    expect(s.stats.totalScrap).toBe(150 + b.reward);
  });
});

// ─── isBountyImpossible — mode-incompatible bounties fail immediately ─────────
//
// These tests verify that tickBountyProgress marks a bounty as "failed" when
// it is impossible to complete in the active game mode (derived from
// BOUNTY_POOL.excludeModes).  They are intentionally data-driven so that adding
// a new game mode to GameMode without updating BOUNTY_POOL.excludeModes causes
// a test failure rather than a silent runtime misbehaviour.

describe("isBountyImpossible — excluded bounties are immediately failed by tickBountyProgress", () => {
  it("horde_kills is immediately failed in boss-rush (no horde events in boss-rush)", () => {
    const s = makeState("boss-rush");
    startWave(s);
    s.activeBounties = [makeBounty("horde_kills")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("failed");
  });

  it("horde_kills is immediately failed in scavenge (no horde events in scavenge)", () => {
    const s = makeState("scavenge");
    startWave(s);
    s.activeBounties = [makeBounty("horde_kills")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("failed");
  });

  it("kill_bombers is immediately failed in boss-rush (no bombers spawn in boss-rush)", () => {
    const s = makeState("boss-rush");
    startWave(s);
    s.activeBounties = [makeBounty("kill_bombers")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("failed");
  });

  it("kill_brutes is immediately failed in boss-rush (no brutes spawn in boss-rush)", () => {
    const s = makeState("boss-rush");
    startWave(s);
    s.activeBounties = [makeBounty("kill_brutes")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("failed");
  });

  it("kill_runners is immediately failed in boss-rush (no runners spawn in boss-rush)", () => {
    const s = makeState("boss-rush");
    startWave(s);
    s.activeBounties = [makeBounty("kill_runners")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("failed");
  });

  it("kill_crawlers is immediately failed in boss-rush (no crawlers spawn in boss-rush)", () => {
    const s = makeState("boss-rush");
    startWave(s);
    s.activeBounties = [makeBounty("kill_crawlers")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("failed");
  });

  it("horde_kills remains active in rig-defense (horde events exist)", () => {
    const s = makeState("rig-defense");
    startWave(s);
    s.activeBounties = [makeBounty("horde_kills")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("active");
  });

  it("horde_kills remains active in story mode (horde events exist)", () => {
    const s = makeState("story");
    startWave(s);
    s.activeBounties = [makeBounty("horde_kills")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("active");
  });

  it("kill_boss remains active in boss-rush (bosses always spawn)", () => {
    const s = makeState("boss-rush");
    startWave(s);
    s.activeBounties = [makeBounty("kill_boss")];
    tickBountyProgress(s);
    expect(s.activeBounties[0].state).toBe("active");
  });

  it("data-driven: every bounty with excludeModes is immediately failed in its excluded modes", () => {
    const excluded = BOUNTY_POOL.filter((t) => t.excludeModes && t.excludeModes.length > 0);
    for (const template of excluded) {
      for (const mode of template.excludeModes!) {
        const s = makeState(mode as Parameters<typeof makeState>[0]);
        startWave(s);
        s.activeBounties = [makeBounty(template.id)];
        tickBountyProgress(s);
        expect(
          s.activeBounties[0].state,
          `bounty '${template.id}' should be failed in mode '${mode}'`,
        ).toBe("failed");
      }
    }
  });

  it("data-driven: no excluded bounty is ever returned by drawBounties for ANY mode (500 seeds)", () => {
    const allModes: GameMode[] = [
      "rig-defense",
      "boss-rush",
      "scavenge",
      "story",
    ];
    for (const mode of allModes) {
      const excluded = BOUNTY_POOL.filter((t) =>
        t.excludeModes?.includes(mode),
      ).map((t) => t.id);

      if (excluded.length === 0) continue;

      for (let seed = 0; seed < 500; seed++) {
        const drawn = drawBounties(seed, mode).map((b) => b.templateId);
        for (const id of excluded) {
          expect(
            drawn,
            `bounty '${id}' must never appear in mode '${mode}' (seed ${seed})`,
          ).not.toContain(id);
        }
      }
    }
  });
});
