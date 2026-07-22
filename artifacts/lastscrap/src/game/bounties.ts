import type { GameMode } from "./types";

export type BountyState = "active" | "completed" | "failed";

export type Bounty = {
  templateId: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  state: BountyState;
  completedWave: number | null;
  justCompleted: boolean;
  rewardAwarded: boolean;
};

export type BountyTracking = {
  tookDamageThisWave: boolean;
  scrapThisWave: number;
  earnedScrapThisWave: number;
  hordeKillsThisRun: number;
  waveTimer: number;
  explosiveKills: number;
  kindKills: {
    walker: number;
    runner: number;
    brute: number;
    tank: number;
    spitter: number;
    screamer: number;
    bomber: number;
    crawler: number;
    boss: number;
  };
};

export type BountyConditionType =
  | "total_kills"
  | "kind_kills"
  | "total_scrap"
  | "scrap_this_wave"
  | "horde_kills"
  | "no_damage_wave"
  | "fast_wave_clear"
  | "waves_cleared"
  | "explosive_kills";

export type BountyTemplate = {
  id: string;
  name: string;
  description: string;
  target: number;
  reward: number;
  conditionType: BountyConditionType;
  conditionKey?: string;
  /** Modes in which this bounty is never offered. */
  excludeModes?: GameMode[];
  /** Per-mode selection weight multiplier (default 1). Higher = more likely to be drawn. */
  modeWeight?: Partial<Record<GameMode, number>>;
};

export const BOUNTY_POOL: BountyTemplate[] = [
  {
    id: "kill_15",
    name: "BODY COUNT",
    description: "Kill 15 zombies this run",
    target: 15, reward: 15,
    conditionType: "total_kills",
  },
  {
    id: "kill_30",
    name: "CULLING FIELD",
    description: "Kill 30 zombies this run",
    target: 30, reward: 22,
    conditionType: "total_kills",
  },
  {
    id: "kill_60",
    name: "EXTINCTION EVENT",
    description: "Kill 60 zombies this run",
    target: 60, reward: 40,
    conditionType: "total_kills",
  },
  {
    id: "kill_boss",
    name: "BOSS SLAYER",
    description: "Kill 1 boss",
    target: 1, reward: 35,
    conditionType: "kind_kills", conditionKey: "boss",
    // Always completable in boss-rush (every wave is a boss) — weight it heavily there.
    modeWeight: { "boss-rush": 4 },
  },
  {
    id: "kill_brutes",
    name: "BRUTE FORCE",
    description: "Kill 5 brutes this run",
    target: 5, reward: 28,
    conditionType: "kind_kills", conditionKey: "brute",
    // Boss-rush only spawns bosses, no brutes.
    excludeModes: ["boss-rush"],
  },
  {
    id: "kill_runners",
    name: "SPEED DEMONS",
    description: "Kill 15 runners this run",
    target: 15, reward: 25,
    conditionType: "kind_kills", conditionKey: "runner",
    // Boss-rush only spawns bosses, no runners.
    excludeModes: ["boss-rush"],
  },
  {
    id: "kill_crawlers",
    name: "PEST CONTROL",
    description: "Kill 10 crawlers this run",
    target: 10, reward: 20,
    conditionType: "kind_kills", conditionKey: "crawler",
    // Boss-rush only spawns bosses, no crawlers.
    excludeModes: ["boss-rush"],
  },
  {
    id: "kill_bombers",
    name: "DEFUSE PROTOCOL",
    description: "Kill 5 bombers this run",
    target: 5, reward: 30,
    conditionType: "kind_kills", conditionKey: "bomber",
    // Boss-rush only spawns bosses, no bombers.
    excludeModes: ["boss-rush"],
  },
  {
    id: "horde_kills",
    name: "HORDE BREAKER",
    description: "Kill 10 enemies during a horde",
    target: 10, reward: 35,
    conditionType: "horde_kills",
    // No horde events in boss-rush or scavenge.
    excludeModes: ["boss-rush", "scavenge"],
  },
  {
    id: "no_damage_wave",
    name: "GHOST PROTOCOL",
    description: "Clear any wave without taking damage",
    target: 1, reward: 45,
    conditionType: "no_damage_wave",
  },
  {
    id: "fast_wave",
    name: "SPEED CLEAR",
    description: "Clear a wave in under 45 seconds",
    target: 1, reward: 40,
    conditionType: "fast_wave_clear",
  },
  {
    id: "scrap_wave",
    name: "SCRAP BARON",
    description: "Earn 80 scrap in a single wave",
    target: 80, reward: 30,
    conditionType: "scrap_this_wave",
  },
  {
    id: "total_scrap",
    name: "HOARDER",
    description: "Collect 150 scrap this run",
    target: 150, reward: 35,
    conditionType: "total_scrap",
  },
  {
    id: "survive_3_waves",
    name: "IRON OPERATOR",
    description: "Survive 3 waves",
    target: 3, reward: 25,
    conditionType: "waves_cleared",
  },
  {
    id: "explosive_5",
    name: "DEMO SPECIALIST",
    description: "Kill 5 enemies with explosions",
    target: 5, reward: 28,
    conditionType: "explosive_kills",
  },
];

export function createBountyTracking(): BountyTracking {
  return {
    tookDamageThisWave: false,
    scrapThisWave: 0,
    earnedScrapThisWave: 0,
    hordeKillsThisRun: 0,
    waveTimer: 0,
    explosiveKills: 0,
    kindKills: {
      walker: 0, runner: 0, brute: 0, tank: 0,
      spitter: 0, screamer: 0, bomber: 0, crawler: 0, boss: 0,
    },
  };
}

export function resetWaveBountyTracking(tracking: BountyTracking): void {
  tracking.tookDamageThisWave = false;
  tracking.scrapThisWave = 0;
  tracking.earnedScrapThisWave = 0;
  tracking.waveTimer = 0;
}

function lcgRand(seed: number): () => number {
  let s = (seed | 1) & 0xffffffff;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

/**
 * Draw 3 bounties from the pool, filtered and weighted for the current game mode.
 *
 * Filtering: templates with `excludeModes` containing the active mode are removed.
 * Weighting: templates with `modeWeight[mode]` are proportionally more likely to be
 * selected. Uses a weighted reservoir draw (without replacement) so the same bounty
 * cannot be picked twice.
 */
export function drawBounties(seed: number, mode?: GameMode): Bounty[] {
  const rand = lcgRand(seed);

  const eligible = BOUNTY_POOL.filter(
    (t) => !mode || !t.excludeModes?.includes(mode),
  );

  const weights = eligible.map((t) =>
    mode && t.modeWeight?.[mode] != null ? t.modeWeight[mode]! : 1,
  );

  const picked: BountyTemplate[] = [];
  const remaining = [...eligible];
  const remWeights = [...weights];

  const count = Math.min(3, remaining.length);
  for (let i = 0; i < count; i++) {
    const total = remWeights.reduce((a, b) => a + b, 0);
    let pick = rand() * total;
    let idx = 0;
    while (idx < remWeights.length - 1 && pick >= remWeights[idx]) {
      pick -= remWeights[idx];
      idx++;
    }
    picked.push(remaining[idx]);
    remaining.splice(idx, 1);
    remWeights.splice(idx, 1);
  }

  return picked.map((t) => ({
    templateId: t.id,
    name: t.name,
    description: t.description,
    progress: 0,
    target: t.target,
    reward: t.reward,
    state: "active" as BountyState,
    completedWave: null,
    justCompleted: false,
    rewardAwarded: false,
  }));
}

export function tickWaveClearBounties(
  activeBounties: Bounty[],
  tracking: BountyTracking,
  wave: number,
): void {
  for (const b of activeBounties) {
    if (b.state !== "active") continue;
    if (b.templateId === "no_damage_wave" && !tracking.tookDamageThisWave) {
      b.progress = 1;
      b.state = "completed";
      b.completedWave = wave;
      b.justCompleted = true;
    }
    if (b.templateId === "fast_wave" && tracking.waveTimer > 0 && tracking.waveTimer <= 45) {
      b.progress = 1;
      b.state = "completed";
      b.completedWave = wave;
      b.justCompleted = true;
    }
  }
}

export function failActiveBounties(activeBounties: Bounty[]): void {
  for (const b of activeBounties) {
    if (b.state === "active") {
      b.state = "failed";
    }
  }
}

export function awardCompletedBounties(
  activeBounties: Bounty[],
  onAward: (reward: number, bounty: Bounty) => void,
): void {
  for (const b of activeBounties) {
    if (b.state === "completed" && !b.rewardAwarded) {
      b.rewardAwarded = true;
      onAward(b.reward, b);
    }
  }
}
