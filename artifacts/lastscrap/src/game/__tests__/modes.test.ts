import { describe, it, expect, beforeEach } from "vitest";
import {
  createState,
  startWave,
  tick,
  BOSS_WARNING_TIME,
  BOSS_INTERVAL,
  isBossWave,
  isHordeWave,
} from "../engine";
import type { GameState } from "../engine";
import { BEST_KEY, BEST_KEY_BOSS, BEST_KEY_SCAVENGE } from "../storage";
import type { Zombie } from "../types";

const VP = { w: 390, h: 844 };

function makeState(mode: Parameters<typeof createState>[3] = "rig-defense"): GameState {
  return createState(VP.w, VP.h, "standard", mode);
}

function makeDeadZombie(s: GameState, reward = 10): Zombie {
  return {
    id: s.nextId++,
    // Place far from the player (who starts at arena center) so scrap drops
    // aren't auto-collected before the test can observe them in s.scraps.
    pos: { x: 100, y: 100 },
    vel: { x: 0, y: 0 },
    radius: 16,
    hp: 0,
    maxHp: 100,
    speed: 0,
    damage: 0,
    reward,
    hitFlash: 0,
    stunTime: 0,
    slowTime: 0,
    burnTime: 0,
    burnDps: 0,
    poisonStacks: 0,
    poisonTime: 0,
    variant: 0,
    kind: "walker",
    attackCd: 0,
    telegraphed: false,
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

describe("Personal best storage keys", () => {
  it("rig-defense key is lastscrap_best_v1", () => {
    expect(BEST_KEY).toBe("lastscrap_best_v1");
  });

  it("boss-rush key is lastscrap_best_boss_v1", () => {
    expect(BEST_KEY_BOSS).toBe("lastscrap_best_boss_v1");
  });

  it("scavenge key is lastscrap_best_scavenge_v1", () => {
    expect(BEST_KEY_SCAVENGE).toBe("lastscrap_best_scavenge_v1");
  });

  it("all three keys are distinct", () => {
    const keys = [BEST_KEY, BEST_KEY_BOSS, BEST_KEY_SCAVENGE];
    expect(new Set(keys).size).toBe(3);
  });

  it("per-mode routing: rig-defense uses BEST_KEY", () => {
    function bestKeyForMode(mode: string): string {
      if (mode === "boss-rush") return BEST_KEY_BOSS;
      if (mode === "scavenge") return BEST_KEY_SCAVENGE;
      return BEST_KEY;
    }
    expect(bestKeyForMode("rig-defense")).toBe(BEST_KEY);
    expect(bestKeyForMode("boss-rush")).toBe(BEST_KEY_BOSS);
    expect(bestKeyForMode("scavenge")).toBe(BEST_KEY_SCAVENGE);
    expect(bestKeyForMode("story")).toBe(BEST_KEY);
  });
});

describe("Rig Defense", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("rig-defense");
  });

  it("starts in playing status after startWave", () => {
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.gameMode).toBe("rig-defense");
  });

  it("wave counter increments on each startWave call", () => {
    expect(s.wave).toBe(0);
    startWave(s);
    expect(s.wave).toBe(1);
    clearWaveInstantly(s);
    startWave(s);
    expect(s.wave).toBe(2);
  });

  it("normal wave (non-boss, non-horde) queues enemies and has no boss warning", () => {
    startWave(s);
    expect(isBossWave(s.wave)).toBe(false);
    expect(isHordeWave(s.wave)).toBe(false);
    expect(s.spawnQueue).toBeGreaterThan(0);
    expect(s.bossWarning).toBe(0);
  });

  it("boss wave (wave 7) triggers boss warning with no horde", () => {
    s.wave = BOSS_INTERVAL - 1;
    startWave(s);
    expect(s.wave).toBe(BOSS_INTERVAL);
    expect(isBossWave(s.wave)).toBe(true);
    expect(s.bossWarning).toBe(BOSS_WARNING_TIME);
    expect(s.isHorde).toBe(false);
  });

  it("wave clear (all zombies dead, queue empty) sets status to waveclear", () => {
    startWave(s);
    clearWaveInstantly(s);
    tick(s, 0.016);
    expect(s.status).toBe("waveclear");
  });

  it("wavesCleared increments on a wave clear", () => {
    startWave(s);
    clearWaveInstantly(s);
    const before = s.stats.wavesCleared;
    tick(s, 0.016);
    expect(s.stats.wavesCleared).toBe(before + 1);
  });

  it("wave clear awards scrap bonus", () => {
    startWave(s);
    clearWaveInstantly(s);
    const scrapBefore = s.scrap;
    tick(s, 0.016);
    expect(s.scrap).toBeGreaterThan(scrapBefore);
  });

  it("player death causes gameover", () => {
    startWave(s);
    s.player.hp = 0;
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });

  it("rig destruction causes gameover in rig-defense", () => {
    startWave(s);
    s.rig.hp = 0;
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });
});

describe("Boss Rush", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("boss-rush");
  });

  it("starts in playing status after startWave", () => {
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.gameMode).toBe("boss-rush");
  });

  it("wave 1 immediately triggers boss warning", () => {
    startWave(s);
    expect(s.bossWarning).toBe(BOSS_WARNING_TIME);
  });

  it("every wave triggers a boss warning (waves 1–5)", () => {
    for (let i = 0; i < 5; i++) {
      clearWaveInstantly(s);
      startWave(s);
      expect(s.bossWarning).toBe(BOSS_WARNING_TIME);
      s.bossWarning = 0;
    }
  });

  it("no escort spawn queue — solo boss waves only", () => {
    startWave(s);
    expect(s.spawnQueue).toBe(0);
  });

  it("never triggers horde mode", () => {
    for (let i = 0; i < 10; i++) {
      clearWaveInstantly(s);
      startWave(s);
      expect(s.isHorde).toBe(false);
    }
  });

  it("dead zombie scrap drop is multiplied by 2×", () => {
    startWave(s);
    s.bossWarning = 0;
    s.bossSpawned = true;

    const reward = 10;
    s.zombies = [makeDeadZombie(s, reward)];

    tick(s, 0.016);

    const drops = s.scraps.filter((sc) => sc.value === reward * 2);
    expect(drops.length).toBeGreaterThanOrEqual(1);
  });

  it("boss zombie death drops 2 scrap pickups (normal + bonus) each at 2×", () => {
    startWave(s);
    s.bossWarning = 0;
    s.bossSpawned = true;

    const reward = 15;
    const bossZombie: Zombie = { ...makeDeadZombie(s, reward), kind: "boss" };
    s.zombies = [bossZombie];

    tick(s, 0.016);

    const drops = s.scraps.filter((sc) => sc.value === reward * 2);
    expect(drops.length).toBe(2);
  });

  it("wave clears when the boss is killed (queue empty, no zombies)", () => {
    startWave(s);
    clearWaveInstantly(s);
    tick(s, 0.016);
    expect(s.status).toBe("waveclear");
  });

  it("wavesCleared increments on boss wave clear", () => {
    startWave(s);
    clearWaveInstantly(s);
    const before = s.stats.wavesCleared;
    tick(s, 0.016);
    expect(s.stats.wavesCleared).toBe(before + 1);
  });
});

describe("Scavenge Run", () => {
  let s: GameState;

  beforeEach(() => {
    s = makeState("scavenge");
  });

  it("starts in playing status after startWave", () => {
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.gameMode).toBe("scavenge");
  });

  it("startWave sets quota, collected, and timer", () => {
    startWave(s);
    expect(s.scavengeQuota).toBeGreaterThan(0);
    expect(s.scavengeCollected).toBe(0);
    expect(s.scavengeTimeLeft).toBeGreaterThan(0);
  });

  it("quota scales with wave number", () => {
    startWave(s);
    const quotaW1 = s.scavengeQuota;
    clearWaveInstantly(s);
    startWave(s);
    const quotaW2 = s.scavengeQuota;
    expect(quotaW2).toBeGreaterThan(quotaW1);
  });

  it("scrap crates are spawned at wave start", () => {
    startWave(s);
    expect(s.scavengeCrates.length).toBeGreaterThan(0);
  });

  it("meeting the quota clears the wave (no need to kill all enemies)", () => {
    startWave(s);
    s.scavengeCollected = s.scavengeQuota;

    tick(s, 0.016);
    expect(s.status).toBe("waveclear");
  });

  it("quota wave clear increments wavesCleared", () => {
    startWave(s);
    s.scavengeCollected = s.scavengeQuota;
    const before = s.stats.wavesCleared;
    tick(s, 0.016);
    expect(s.stats.wavesCleared).toBe(before + 1);
  });

  it("time expiry with quota unmet causes gameover", () => {
    startWave(s);
    s.scavengeTimeLeft = 0;
    s.scavengeCollected = 0;

    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });

  it("time expiry when quota IS met does not cause gameover", () => {
    startWave(s);
    s.scavengeTimeLeft = 0;
    s.scavengeCollected = s.scavengeQuota;

    tick(s, 0.016);
    expect(s.status).not.toBe("gameover");
  });

  it("RIG destruction does NOT end the game in scavenge mode", () => {
    startWave(s);
    s.rig.hp = 0;
    tick(s, 0.016);
    expect(s.status).not.toBe("gameover");
  });

  it("player death still causes gameover in scavenge mode", () => {
    startWave(s);
    s.player.hp = 0;
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });

  it("timer ticks down during play", () => {
    startWave(s);
    const timeBefore = s.scavengeTimeLeft;
    tick(s, 0.1);
    expect(s.scavengeTimeLeft).toBeLessThan(timeBefore);
  });

  it("no horde waves in scavenge mode", () => {
    for (let i = 0; i < 10; i++) {
      clearWaveInstantly(s);
      startWave(s);
      expect(s.isHorde).toBe(false);
    }
  });
});

describe("Scavenge Run — crate/quota sync", () => {
  // Helper: build a fresh scavenge state at a given wave number and call startWave.
  function scavengeAtWave(wave: number): GameState {
    const st = makeState("scavenge");
    st.wave = wave - 1;
    startWave(st);
    return st;
  }

  it("total potential crate value covers ≥ 50% of quota at every wave (1–30)", () => {
    for (let wave = 1; wave <= 30; wave++) {
      const st = scavengeAtWave(wave);
      const totalCrateValue = st.scavengeCrates.reduce((sum, c) => sum + c.value, 0);
      expect(totalCrateValue).toBeGreaterThanOrEqual(st.scavengeQuota * 0.5);
    }
  });

  it("quota grows by a constant increment each wave (linear scaling — not accelerating)", () => {
    // If someone changes quota to scale exponentially the increments will diverge.
    const increments: number[] = [];
    for (let wave = 1; wave <= 10; wave++) {
      const q1 = scavengeAtWave(wave).scavengeQuota;
      const q2 = scavengeAtWave(wave + 1).scavengeQuota;
      increments.push(q2 - q1);
    }
    const first = increments[0];
    for (const inc of increments) {
      expect(inc).toBe(first);
    }
  });

  it("timer stays within ±20% of wave-1 value across waves 1–20 (no silent timer nerf)", () => {
    // Catches independent changes to scavengeTimeLeft scaling that outpace quota changes.
    const baseTimer = scavengeAtWave(1).scavengeTimeLeft;
    for (let wave = 2; wave <= 20; wave++) {
      const timer = scavengeAtWave(wave).scavengeTimeLeft;
      expect(timer).toBeGreaterThanOrEqual(baseTimer * 0.8);
      expect(timer).toBeLessThanOrEqual(baseTimer * 1.2);
    }
  });

  it("required collection rate (quota ÷ timer) grows no more than 25× from wave 1 to wave 30", () => {
    // If quota is accelerated without a matching timer increase, this ratio spikes and
    // the quota becomes unreachable in practice. 25× is a loose ceiling — the current
    // linear-quota + flat-timer design stays well within it; the test catches runaway drift.
    const rateW1 = scavengeAtWave(1).scavengeQuota / scavengeAtWave(1).scavengeTimeLeft;
    const rateW30 = scavengeAtWave(30).scavengeQuota / scavengeAtWave(30).scavengeTimeLeft;
    expect(rateW30 / rateW1).toBeLessThan(25);
  });
});
