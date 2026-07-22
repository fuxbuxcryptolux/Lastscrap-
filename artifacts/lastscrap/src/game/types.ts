import { AbilityId, ThrowableType, WeaponId } from "./weapons";
import { AmmoEffect } from "./mods";

export type Vec2 = { x: number; y: number };

export type Entity = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
};

export type ZombieKind =
  | "walker"
  | "runner"
  | "brute"
  | "tank"
  | "spitter"
  | "screamer"
  | "bomber"
  | "crawler"
  | "boss";

export type Zombie = Entity & {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  reward: number;
  hitFlash: number;
  stunTime: number;
  slowTime: number;
  burnTime: number;    // seconds of burn remaining (incendiary ammo)
  burnDps: number;     // damage per second while burning
  poisonStacks: number; // 0, 1, or 2 stacks of poison
  poisonTime: number;  // seconds of poison remaining
  variant: number; // sprite variant index, assigned at spawn, stable for lifetime
  kind: ZombieKind;
  attackCd: number; // generic ability/attack cooldown (spitter shots, bomber fuse, boss slam)
  telegraphed: boolean; // true while visibly winding up a special attack (bomber fuse, boss slam)
  killedByExplosion?: boolean; // set by explode() so the death loop can attribute the kill
  patrolTarget?: Vec2;      // scavenge mode: current roam destination; replaced when reached
  patrolStuckTimer?: number; // accumulated seconds of failed progress; reassign target at 2s
  patrolCheckPos?: Vec2;    // position snapshot taken at last 0.5s progress check
  patrolCheckTimer?: number; // time since last 0.5s progress check
};

export type ScrapCrate = {
  id: number;
  pos: Vec2;
  value: number;
  claimed: boolean;
};

// Zombie-fired projectile (e.g. Spitter acid glob)
export type ZombieProjectile = Entity & {
  ttl: number;
  damage: number;
  color: string;
};

// Mid-wave random events, distinct from horde waves
export type GameEventType = "airdrop" | "hazard" | "crate";

export type GameEvent = {
  type: GameEventType;
  pos: Vec2;
  radius: number;
  ttl: number; // seconds remaining before the event expires
  progress: number; // 0..1 hold-progress, used by "airdrop"
  claimed: boolean; // one-shot pickup flag, used by "crate"
  variant?: number; // chest sprite variant (0,1,2), used by "crate"
};

export type Bullet = Entity & {
  ttl: number;
  damage: number;
  weapon: WeaponId;
  pierceLeft: number;
  aoeRadius: number;
  aoeDamage: number;
  fromTurret: boolean;
  hitIds: Record<number, true>; // set of zombie ids already hit (for pierce)
  color?: string;               // bullet color override from ammo mod
  ammoEffect?: AmmoEffect;      // status effect applied on hit
};

export type Scrap = Entity & {
  value: number;
  ttl: number;
};

export type Particle = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  ttl: number;
  maxTtl: number;
  color: string;
  size: number;
};

export type FloatingText = {
  id: number;
  pos: Vec2;
  text: string;
  ttl: number;
  maxTtl: number;
};

export type Explosion = {
  id: number;
  pos: Vec2;
  radius: number;
  ttl: number;
  maxTtl: number;
  color: string;
};

export type Grenade = {
  id: number;
  type: ThrowableType; // grenade or sticky
  pos: Vec2;
  vel: Vec2;
  fuse: number; // seconds remaining
  stuckTo: number | null; // zombie id if sticky has attached
  stuckOffset: Vec2 | null;
  damage: number;
  radius: number;
};

export type Mine = {
  id: number;
  pos: Vec2;
  armTime: number; // seconds until armed
  damage: number;
  radius: number;
};

export type Turret = {
  id: number;
  pos: Vec2;
  hp: number;
  maxHp: number;
  fireCd: number;
  facing: number;
  damage: number;
  fireRate: number;
  range: number;
  magnetizerRange: number; // 0 = off; >0 = auto-collect scraps within this px radius
};

export type Upgrades = {
  attack: number;
  health: number;
  armor: number;
  rigPlating: number;
  ammoCap: number;
  ammoRegen: number;
  moveSpeed: number;
  pickupRadius: number;
};

export const UPGRADE_KEYS: (keyof Upgrades)[] = [
  "attack",
  "health",
  "armor",
  "ammoCap",
  "ammoRegen",
  "rigPlating",
  "moveSpeed",
  "pickupRadius",
];

export type GameStatus =
  | "playing"
  | "paused"
  | "shop"
  | "gameover"
  | "waveclear"
  | "missioncomplete";

export type GameMode = "rig-defense" | "boss-rush" | "scavenge" | "story";

// ─── Story Mode objective types ───────────────────────────────────────────────

export type StorySpawner = {
  pos: Vec2;
  destroyed: boolean;
  interactProgress: number; // 0–1 player hold-interact progress
  spawnTimer: number;       // countdown until next zombie spawn from this spawner
};

export type StoryObjective =
  | {
      type: "escape";
      extractionPos: Vec2;
      timeLeft: number;
      reached: boolean;
    }
  | {
      type: "scavenge";
      quota: number;
      timeLeft: number;
    }
  | {
      type: "eliminate";
      bossName: string;
      bossSpawned: boolean;
      killed: boolean;
    }
  | {
      type: "hold";
      zoneCenter: Vec2;
      zoneRadius: number;
      timeLeft: number;
    }
  | {
      type: "escort";
      npcPos: Vec2;
      npcHp: number;
      npcMaxHp: number;
      timeLeft: number;
    }
  | {
      type: "sabotage";
      spawners: StorySpawner[];
      destroyed: number;
    }
  | {
      type: "defend";
      targetWave: number;
    };
