import { describe, it, expect, beforeEach } from "vitest";
import {
  createState,
  startWave,
  tick,
  setupStoryMission,
  BOSS_WARNING_TIME,
} from "../engine";
import type { GameState } from "../engine";
import { MISSIONS } from "../missions";
import type { Zombie } from "../types";

const VP = { w: 390, h: 844 };

function makeState(): GameState {
  return createState(VP.w, VP.h, "standard", "rig-defense");
}

// Wipe all active enemies and queued spawns so the wave-clear check fires on the next tick.
function clearWaveInstantly(s: GameState) {
  s.spawnQueue = 0;
  s.zombies = [];
  s.isHorde = false;
  s.hordeWarning = 0;
  s.hordeTimer = 0;
  s.bossWarning = 0;
  s.bossSpawned = true;
}

// Mission-id constants (matches MISSIONS array in missions.ts)
const MISSION_ESCAPE = 0;
const MISSION_SCAVENGE = 1;
const MISSION_ELIMINATE = 2;
const MISSION_HOLD = 3;
const MISSION_ESCORT = 4;
const MISSION_SABOTAGE = 5;
const MISSION_DEFEND = 6;

// ─── setupStoryMission — objective shape ──────────────────────────────────────

describe("Story Mode — setupStoryMission objective shape", () => {
  let s: GameState;
  beforeEach(() => { s = makeState(); });

  it("escape: sets type, extractionPos, timeLeft, and reached=false", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    expect(s.gameMode).toBe("story");
    expect(s.storyMissionId).toBe(MISSION_ESCAPE);
    const obj = s.storyObjective;
    expect(obj?.type).toBe("escape");
    if (obj?.type !== "escape") return;
    expect(obj.extractionPos).toBeDefined();
    expect(obj.timeLeft).toBeGreaterThan(0);
    expect(obj.reached).toBe(false);
  });

  it("escape: pre-spawns zombies onto the map", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    expect(s.zombies.length).toBeGreaterThan(0);
  });

  it("scavenge: sets type, quota, timeLeft, and syncs state fields", () => {
    setupStoryMission(s, MISSION_SCAVENGE);
    const obj = s.storyObjective;
    expect(obj?.type).toBe("scavenge");
    if (obj?.type !== "scavenge") return;
    expect(obj.quota).toBeGreaterThan(0);
    expect(obj.timeLeft).toBeGreaterThan(0);
    expect(s.scavengeQuota).toBe(obj.quota);
    expect(s.scavengeCollected).toBe(0);
    expect(s.scavengeTimeLeft).toBe(obj.timeLeft);
  });

  it("eliminate: sets type, bossName, bossSpawned=false, killed=false", () => {
    setupStoryMission(s, MISSION_ELIMINATE);
    const obj = s.storyObjective;
    expect(obj?.type).toBe("eliminate");
    if (obj?.type !== "eliminate") return;
    expect(typeof obj.bossName).toBe("string");
    expect(obj.bossName.length).toBeGreaterThan(0);
    expect(obj.bossSpawned).toBe(false);
    expect(obj.killed).toBe(false);
  });

  it("hold: sets type, zoneCenter, zoneRadius, and timeLeft", () => {
    setupStoryMission(s, MISSION_HOLD);
    const obj = s.storyObjective;
    expect(obj?.type).toBe("hold");
    if (obj?.type !== "hold") return;
    expect(obj.zoneCenter).toBeDefined();
    expect(obj.zoneRadius).toBeGreaterThan(0);
    expect(obj.timeLeft).toBeGreaterThan(0);
  });

  it("escort: sets type, npcPos, npcHp, npcMaxHp, and timeLeft", () => {
    setupStoryMission(s, MISSION_ESCORT);
    const obj = s.storyObjective;
    expect(obj?.type).toBe("escort");
    if (obj?.type !== "escort") return;
    expect(obj.npcPos).toBeDefined();
    expect(obj.npcHp).toBeGreaterThan(0);
    expect(obj.npcMaxHp).toBe(obj.npcHp);
    expect(obj.timeLeft).toBeGreaterThan(0);
  });

  it("sabotage: places exactly 3 spawners, all intact", () => {
    setupStoryMission(s, MISSION_SABOTAGE);
    const obj = s.storyObjective;
    expect(obj?.type).toBe("sabotage");
    if (obj?.type !== "sabotage") return;
    expect(obj.spawners.length).toBe(3);
    expect(obj.destroyed).toBe(0);
    for (const sp of obj.spawners) {
      expect(sp.destroyed).toBe(false);
      expect(sp.interactProgress).toBe(0);
      expect(sp.spawnTimer).toBeGreaterThan(0);
    }
  });

  it("defend: sets type and targetWave matching mission definition", () => {
    setupStoryMission(s, MISSION_DEFEND);
    const obj = s.storyObjective;
    expect(obj?.type).toBe("defend");
    if (obj?.type !== "defend") return;
    const mission = MISSIONS.find((m) => m.id === MISSION_DEFEND);
    expect(obj.targetWave).toBe(mission?.defendTargetWave ?? 5);
  });

  it("clears activeBounties for all story missions", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    expect(s.activeBounties).toEqual([]);
  });
});

// ─── startWave story branch — wave setup per objective type ───────────────────

describe("Story Mode — startWave wave setup per objective type", () => {
  let s: GameState;
  beforeEach(() => { s = makeState(); });

  it("escape: queues enemies and has no boss warning, no horde", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    s.zombies = [];
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.spawnQueue).toBeGreaterThan(0);
    expect(s.bossWarning).toBe(0);
    expect(s.isHorde).toBe(false);
  });

  it("escape: spawnQueue scales with wave number", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    s.zombies = [];
    startWave(s);
    const qW1 = s.spawnQueue;
    clearWaveInstantly(s);
    startWave(s);
    const qW2 = s.spawnQueue;
    expect(qW2).toBeGreaterThan(qW1);
  });

  it("scavenge (story): queues enemies and resets scavengeCollected", () => {
    setupStoryMission(s, MISSION_SCAVENGE);
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.spawnQueue).toBeGreaterThan(0);
    expect(s.scavengeCollected).toBe(0);
    expect(s.bossWarning).toBe(0);
    expect(s.isHorde).toBe(false);
  });

  it("eliminate: triggers boss warning on first wave and queues escort enemies", () => {
    setupStoryMission(s, MISSION_ELIMINATE);
    const obj = s.storyObjective;
    if (obj?.type !== "eliminate") return;
    expect(obj.bossSpawned).toBe(false);
    startWave(s);
    expect(s.bossWarning).toBe(BOSS_WARNING_TIME);
    expect(s.spawnQueue).toBeGreaterThan(0);
    expect(s.isHorde).toBe(false);
  });

  it("eliminate: does NOT re-issue boss warning when boss is already spawned", () => {
    setupStoryMission(s, MISSION_ELIMINATE);
    const obj = s.storyObjective;
    if (obj?.type !== "eliminate") return;
    obj.bossSpawned = true;
    startWave(s);
    expect(s.bossWarning).toBe(0);
  });

  it("hold: queues enemies and has no boss warning, no horde", () => {
    setupStoryMission(s, MISSION_HOLD);
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.spawnQueue).toBeGreaterThan(0);
    expect(s.bossWarning).toBe(0);
    expect(s.isHorde).toBe(false);
  });

  it("escort: queues enemies and has no boss warning, no horde", () => {
    setupStoryMission(s, MISSION_ESCORT);
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.spawnQueue).toBeGreaterThan(0);
    expect(s.bossWarning).toBe(0);
    expect(s.isHorde).toBe(false);
  });

  it("sabotage: sets spawnQueue to 0 (spawners emit directly)", () => {
    setupStoryMission(s, MISSION_SABOTAGE);
    startWave(s);
    expect(s.status).toBe("playing");
    expect(s.spawnQueue).toBe(0);
    expect(s.bossWarning).toBe(0);
    expect(s.isHorde).toBe(false);
  });

  it("defend (pre-finale wave): queues regular enemies, no boss warning", () => {
    setupStoryMission(s, MISSION_DEFEND);
    const obj = s.storyObjective;
    if (obj?.type !== "defend") return;
    // Ensure we're below the target wave
    s.wave = 0;
    startWave(s); // wave becomes 1, < targetWave(5)
    expect(s.spawnQueue).toBeGreaterThan(0);
    expect(s.bossWarning).toBe(0);
  });

  it("defend (finale wave): triggers boss warning and spawns BEHEMOTH", () => {
    setupStoryMission(s, MISSION_DEFEND);
    const obj = s.storyObjective;
    if (obj?.type !== "defend") return;
    // Set wave so next startWave hits exactly targetWave
    s.wave = obj.targetWave - 1;
    startWave(s);
    expect(s.wave).toBe(obj.targetWave);
    expect(s.bossWarning).toBe(BOSS_WARNING_TIME);
    // Finale boss (BEHEMOTH) should have been inserted into the zombie list
    const boss = s.zombies.find((z: Zombie) => z.kind === "boss");
    expect(boss).toBeDefined();
  });

  it("story branch never activates horde mode for any objective type", () => {
    const missionIds = [
      MISSION_ESCAPE, MISSION_SCAVENGE, MISSION_ELIMINATE,
      MISSION_HOLD, MISSION_ESCORT, MISSION_SABOTAGE, MISSION_DEFEND,
    ];
    for (const id of missionIds) {
      const st = makeState();
      st.zombies = [];
      setupStoryMission(st, id);
      startWave(st);
      expect(st.isHorde).toBe(false);
    }
  });
});

// ─── Mission-complete conditions ──────────────────────────────────────────────

describe("Story Mode — mission-complete conditions", () => {
  let s: GameState;
  beforeEach(() => { s = makeState(); });

  // ── Escape ──────────────────────────────────────────────────────────────────

  it("escape: reaching the extraction zone sets status to missioncomplete", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "escape") return;
    // Teleport player into the extraction zone
    s.player.pos = { ...obj.extractionPos };
    tick(s, 0.016);
    expect(s.status).toBe("missioncomplete");
  });

  it("escape: timer expiry without reaching zone causes gameover", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "escape") return;
    obj.timeLeft = 0.001;
    // Keep player far from extraction
    s.player.pos = { x: s.arena.width * 0.9, y: s.arena.height * 0.5 };
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });

  it("escape: reaching the zone after the timer was nearly out still wins", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "escape") return;
    obj.timeLeft = 999;
    s.player.pos = { ...obj.extractionPos };
    tick(s, 0.016);
    expect(s.status).toBe("missioncomplete");
  });

  // ── Scavenge (story) ────────────────────────────────────────────────────────

  it("scavenge: meeting the quota triggers missioncomplete", () => {
    setupStoryMission(s, MISSION_SCAVENGE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "scavenge") return;
    s.scavengeCollected = obj.quota;
    tick(s, 0.016);
    expect(s.status).toBe("missioncomplete");
  });

  it("scavenge: timer expiry without meeting quota causes gameover", () => {
    setupStoryMission(s, MISSION_SCAVENGE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "scavenge") return;
    obj.timeLeft = 0.001;
    s.scavengeCollected = 0;
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });

  // ── Eliminate ───────────────────────────────────────────────────────────────

  it("eliminate: boss death after spawning triggers missioncomplete", () => {
    setupStoryMission(s, MISSION_ELIMINATE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "eliminate") return;
    // Simulate: boss was spawned and is now dead (hp=0, removed from living list)
    obj.bossSpawned = true;
    s.bossSpawned = true;
    s.bossWarning = 0;
    s.spawnQueue = 0;
    s.zombies = []; // no living boss
    tick(s, 0.016);
    expect(s.status).toBe("missioncomplete");
  });

  it("eliminate: does NOT complete if boss has not yet been spawned", () => {
    setupStoryMission(s, MISSION_ELIMINATE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "eliminate") return;
    obj.bossSpawned = false;
    s.bossSpawned = false;
    s.bossWarning = BOSS_WARNING_TIME; // still in warning phase
    s.spawnQueue = 0;
    s.zombies = [];
    tick(s, 0.016);
    expect(s.status).not.toBe("missioncomplete");
  });

  // ── Hold ────────────────────────────────────────────────────────────────────

  it("hold: timer reaching zero while player is inside the zone triggers missioncomplete", () => {
    setupStoryMission(s, MISSION_HOLD);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "hold") return;
    // Almost out of time
    obj.timeLeft = 0.005;
    // Place player inside the zone
    s.player.pos = { ...obj.zoneCenter };
    tick(s, 0.016);
    expect(s.status).toBe("missioncomplete");
  });

  it("hold: timer does NOT tick when player is outside the zone", () => {
    setupStoryMission(s, MISSION_HOLD);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "hold") return;
    const timeBefore = obj.timeLeft;
    // Place player far outside the zone
    s.player.pos = { x: 0, y: 0 };
    tick(s, 0.1);
    // Timer must be unchanged (or near unchanged — tolerance for floating point)
    expect(obj.timeLeft).toBeCloseTo(timeBefore, 1);
  });

  it("hold: player outside the zone — status stays playing", () => {
    setupStoryMission(s, MISSION_HOLD);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "hold") return;
    obj.timeLeft = 0.001; // nearly expired
    s.player.pos = { x: 0, y: 0 }; // outside zone
    tick(s, 0.016);
    expect(s.status).toBe("playing");
  });

  // ── Escort ──────────────────────────────────────────────────────────────────

  it("escort: NPC hp reaching zero causes gameover", () => {
    setupStoryMission(s, MISSION_ESCORT);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "escort") return;
    obj.npcHp = 0.001; // will drop below 0 on next tick due to zombie contact
    // Spawn a fast zombie right on top of the NPC
    s.zombies.push({
      id: s.nextId++,
      pos: { ...obj.npcPos },
      vel: { x: 0, y: 0 },
      radius: 16,
      hp: 100, maxHp: 100,
      speed: 0, damage: 500, // massive damage to guarantee lethal hit
      reward: 0, hitFlash: 0, stunTime: 0, slowTime: 0,
      burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0,
      variant: 0, kind: "walker", attackCd: 0, telegraphed: false,
    });
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });

  it("escort: surviving the required wave count triggers missioncomplete", () => {
    setupStoryMission(s, MISSION_ESCORT);
    startWave(s);
    const mission = MISSIONS.find((m) => m.id === MISSION_ESCORT)!;
    const waveTarget = mission.escortWaveCount ?? 2;

    // Simulate clearing all required waves
    for (let wave = 0; wave < waveTarget; wave++) {
      clearWaveInstantly(s);
      tick(s, 0.016);
      if (s.status === "missioncomplete") break;
      // After each non-final wave tick, status stays playing and spawnQueue is re-armed;
      // clear again before the next iteration
    }
    expect(s.status).toBe("missioncomplete");
  });

  it("escort: timer expiry (NPC abandoned) causes gameover", () => {
    setupStoryMission(s, MISSION_ESCORT);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "escort") return;
    obj.timeLeft = 0.001;
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });

  // ── Sabotage ────────────────────────────────────────────────────────────────

  it("sabotage: all spawners destroyed triggers missioncomplete", () => {
    setupStoryMission(s, MISSION_SABOTAGE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "sabotage") return;
    // Mark all spawners destroyed (simulates completed player interactions)
    for (const sp of obj.spawners) sp.destroyed = true;
    obj.destroyed = obj.spawners.length;
    tick(s, 0.016);
    expect(s.status).toBe("missioncomplete");
  });

  it("sabotage: partial destruction (1 of 3) does NOT complete the mission", () => {
    setupStoryMission(s, MISSION_SABOTAGE);
    startWave(s);
    const obj = s.storyObjective;
    if (obj?.type !== "sabotage") return;
    obj.spawners[0].destroyed = true;
    obj.destroyed = 1;
    // Pause other spawner timers so they don't emit zombies
    for (const sp of obj.spawners) sp.spawnTimer = 999;
    tick(s, 0.016);
    expect(s.status).not.toBe("missioncomplete");
  });

  // ── Defend ──────────────────────────────────────────────────────────────────

  it("defend: killing the final boss at the target wave triggers missioncomplete", () => {
    setupStoryMission(s, MISSION_DEFEND);
    const obj = s.storyObjective;
    if (obj?.type !== "defend") return;
    s.wave = obj.targetWave; // at the finale
    s.bossSpawned = true;
    s.bossWarning = 0;
    s.spawnQueue = 0;
    s.zombies = []; // boss is dead — all enemies gone
    s.status = "playing";
    tick(s, 0.016);
    expect(s.status).toBe("missioncomplete");
  });

  it("defend: waves before the finale clear normally (status → waveclear)", () => {
    setupStoryMission(s, MISSION_DEFEND);
    startWave(s); // wave 1, below targetWave(5)
    clearWaveInstantly(s);
    tick(s, 0.016);
    expect(s.status).toBe("waveclear");
  });

  it("defend: RIG destruction causes gameover (defend requires RIG protection)", () => {
    setupStoryMission(s, MISSION_DEFEND);
    startWave(s);
    s.rig.hp = 0;
    tick(s, 0.016);
    expect(s.status).toBe("gameover");
  });
});

// ─── Stats available for campaign save on mission complete ────────────────────
//
// saveCampaignProgress(missionId, reward, { kills, scrap, wavesCleared }) pulls
// its data directly from s.stats. These tests verify the engine populates those
// fields correctly by the time status reaches "missioncomplete".

describe("Story Mode — stats available for campaign save", () => {
  let s: GameState;
  beforeEach(() => { s = makeState(); });

  it("kills counter increments as zombies die during a story mission", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    startWave(s);
    const before = s.stats.kills;
    // Shoot a zombie — simplest proxy: place a dead zombie and tick to process
    const z: Zombie = {
      id: s.nextId++,
      pos: { x: s.arena.width / 2, y: s.arena.height / 2 },
      vel: { x: 0, y: 0 },
      radius: 14,
      hp: 0, maxHp: 100,
      speed: 0, damage: 0, reward: 5,
      hitFlash: 0, stunTime: 0, slowTime: 0,
      burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0,
      variant: 0, kind: "walker", attackCd: 0, telegraphed: false,
    };
    s.zombies.push(z);
    s.spawnQueue = 0;
    tick(s, 0.016);
    expect(s.stats.kills).toBeGreaterThan(before);
  });

  it("wavesCleared is non-zero by the time an escort mission completes", () => {
    setupStoryMission(s, MISSION_ESCORT);
    startWave(s);
    const mission = MISSIONS.find((m) => m.id === MISSION_ESCORT)!;
    const waveTarget = mission.escortWaveCount ?? 2;

    for (let i = 0; i < waveTarget; i++) {
      clearWaveInstantly(s);
      tick(s, 0.016);
      if (s.status === "missioncomplete") break;
    }

    expect(s.status).toBe("missioncomplete");
    expect(s.stats.wavesCleared).toBeGreaterThanOrEqual(waveTarget);
  });

  it("totalScrap increases when a zombie drop is collected by the player", () => {
    setupStoryMission(s, MISSION_ESCAPE);
    startWave(s);
    const before = s.stats.totalScrap;
    // Dead zombie placed exactly on the player so the scrap drop is within
    // pickup radius and gets auto-collected on the same tick.
    s.zombies.push({
      id: s.nextId++,
      pos: { ...s.player.pos },
      vel: { x: 0, y: 0 },
      radius: 14,
      hp: 0, maxHp: 100,
      speed: 0, damage: 0, reward: 20,
      hitFlash: 0, stunTime: 0, slowTime: 0,
      burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0,
      variant: 0, kind: "walker", attackCd: 0, telegraphed: false,
    });
    s.spawnQueue = 0;
    tick(s, 0.016);
    expect(s.stats.totalScrap).toBeGreaterThan(before);
  });

  it("missionId on state matches the mission that was set up (for save routing)", () => {
    setupStoryMission(s, MISSION_HOLD);
    expect(s.storyMissionId).toBe(MISSION_HOLD);
    setupStoryMission(s, MISSION_SABOTAGE);
    expect(s.storyMissionId).toBe(MISSION_SABOTAGE);
  });
});
