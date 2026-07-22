// LAST SCRAP — Uniform / Skin definitions
// Each uniform costs $4.99 real-money (except ZOMBIE which is wave-locked).
// Bonuses are applied at game-start and between waves via applyUniformBonuses().

export type UniformId =
  | "standard"
  | "spacemarine"
  | "armybasic"
  | "apocalypse"
  | "street"
  | "zombie";

export type UniformDef = {
  id: UniformId;
  name: string;
  tagline: string;
  color: string;       // accent/tint color for UI and player sprite overlay
  price: number;       // 0 = free/unlockable, 499 = $4.99 in cents
  unlockWave?: number; // wave milestone required (zombie only)
  description: string;
  perks: string[];     // short bullet list for shop display
};

export const UNIFORMS: Record<UniformId, UniformDef> = {
  standard: {
    id: "standard",
    name: "STANDARD",
    tagline: "Default field kit.",
    color: "#7A7A7A",
    price: 0,
    description: "No frills. No bonuses. The baseline loadout.",
    perks: ["No stat changes", "Always available"],
  },
  spacemarine: {
    id: "spacemarine",
    name: "SPACE MARINE",
    tagline: "Heavy-duty orbital combat rig.",
    color: "#00FFFF",
    price: 499,
    description: "Reinforced plating, magnetic field array, and tuned laser optics — at the cost of agility.",
    perks: [
      "+25% defense (armor bonus)",
      "Magnetizer active from wave 1",
      "+40% laser rifle damage",
      "−20% movement speed",
    ],
  },
  armybasic: {
    id: "armybasic",
    name: "ARMY BASIC",
    tagline: "Military-grade rapid deployment.",
    color: "#39FF14",
    price: 499,
    description: "Standard-issue military gear optimized for speed and firepower. AR unlocked from the start.",
    perks: [
      "+15% movement speed",
      "Assault Rifle auto-unlocked",
      "+30 ammo reload speed (level bonus)",
      "+30 ammo capacity (level bonus)",
      "All upgrades 20% cheaper",
    ],
  },
  apocalypse: {
    id: "apocalypse",
    name: "APOCALYPSE",
    tagline: "Wasteland warlord loadout.",
    color: "#F39C12",
    price: 499,
    description: "Built for maximum destruction. Grenades and turrets ready to go, scrap hauls tripled.",
    perks: [
      "All grenades & turrets unlocked from wave 1",
      "Grenades & turrets 70% cheaper",
      "Scrap ×3 multiplier after every wave",
      "+20% damage during horde waves",
    ],
  },
  street: {
    id: "street",
    name: "STREET",
    tagline: "Punk-rock survivor. Built different.",
    color: "#FF2A95",
    price: 499,
    description: "The ultimate scavenger rig. Everything cheaper, more scrap, Gatling ready, and double turret slots.",
    perks: [
      "All upgrades & weapons 75% cheaper",
      "Scrap ×4 multiplier after every wave",
      "Gatling Gun auto-unlocked",
      "+100 ammo reload speed (level bonus)",
      "2 turrets deployable simultaneously",
    ],
  },
  zombie: {
    id: "zombie",
    name: "ZOMBIE",
    tagline: "You are the infection.",
    color: "#8BC34A",
    price: 0,
    unlockWave: 200,
    description: "The worst has happened. You are one of the living dead — but your trigger finger still works.",
    perks: [
      "Zombies ignore you completely",
      "Rig takes no damage",
      "Only PISTOL available",
      "−75% movement speed",
      "Reload reset to base level",
    ],
  },
};

export const UNIFORM_ORDER: UniformId[] = [
  "standard", "spacemarine", "armybasic", "apocalypse", "street", "zombie",
];

export type UniformBonuses = {
  defenseMul: number;       // multiply armor value
  magnetizerActive: boolean; // force-enable magnetizer
  laserDamageMul: number;   // extra laser damage multiplier
  moveSpeedMul: number;     // multiply movement speed
  arUnlocked: boolean;      // auto-unlock assault rifle
  ammoCap: number;          // flat ammo cap level bonus
  ammoRegen: number;        // flat ammo regen level bonus
  upgradeCostMul: number;   // multiply all upgrade/weapon costs
  grenadesUnlocked: boolean; // unlock all throwables from wave 1
  turretUnlocked: boolean;   // unlock turret from wave 1
  grenadeCostMul: number;   // multiply throwable costs
  turretCostMul: number;    // multiply turret purchase cost
  scrapMul: number;         // multiply scrap at end of each wave
  hordeDamageMul: number;   // extra damage multiplier during horde waves
  gatlingUnlocked: boolean; // auto-unlock Gatling
  maxTurrets: number;       // max simultaneous turrets (normally 1)
  zombieMode: boolean;      // zombie skin: pistol only, 0 rig damage, no zombie attacks
  gatlingReloadBonus: number;// ammo regen level for gatling unlock
};

export const DEFAULT_BONUSES: UniformBonuses = {
  defenseMul: 1,
  magnetizerActive: false,
  laserDamageMul: 1,
  moveSpeedMul: 1,
  arUnlocked: false,
  ammoCap: 0,
  ammoRegen: 0,
  upgradeCostMul: 1,
  grenadesUnlocked: false,
  turretUnlocked: false,
  grenadeCostMul: 1,
  turretCostMul: 1,
  scrapMul: 1,
  hordeDamageMul: 1,
  gatlingUnlocked: false,
  maxTurrets: 1,
  zombieMode: false,
  gatlingReloadBonus: 0,
};

export function uniformBonuses(id: UniformId): UniformBonuses {
  switch (id) {
    case "spacemarine":
      return {
        ...DEFAULT_BONUSES,
        defenseMul: 1.25,
        magnetizerActive: true,
        laserDamageMul: 1.4,
        moveSpeedMul: 0.80,
      };
    case "armybasic":
      return {
        ...DEFAULT_BONUSES,
        moveSpeedMul: 1.15,
        arUnlocked: true,
        ammoCap: 30,
        ammoRegen: 30,
        upgradeCostMul: 0.80,
      };
    case "apocalypse":
      return {
        ...DEFAULT_BONUSES,
        grenadesUnlocked: true,
        turretUnlocked: true,
        grenadeCostMul: 0.30,
        turretCostMul: 0.30,
        scrapMul: 3,
        hordeDamageMul: 1.20,
      };
    case "street":
      return {
        ...DEFAULT_BONUSES,
        upgradeCostMul: 0.25,
        scrapMul: 4,
        gatlingUnlocked: true,
        ammoRegen: 100,
        maxTurrets: 2,
      };
    case "zombie":
      return {
        ...DEFAULT_BONUSES,
        moveSpeedMul: 0.25,
        zombieMode: true,
      };
    default:
      return { ...DEFAULT_BONUSES };
  }
}
