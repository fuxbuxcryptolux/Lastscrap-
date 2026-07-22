// LAST SCRAP — arsenal definitions
// Weapon unlock progression: every 5 waves a new weapon becomes purchasable.
// Only AR and SMG have full-auto fire. All others are semi-auto (tap).

export type WeaponId =
  | "pistol"
  | "smg"
  | "ar"
  | "shotgun"
  | "lrg"
  | "laser"
  | "gatling"
  | "launcher"
  | "rpg";

export type Weapon = {
  id: WeaponId;
  name: string;
  short: string;
  cost: number;
  unlockWave: number; // requires this many waves cleared in the run
  damage: number;
  tapInterval: number; // s between semi-auto shots
  autoInterval: number; // s between full-auto shots (0 = no auto — pistol/shotgun/lrg/launcher/rpg are semi-only)
  magSize: number;
  reloadRate: number; // rounds/sec base while reloading
  pellets: number; // shots fired per trigger pull
  spreadDeg: number;
  pierce: number; // # of zombies bullet passes through
  aoeRadius: number; // 0 = no explosion
  aoeDamage: number;
  projectileSpeed: number;
  bulletColor: string;
  bulletSize: number;
  description: string;
};

export const WEAPONS: Record<WeaponId, Weapon> = {
  pistol: {
    id: "pistol", name: "PISTOL", short: "PSL", cost: 0, unlockWave: 0,
    damage: 14, tapInterval: 0.38, autoInterval: 0, magSize: 18, reloadRate: 7,
    pellets: 1, spreadDeg: 0, pierce: 0, aoeRadius: 0, aoeDamage: 0,
    projectileSpeed: 540, bulletColor: "#FFEFA8", bulletSize: 4,
    description: "Reliable sidearm. Semi-auto only. No frills.",
  },
  smg: {
    id: "smg", name: "SMG", short: "SMG", cost: 50, unlockWave: 5,
    damage: 7, tapInterval: 0.20, autoInterval: 0.07, magSize: 28, reloadRate: 13,
    pellets: 1, spreadDeg: 8, pierce: 0, aoeRadius: 0, aoeDamage: 0,
    projectileSpeed: 540, bulletColor: "#FFEFA8", bulletSize: 4,
    description: "Full-auto spray. High RPS, light spread.",
  },
  ar: {
    id: "ar", name: "ASSAULT RIFLE", short: "AR", cost: 100, unlockWave: 10,
    damage: 16, tapInterval: 0.22, autoInterval: 0.09, magSize: 30, reloadRate: 11,
    pellets: 1, spreadDeg: 2.5, pierce: 0, aoeRadius: 0, aoeDamage: 0,
    projectileSpeed: 600, bulletColor: "#FFEFA8", bulletSize: 4,
    description: "Full-auto. Balanced damage and accuracy.",
  },
  shotgun: {
    id: "shotgun", name: "SHOTGUN", short: "SHT", cost: 75, unlockWave: 15,
    damage: 9, tapInterval: 0.68, autoInterval: 0, magSize: 6, reloadRate: 3.5,
    pellets: 7, spreadDeg: 32, pierce: 0, aoeRadius: 0, aoeDamage: 0,
    projectileSpeed: 500, bulletColor: "#FFD37A", bulletSize: 4,
    description: "7-pellet spread. Brutal up close. Semi-auto.",
  },
  lrg: {
    id: "lrg", name: "LONG-RANGE RIFLE", short: "LRG", cost: 160, unlockWave: 17,
    damage: 60, tapInterval: 0.90, autoInterval: 0, magSize: 5, reloadRate: 2.2,
    pellets: 1, spreadDeg: 0, pierce: 3, aoeRadius: 0, aoeDamage: 0,
    projectileSpeed: 900, bulletColor: "#39FF14", bulletSize: 5,
    description: "Sniper-grade. Pierces 3 targets. Semi-auto.",
  },
  laser: {
    id: "laser", name: "LASER RIFLE", short: "LSR", cost: 220, unlockWave: 20,
    damage: 22, tapInterval: 0.18, autoInterval: 0, magSize: 24, reloadRate: 6,
    pellets: 1, spreadDeg: 0, pierce: 2, aoeRadius: 0, aoeDamage: 0,
    projectileSpeed: 1100, bulletColor: "#FF2A95", bulletSize: 5,
    description: "Piercing energy beams. No spread. Semi-auto.",
  },
  gatling: {
    id: "gatling", name: "GATLING GUN", short: "GAT", cost: 320, unlockWave: 25,
    damage: 9, tapInterval: 0.10, autoInterval: 0.045, magSize: 80, reloadRate: 20,
    pellets: 1, spreadDeg: 5, pierce: 0, aoeRadius: 0, aoeDamage: 0,
    projectileSpeed: 620, bulletColor: "#FFEFA8", bulletSize: 4,
    description: "Full-auto sustained fire. Massive magazine.",
  },
  launcher: {
    id: "launcher", name: "GRENADE LAUNCHER", short: "GRL", cost: 260, unlockWave: 30,
    damage: 28, tapInterval: 0.60, autoInterval: 0, magSize: 4, reloadRate: 1.0,
    pellets: 1, spreadDeg: 0, pierce: 0, aoeRadius: 75, aoeDamage: 60,
    projectileSpeed: 460, bulletColor: "#F39C12", bulletSize: 8,
    description: "Explosive shells. 75px AoE. Semi-auto.",
  },
  rpg: {
    id: "rpg", name: "RPG", short: "RPG", cost: 440, unlockWave: 35,
    damage: 0, tapInterval: 1.0, autoInterval: 0, magSize: 1, reloadRate: 0.45,
    pellets: 1, spreadDeg: 0, pierce: 0, aoeRadius: 130, aoeDamage: 160,
    projectileSpeed: 380, bulletColor: "#FF2A2A", bulletSize: 10,
    description: "Devastating single-shot AoE rocket. Semi-auto.",
  },
};

// Ordered by unlock wave (progression order)
export const WEAPON_ORDER: WeaponId[] = [
  "pistol", "smg", "ar", "shotgun", "lrg", "laser", "gatling", "launcher", "rpg",
];

// --- Throwables ---
export type ThrowableType = "grenade" | "sticky" | "mine";

export type ThrowableDef = {
  id: ThrowableType;
  name: string;
  short: string;
  cost: number;
  unlockWave: number;
  damage: number;
  radius: number;
  fuseTime: number;
  description: string;
};

export const THROWABLES: Record<ThrowableType, ThrowableDef> = {
  grenade: {
    id: "grenade", name: "GRENADE", short: "GRN",
    cost: 10, unlockWave: 5, damage: 75, radius: 85, fuseTime: 1.6,
    description: "Lobs forward. 1.6s fuse. 85px AoE.",
  },
  sticky: {
    id: "sticky", name: "STICKY GRENADE", short: "STK",
    cost: 18, unlockWave: 10, damage: 120, radius: 70, fuseTime: 1.8,
    description: "Sticks to first zombie hit.",
  },
  mine: {
    id: "mine", name: "PROXIMITY MINE", short: "MIN",
    cost: 24, unlockWave: 15, damage: 145, radius: 80, fuseTime: 0.6,
    description: "Drops at your feet. Trips on contact.",
  },
};

export const THROWABLE_ORDER: ThrowableType[] = ["grenade", "sticky", "mine"];

// --- Turret ---
// One turret, purchased once and permanently owned. Upgradeable with 4 stats.
export const TURRET_PURCHASE_COST = 350;
export const TURRET_PURCHASE_WAVE = 50; // unlocked after wave 50
export const TURRET_REDEPLOY_COOLDOWN = 14;
export const TURRET_MAX_LEVEL = 6; // levels 1–6 (5 upgrades per stat)

export type TurretStatKey = "damage" | "fireRate" | "defense" | "magnetizer";

// Cost to upgrade level N → N+1 (index 0 = 1→2, index 4 = 5→6)
export const TURRET_UPGRADE_COSTS: Record<TurretStatKey, number[]> = {
  damage:     [80, 120, 170, 240, 310],
  fireRate:   [70, 110, 155, 210, 280],
  defense:    [65, 100, 145, 200, 270],
  magnetizer: [90, 130, 185, 255, 330],
};

export function turretDamageForLevel(lv: number): number {
  return Math.round(12 * (1 + (lv - 1) * 0.45));
}
export function turretFireRateForLevel(lv: number): number {
  return +(2.5 * (1 + (lv - 1) * 0.35)).toFixed(2);
}
export function turretHpForLevel(lv: number): number {
  return Math.round(100 * (1 + (lv - 1) * 0.60));
}
export function turretMagnetizerRange(lv: number): number {
  // lv 1 = off, lv 2-6 = 80/120/160/200/240 px
  return lv <= 1 ? 0 : 80 + (lv - 2) * 40;
}

// --- Abilities ---
// Unlock every 10 waves. Only ONE equipped at a time.
export type AbilityId = "dash" | "grenade" | "flashbang" | "emp" | "overdrive";

export type AbilityDef = {
  id: AbilityId;
  name: string;
  short: string;
  unlockCost: number; // scrap to unlock
  upgradeBaseCost: number; // scrap for level 2; scales up per level
  maxLevel: number;
  unlockWave: number;
  icon: string; // MaterialCommunityIcons name
  color: string;
  description: string;
  baseCooldown: number; // seconds
  baseValue: number; // magnitude: dmg, stun secs, dash dist, slow %, buff secs
  baseRadius: number; // px (0 for self-target abilities like dash/overdrive)
};

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  dash: {
    id: "dash", name: "DASH", short: "DSH",
    unlockCost: 40, upgradeBaseCost: 30, maxLevel: 5, unlockWave: 10,
    icon: "run-fast", color: "#00FFFF",
    description: "Burst forward, briefly invulnerable. Escape or close distance.",
    baseCooldown: 3.5, baseValue: 190, baseRadius: 0,
  },
  grenade: {
    id: "grenade", name: "FRAG BLAST", short: "FRG",
    unlockCost: 55, upgradeBaseCost: 40, maxLevel: 6, unlockWave: 20,
    icon: "grenade", color: "#F39C12",
    description: "Expanding AoE blast at your position. No ammo cost.",
    baseCooldown: 6, baseValue: 80, baseRadius: 110,
  },
  flashbang: {
    id: "flashbang", name: "FLASH BANG", short: "FLB",
    unlockCost: 70, upgradeBaseCost: 45, maxLevel: 6, unlockWave: 30,
    icon: "flash", color: "#FFEFA8",
    description: "Paralyzes all zombies in radius. No damage, pure control.",
    baseCooldown: 9, baseValue: 2.2, baseRadius: 160,
  },
  emp: {
    id: "emp", name: "EMP PULSE", short: "EMP",
    unlockCost: 80, upgradeBaseCost: 55, maxLevel: 5, unlockWave: 40,
    icon: "flash-triangle", color: "#4FC3F7",
    description: "Shockwave that heavily slows every zombie in range for a time.",
    baseCooldown: 11, baseValue: 4, baseRadius: 240,
  },
  overdrive: {
    id: "overdrive", name: "OVERDRIVE", short: "OVD",
    unlockCost: 100, upgradeBaseCost: 65, maxLevel: 5, unlockWave: 50,
    icon: "lightning-bolt", color: "#FF2A95",
    description: "Temporary surge: faster fire + bonus damage for a few seconds.",
    baseCooldown: 16, baseValue: 5, baseRadius: 0,
  },
};

export const ABILITY_ORDER: AbilityId[] = [
  "dash", "grenade", "flashbang", "emp", "overdrive",
];
