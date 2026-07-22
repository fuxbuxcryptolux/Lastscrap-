// LAST SCRAP — Weapon Modification System
// Mods slot into weapons to alter stats or add ammo effects.
// Each weapon has MOD_SLOTS slots. Only one ammo-type mod per weapon at a time.

export type ModFamily = "stat" | "ammo";
export type AmmoEffect = "fire" | "cryo" | "poison" | "laser";

export type ModId =
  | "rapid_spring"
  | "auto_reloader"
  | "extended_mag"
  | "hot_barrel"
  | "incendiary"
  | "cryo"
  | "poison_tip"
  | "laser_core";

export type Mod = {
  id: ModId;
  family: ModFamily;
  label: string;
  shortLabel: string;
  description: string;
  cost: number;
  color: string;
  stackCap: number;          // max copies of this mod across all slots on one weapon
  fireRateMul: number;       // multiplied by fire interval (< 1 = faster fire)
  reloadRateMul: number;     // multiplied by reloadRate (> 1 = faster reload)
  magBonus: number;          // added to magSize
  projectileSpeedMul: number;
  piercePlus: number;        // extra enemies pierced per bullet
  ammoEffect: AmmoEffect | null;
};

export const MOD_SLOTS = 3;

export const MODS: Record<ModId, Mod> = {
  rapid_spring: {
    id: "rapid_spring", family: "stat", color: "#FF8800",
    label: "RAPID SPRING", shortLabel: "RAPID",
    description: "−15% fire interval. Stacks ×2.",
    cost: 60, stackCap: 2, ammoEffect: null,
    fireRateMul: 0.85, reloadRateMul: 1, magBonus: 0, projectileSpeedMul: 1, piercePlus: 0,
  },
  auto_reloader: {
    id: "auto_reloader", family: "stat", color: "#39FF14",
    label: "AUTO RELOADER", shortLabel: "RELOAD",
    description: "+30% reload speed. Stacks ×2.",
    cost: 55, stackCap: 2, ammoEffect: null,
    fireRateMul: 1, reloadRateMul: 1.30, magBonus: 0, projectileSpeedMul: 1, piercePlus: 0,
  },
  extended_mag: {
    id: "extended_mag", family: "stat", color: "#FFEFA8",
    label: "EXTENDED MAG", shortLabel: "MAG+8",
    description: "+8 rounds per magazine. Stacks ×2.",
    cost: 50, stackCap: 2, ammoEffect: null,
    fireRateMul: 1, reloadRateMul: 1, magBonus: 8, projectileSpeedMul: 1, piercePlus: 0,
  },
  hot_barrel: {
    id: "hot_barrel", family: "stat", color: "#F39C12",
    label: "HOT BARREL", shortLabel: "VELOC",
    description: "+12% projectile speed. Flat bonus, 1 slot only.",
    cost: 45, stackCap: 1, ammoEffect: null,
    fireRateMul: 1, reloadRateMul: 1, magBonus: 0, projectileSpeedMul: 1.12, piercePlus: 0,
  },
  incendiary: {
    id: "incendiary", family: "ammo", color: "#FF4500",
    label: "INCENDIARY", shortLabel: "FIRE",
    description: "Bullets ignite targets. 5 dmg/s burn for 3s.",
    cost: 90, stackCap: 1, ammoEffect: "fire",
    fireRateMul: 1, reloadRateMul: 1, magBonus: 0, projectileSpeedMul: 1, piercePlus: 0,
  },
  cryo: {
    id: "cryo", family: "ammo", color: "#4FC3F7",
    label: "CRYO ROUNDS", shortLabel: "CRYO",
    description: "Bullets freeze targets. Slows 55% for 2s.",
    cost: 85, stackCap: 1, ammoEffect: "cryo",
    fireRateMul: 1, reloadRateMul: 1, magBonus: 0, projectileSpeedMul: 1, piercePlus: 0,
  },
  poison_tip: {
    id: "poison_tip", family: "ammo", color: "#8BC34A",
    label: "POISON TIP", shortLabel: "TOXIN",
    description: "Bullets poison targets. 3 dmg/s for 5s, stacks ×2.",
    cost: 80, stackCap: 1, ammoEffect: "poison",
    fireRateMul: 1, reloadRateMul: 1, magBonus: 0, projectileSpeedMul: 1, piercePlus: 0,
  },
  laser_core: {
    id: "laser_core", family: "ammo", color: "#00FFFF",
    label: "LASER CORE", shortLabel: "PIERCE",
    description: "Bullets pierce 3 extra enemies. Cyan glow.",
    cost: 100, stackCap: 1, ammoEffect: "laser",
    fireRateMul: 1, reloadRateMul: 1, magBonus: 0, projectileSpeedMul: 1, piercePlus: 3,
  },
};

export const MOD_ORDER: ModId[] = [
  "rapid_spring", "auto_reloader", "extended_mag", "hot_barrel",
  "incendiary", "cryo", "poison_tip", "laser_core",
];

export type ModBundle = {
  fireRateMul: number;
  reloadRateMul: number;
  magBonus: number;
  projectileSpeedMul: number;
  piercePlus: number;
  ammoEffect: AmmoEffect | null;
  bulletColor: string | null;
};

export function computeModBundle(modIds: (ModId | null)[]): ModBundle {
  let fireRateMul = 1;
  let reloadRateMul = 1;
  let magBonus = 0;
  let projectileSpeedMul = 1;
  let piercePlus = 0;
  let ammoEffect: AmmoEffect | null = null;
  let bulletColor: string | null = null;
  for (const id of modIds) {
    if (!id) continue;
    const m = MODS[id];
    fireRateMul *= m.fireRateMul;
    reloadRateMul *= m.reloadRateMul;
    magBonus += m.magBonus;
    projectileSpeedMul *= m.projectileSpeedMul;
    piercePlus += m.piercePlus;
    if (m.ammoEffect) {
      ammoEffect = m.ammoEffect;
      bulletColor = m.color;
    }
  }
  return { fireRateMul, reloadRateMul, magBonus, projectileSpeedMul, piercePlus, ammoEffect, bulletColor };
}
