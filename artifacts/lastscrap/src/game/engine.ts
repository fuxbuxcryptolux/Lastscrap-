import {
  Bullet,
  Explosion,
  FloatingText,
  GameEvent,
  GameEventType,
  GameMode,
  GameStatus,
  Grenade,
  Mine,
  Particle,
  Scrap,
  ScrapCrate,
  StoryObjective,
  StorySpawner,
  Turret,
  Upgrades,
  Vec2,
  Zombie,
  ZombieProjectile,
} from "./types";
import { getMission } from "./missions";
import {
  Bounty,
  BountyTracking,
  BOUNTY_POOL,
  createBountyTracking,
  drawBounties,
  resetWaveBountyTracking,
} from "./bounties";
import {
  ABILITIES,
  AbilityId,
  THROWABLES,
  ThrowableType,
  TURRET_MAX_LEVEL,
  TURRET_PURCHASE_COST,
  TURRET_PURCHASE_WAVE,
  TURRET_REDEPLOY_COOLDOWN,
  TURRET_UPGRADE_COSTS,
  TurretStatKey,
  Weapon,
  WeaponId,
  WEAPONS,
  turretDamageForLevel,
  turretFireRateForLevel,
  turretHpForLevel,
  turretMagnetizerRange,
} from "./weapons";
import { ModId, computeModBundle, MOD_SLOTS, MODS } from "./mods";
import { UniformId, uniformBonuses, DEFAULT_BONUSES } from "./uniforms";

export const BASE_UPGRADES: Upgrades = {
  attack: 1,
  health: 1,
  armor: 1,
  rigPlating: 1,
  ammoCap: 1,
  ammoRegen: 1,
  moveSpeed: 1,
  pickupRadius: 1,
};

export function upgradeValue(key: keyof Upgrades, level: number): number {
  switch (key) {
    case "attack":
      return 1 + (level - 1) * 0.12;
    case "health":
      return 100 + (level - 1) * 25;
    case "armor":
      return Math.min(0.65, (level - 1) * 0.05);
    case "rigPlating":
      return 300 + (level - 1) * 80;
    case "ammoCap":
      return (level - 1) * 4;
    case "ammoRegen":
      return 1 + (level - 1) * 0.15;
    case "moveSpeed":
      return 150 + (level - 1) * 15;
    case "pickupRadius":
      return 60 + (level - 1) * 18;
  }
}

export function upgradeCost(key: keyof Upgrades, level: number): number {
  const base: Record<keyof Upgrades, number> = {
    attack: 26, health: 22, armor: 30, rigPlating: 28,
    ammoCap: 20, ammoRegen: 24, moveSpeed: 20, pickupRadius: 16,
  };
  return Math.round(base[key] * Math.pow(1.65, level - 1));
}

export const UPGRADE_META: Record<
  keyof Upgrades,
  { label: string; sub: string; icon: { family: string; name: string }; color: string }
> = {
  attack: { label: "ATTACK", sub: "Weapon damage ×", icon: { family: "MaterialCommunityIcons", name: "ammunition" }, color: "#FF2A2A" },
  health: { label: "HEALTH", sub: "Operator max HP", icon: { family: "FontAwesome5", name: "heartbeat" }, color: "#39FF14" },
  armor: { label: "ARMOR", sub: "Damage reduction", icon: { family: "MaterialCommunityIcons", name: "shield-half-full" }, color: "#9a9a9a" },
  rigPlating: { label: "RIG PLATING", sub: "Reactor integrity", icon: { family: "Ionicons", name: "nuclear" }, color: "#00FFFF" },
  ammoCap: { label: "MAG SIZE", sub: "Bonus rounds per mag", icon: { family: "MaterialCommunityIcons", name: "package-variant" }, color: "#F39C12" },
  ammoRegen: { label: "RELOAD SPEED", sub: "Reload rate ×", icon: { family: "MaterialCommunityIcons", name: "autorenew" }, color: "#D35400" },
  moveSpeed: { label: "MOBILITY", sub: "Boot servos", icon: { family: "MaterialCommunityIcons", name: "run-fast" }, color: "#EAEAEA" },
  pickupRadius: { label: "MAGNETIZER", sub: "Scrap pickup radius", icon: { family: "MaterialCommunityIcons", name: "magnet" }, color: "#F39C12" },
};

export type GameState = {
  arena: { width: number; height: number }; // world bounds — much larger than the viewport
  viewport: { width: number; height: number }; // visible screen size
  camera: Vec2; // world-space point the camera is currently centered on
  player: {
    pos: Vec2;
    facing: number;
    hp: number;
    maxHp: number;
    fireCd: number;
    damageFlash: number;
    hurtSfxCd: number;
    ammo: number;
    maxAmmo: number;
    ammoAcc: number;
    reloading: boolean;
    idleTimer: number;
    hasAimedThisTouch: boolean;
    dashTime: number;
    dashVel: Vec2;
    invuln: number;
    overdrive: number;
    laserCharge: number;    // 0–1 charge progress
    laserCharging: boolean; // true while hold is building charge
    crateBoost: number;     // seconds remaining of weapon-crate damage buff
  };
  rig: { pos: Vec2; hp: number; maxHp: number; radius: number; damageFlash: number; hitSfxCd: number };
  zombies: Zombie[];
  zombieProjectiles: ZombieProjectile[];
  bullets: Bullet[];
  scraps: Scrap[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  explosions: Explosion[];
  grenades: Grenade[];
  mines: Mine[];
  turrets: Turret[];
  upgrades: Upgrades;
  equippedWeapon: WeaponId;
  ownedWeapons: WeaponId[];
  weaponMods: Partial<Record<WeaponId, (ModId | null)[]>>;
  throwables: Record<ThrowableType, number>;
  turretOwned: boolean;
  turretUpgrades: { damage: number; fireRate: number; defense: number; magnetizer: number };
  abilities: Record<AbilityId, { level: number; cooldown: number }>;
  equippedAbility: AbilityId | null;
  turretRedeployCd: number;
  scrap: number;
  wave: number;
  spawnQueue: number;
  spawnCd: number;
  isHorde: boolean;
  hordeWarning: number;
  hordeTimer: number;
  event: GameEvent | null;
  eventCd: number;
  bossWarning: number;
  bossSpawned: boolean;
  status: GameStatus;
  stats: { kills: number; totalScrap: number; earnedScrap: number; wavesCleared: number };
  flash: { screen: number; rig: number };
  input: Vec2;
  fireHeld: boolean;
  fireQueued: boolean;
  nextId: number;
  equippedUniform: UniformId;
  sfxQueue: string[];
  gameMode: GameMode;
  scavengeQuota: number;
  scavengeCollected: number;
  scavengeTimeLeft: number;
  scavengeCrates: ScrapCrate[];
  activeBounties: Bounty[];
  bountyTracking: BountyTracking;
  storyMissionId: number | null;
  storyObjective: StoryObjective | null;
  workbench: { pos: Vec2; radius: number; active: boolean } | null;
};

export function getEquipped(s: GameState): Weapon {
  return WEAPONS[s.equippedWeapon];
}

export function maxAmmoFor(s: GameState, w: Weapon): number {
  const slots = s.weaponMods[w.id] ?? [];
  const bundle = computeModBundle(slots);
  return w.magSize + Math.round(upgradeValue("ammoCap", s.upgrades.ammoCap)) + bundle.magBonus;
}

// World is rendered much larger than the screen; the camera follows the
// player while the RIG stays put at the world center as a fixed defendable point.
const WORLD_SCALE = 2.6;

// The map background image fills the entire arena — no void areas, no walls.
// Movement is free across the whole world; only the arena edge blocks passage.

// Returns the full arena as playable bounds (backward-compat helper).
export function mapBounds(arena: { width: number; height: number }) {
  return { left: 0, top: 0, right: arena.width, bottom: arena.height, mapH: arena.height, mapTop: 0 };
}

// Wall collision cells traced from the maze artwork (normalized [x, y, w, h]
// fractions of the arena). Generated from a hand-drawn overlay of the actual
// wall positions in maze.png — follows the curved rings far more accurately
// than hand-placed rectangles.
export const WALL_CELLS: [number, number, number, number][] = [
  [0.3281, 0, 0.0625, 0.0278],
  [0.6406, 0, 0.0469, 0.0278],
  [0.2969, 0.0278, 0.0469, 0.0278],
  [0.6719, 0.0278, 0.0313, 0.0278],
  [0.8438, 0.0278, 0.0469, 0.0278],
  [0.2656, 0.0556, 0.0469, 0.0278],
  [0.6875, 0.0556, 0.0313, 0.0278],
  [0.8281, 0.0556, 0.0625, 0.0278],
  [0.25, 0.0833, 0.0469, 0.0278],
  [0.4375, 0.0833, 0.0313, 0.0278],
  [0.5313, 0.0833, 0.0469, 0.0278],
  [0.7031, 0.0833, 0.0313, 0.0278],
  [0.8281, 0.0833, 0.0156, 0.0278],
  [0.8594, 0.0833, 0.0313, 0.0278],
  [0.25, 0.1111, 0.0156, 0.0278],
  [0.4063, 0.1111, 0.0781, 0.0278],
  [0.5156, 0.1111, 0.0313, 0.0833],
  [0.5625, 0.1111, 0.0469, 0.0278],
  [0.7188, 0.1111, 0.0313, 0.0278],
  [0.8281, 0.1111, 0.0625, 0.0278],
  [0.2344, 0.1389, 0.0313, 0.0278],
  [0.3906, 0.1389, 0.0313, 0.0278],
  [0.4531, 0.1389, 0.0313, 0.0278],
  [0.5938, 0.1389, 0.0313, 0.0278],
  [0.7031, 0.1389, 0.0469, 0.0278],
  [0.8438, 0.1389, 0.0313, 0.0278],
  [0.2344, 0.1667, 0.0156, 0.0556],
  [0.3594, 0.1667, 0.0469, 0.0278],
  [0.4688, 0.1667, 0.0156, 0.0556],
  [0.6094, 0.1667, 0.0313, 0.0278],
  [0.6875, 0.1667, 0.0313, 0.0278],
  [0.7344, 0.1667, 0.0313, 0.0278],
  [0.3438, 0.1944, 0.0469, 0.0278],
  [0.5156, 0.1944, 0.0469, 0.0278],
  [0.625, 0.1944, 0.0313, 0.0556],
  [0.6875, 0.1944, 0.0156, 0.0278],
  [0.75, 0.1944, 0.0313, 0.0278],
  [0.2188, 0.2222, 0.0313, 0.0278],
  [0.3281, 0.2222, 0.0313, 0.0278],
  [0.4375, 0.2222, 0.0469, 0.0278],
  [0.5313, 0.2222, 0.0625, 0.0278],
  [0.7656, 0.2222, 0.0156, 0.0556],
  [0.2188, 0.25, 0.0156, 0.1667],
  [0.3125, 0.25, 0.0313, 0.0278],
  [0.4219, 0.25, 0.0313, 0.0278],
  [0.5625, 0.25, 0.0469, 0.0278],
  [0.6406, 0.25, 0.0313, 0.0278],
  [0.3125, 0.2778, 0.0156, 0.0278],
  [0.3906, 0.2778, 0.0469, 0.0278],
  [0.4688, 0.2778, 0.0469, 0.0278],
  [0.5469, 0.2778, 0.0313, 0.0278],
  [0.5938, 0.2778, 0.0469, 0.0278],
  [0.6563, 0.2778, 0.0313, 0.0278],
  [0.7344, 0.2778, 0.0156, 0.0278],
  [0.7656, 0.2778, 0.0313, 0.0278],
  [0.2969, 0.3056, 0.0313, 0.0278],
  [0.375, 0.3056, 0.0313, 0.0278],
  [0.4531, 0.3056, 0.125, 0.0278],
  [0.625, 0.3056, 0.0313, 0.0556],
  [0.6719, 0.3056, 0.0313, 0.0278],
  [0.7813, 0.3056, 0.0156, 0.0556],
  [0.2969, 0.3333, 0.0156, 0.0833],
  [0.3594, 0.3333, 0.0313, 0.0278],
  [0.4375, 0.3333, 0.0313, 0.0278],
  [0.5313, 0.3333, 0.0469, 0.0278],
  [0.6875, 0.3333, 0.0156, 0.0556],
  [0.3594, 0.3611, 0.0156, 0.0278],
  [0.4219, 0.3611, 0.0313, 0.0278],
  [0.5625, 0.3611, 0.0313, 0.0278],
  [0.7813, 0.3611, 0.0313, 0.0556],
  [0.3438, 0.3889, 0.0313, 0.0278],
  [0.4063, 0.3889, 0.0313, 0.0278],
  [0.5781, 0.3889, 0.0313, 0.0278],
  [0.6875, 0.3889, 0.0313, 0.0278],
  [0.2188, 0.4167, 0.0313, 0.0556],
  [0.2813, 0.4167, 0.0313, 0.0278],
  [0.3438, 0.4167, 0.0156, 0.1944],
  [0.3906, 0.4167, 0.0313, 0.0556],
  [0.5938, 0.4167, 0.0156, 0.1389],
  [0.7031, 0.4167, 0.0156, 0.1389],
  [0.7969, 0.4167, 0.0313, 0.0278],
  [0.2813, 0.4444, 0.0156, 0.1667],
  [0.7813, 0.4444, 0.0313, 0.0278],
  [0.2344, 0.4722, 0.0156, 0.0556],
  [0.3906, 0.4722, 0.0156, 0.0278],
  [0.6406, 0.4722, 0.0313, 0.0556],
  [0.75, 0.4722, 0.0469, 0.0278],
  [0.3906, 0.5, 0.0313, 0.0556],
  [0.75, 0.5, 0.0156, 0.1111],
  [0.2188, 0.5278, 0.0313, 0.0278],
  [0.6406, 0.5278, 0.0156, 0.0833],
  [0.8125, 0.5278, 0.0156, 0.1111],
  [0.2031, 0.5556, 0.0313, 0.1111],
  [0.4063, 0.5556, 0.0156, 0.0278],
  [0.5781, 0.5556, 0.0313, 0.0278],
  [0.6875, 0.5556, 0.0313, 0.0833],
  [0.4063, 0.5833, 0.0313, 0.0278],
  [0.5625, 0.5833, 0.0313, 0.0278],
  [0.2813, 0.6111, 0.0313, 0.0278],
  [0.3438, 0.6111, 0.0313, 0.0556],
  [0.4219, 0.6111, 0.0313, 0.0278],
  [0.5469, 0.6111, 0.0469, 0.0278],
  [0.625, 0.6111, 0.0313, 0.0278],
  [0.2969, 0.6389, 0.0156, 0.0556],
  [0.4375, 0.6389, 0.0313, 0.0278],
  [0.5156, 0.6389, 0.0625, 0.0278],
  [0.625, 0.6389, 0.0156, 0.0278],
  [0.6875, 0.6389, 0.0156, 0.0278],
  [0.7969, 0.6389, 0.0313, 0.0278],
  [0.2188, 0.6667, 0.0156, 0.0556],
  [0.3594, 0.6667, 0.0156, 0.0278],
  [0.6094, 0.6667, 0.0313, 0.0278],
  [0.6719, 0.6667, 0.0313, 0.0278],
  [0.7969, 0.6667, 0.0156, 0.0278],
  [0.2969, 0.6944, 0.0313, 0.0278],
  [0.3594, 0.6944, 0.0313, 0.0278],
  [0.5781, 0.6944, 0.0469, 0.0278],
  [0.6719, 0.6944, 0.0156, 0.0278],
  [0.7813, 0.6944, 0.0313, 0.0556],
  [0.2188, 0.7222, 0.0313, 0.0278],
  [0.3125, 0.7222, 0.0313, 0.0278],
  [0.375, 0.7222, 0.0469, 0.0278],
  [0.5313, 0.7222, 0.0781, 0.0278],
  [0.6563, 0.7222, 0.0313, 0.0278],
  [0.2344, 0.75, 0.0156, 0.0833],
  [0.3281, 0.75, 0.0469, 0.0278],
  [0.4063, 0.75, 0.0781, 0.0278],
  [0.5156, 0.75, 0.0469, 0.0278],
  [0.6406, 0.75, 0.0313, 0.0278],
  [0.7813, 0.75, 0.0156, 0.0278],
  [0.3438, 0.7778, 0.0469, 0.0278],
  [0.4688, 0.7778, 0.0156, 0.0833],
  [0.6094, 0.7778, 0.0469, 0.0278],
  [0.7656, 0.7778, 0.0313, 0.0278],
  [0.3594, 0.8056, 0.0469, 0.0278],
  [0.5625, 0.8056, 0.0625, 0.0278],
  [0.75, 0.8056, 0.0313, 0.0278],
  [0.3906, 0.8333, 0.0625, 0.0278],
  [0.5313, 0.8333, 0.0625, 0.0278],
  [0.7344, 0.8333, 0.0313, 0.0278],
  [0.4375, 0.8611, 0.0469, 0.0278],
  [0.5313, 0.8611, 0.0156, 0.0278],
  [0.4688, 0.8889, 0.0156, 0.0278],
];

// Rig-defense map (1408×768) wall cells.
// Each entry: [normX, normY, normW, normH] (0–1, relative to arena size).
// Use solid rectangular blocks (not thin wall outlines) to prevent tunneling.
export const RIGDEF_WALL_CELLS: [number, number, number, number][] = [
  // --- Outer border (dark frame, 5% thick) ---
  [0.00, 0.00, 1.00, 0.05],   // top
  [0.00, 0.95, 1.00, 0.05],   // bottom
  [0.00, 0.05, 0.05, 0.90],   // left
  [0.95, 0.05, 0.05, 0.90],   // right

  // --- Top-left warehouse complex (solid blocks, not thin wall strips) ---
  [0.05, 0.05, 0.15, 0.24],   // NW corner room (solid)
  [0.05, 0.29, 0.15, 0.08],   // SW lower section of warehouse
  [0.20, 0.05, 0.06, 0.14],   // divider between NW and center rooms
  [0.26, 0.05, 0.14, 0.20],   // upper-center room (solid fill)
  [0.38, 0.05, 0.06, 0.24],   // east wall of building

  // --- Top-right car junkyard (solid) ---
  [0.62, 0.05, 0.33, 0.30],

  // --- Center-right horizontal log/plank barrier ---
  [0.64, 0.33, 0.22, 0.06],

  // --- Left-side shanty cluster ---
  [0.05, 0.42, 0.15, 0.28],

  // --- Bottom-left shantytown ---
  [0.05, 0.72, 0.44, 0.23],

  // --- Bottom-center shack cluster ---
  [0.32, 0.76, 0.28, 0.19],

  // --- Bottom-right debris/cars ---
  [0.83, 0.62, 0.12, 0.33],
];

function cellsForMode(mode: GameMode): [number, number, number, number][] {
  return mode === "rig-defense" ? RIGDEF_WALL_CELLS : WALL_CELLS;
}

// Memoized per arena size — isInWall runs per entity per frame, so avoid
// remapping all cells on every call.
let wallRectCache: { w: number; h: number; cells: [number, number, number, number][]; rects: [number, number, number, number][] } | null = null;

export function getWallRects(arena: { width: number; height: number }, mode?: GameMode): [number, number, number, number][] {
  const cells = cellsForMode(mode ?? "rig-defense");
  const W = arena.width;
  const H = arena.height;
  if (!wallRectCache || wallRectCache.w !== W || wallRectCache.h !== H || wallRectCache.cells !== cells) {
    wallRectCache = {
      w: W, h: H, cells,
      rects: cells.map(([x, y, w, h]) => [x * W, y * H, w * W, h * H]),
    };
  }
  return wallRectCache.rects;
}

function isInWall(x: number, y: number, r: number, arena: { width: number; height: number }, mode?: GameMode): boolean {
  for (const [wx, wy, ww, wh] of getWallRects(arena, mode)) {
    if (x + r > wx && x - r < wx + ww && y + r > wy && y - r < wy + wh) return true;
  }
  return false;
}

function resolveWallCollision(oldX: number, oldY: number, newX: number, newY: number, r: number, arena: { width: number; height: number }, mode?: GameMode): { x: number; y: number } {
  if (!isInWall(newX, newY, r, arena, mode)) return { x: newX, y: newY };
  const slideX = !isInWall(newX, oldY, r, arena, mode) ? newX : oldX;
  const slideY = !isInWall(oldX, newY, r, arena, mode) ? newY : oldY;
  if (slideX !== oldX) return { x: slideX, y: oldY };
  if (slideY !== oldY) return { x: oldX, y: slideY };
  return { x: oldX, y: oldY };
}

// Advance a zombie by its velocity, sliding along maze walls instead of
// passing through them.
function moveZombieWithWalls(z: { pos: Vec2; vel: Vec2; radius: number }, dt: number, arena: { width: number; height: number }, mode?: GameMode): void {
  const p = resolveWallCollision(
    z.pos.x, z.pos.y,
    z.pos.x + z.vel.x * dt,
    z.pos.y + z.vel.y * dt,
    Math.min(z.radius, 14), arena, mode,
  );
  z.pos.x = p.x;
  z.pos.y = p.y;
}

// True when the RIG exists as a gameplay object. In scavenge mode and story
// escape missions the RIG is hidden — it must not be targeted, damaged, or
// act as an obstacle.
export function isRigActive(s: GameState): boolean {
  return s.gameMode !== "scavenge" && !(s.gameMode === "story" && s.storyObjective?.type === "escape");
}

const PLAYER_RADIUS = 14;

// Returns a random position in the arena avoiding collision zones.
function randomMapPos(arena: { width: number; height: number }, mode?: GameMode): Vec2 {
  const margin = 80;
  for (let i = 0; i < 25; i++) {
    const x = margin + Math.random() * (arena.width - margin * 2);
    const y = margin + Math.random() * (arena.height - margin * 2);
    if (!isInWall(x, y, 22, arena, mode)) return { x, y };
  }
  return { x: arena.width * 0.32, y: arena.height * 0.32 };
}

function spawnFloatingText(s: GameState, pos: Vec2, text: string, color: string): void {
  s.floatingTexts.push({
    id: s.nextId++,
    pos: { x: pos.x, y: pos.y - 14 },
    text,
    ttl: 1.2,
    maxTtl: 1.2,
  });
}

function clampCameraAxis(pos: number, viewport: number, world: number): number {
  const half = viewport / 2;
  if (world <= viewport) return world / 2;
  return clamp(pos, half, world - half);
}

export function createState(viewportWidth: number, viewportHeight: number, uniformId: UniformId = "standard", gameMode: GameMode = "rig-defense"): GameState {
  const upgrades = { ...BASE_UPGRADES };
  const playerMaxHp = upgradeValue("health", upgrades.health);
  const rigMaxHp = upgradeValue("rigPlating", upgrades.rigPlating);
  const startWeapon: WeaponId = "pistol";
  const w = WEAPONS[startWeapon];
  const magBonus = Math.round(upgradeValue("ammoCap", upgrades.ammoCap));
  const maxAmmo = w.magSize + magBonus;
  // World dimensions must match the map image aspect ratio:
  // maze.png is 1376×768, rigdef_map.png is 1408×768.
  // Scale by whichever viewport axis needs more room.
  const MAP_ASPECT = gameMode === "rig-defense" ? 1408 / 768 : 1376 / 768;
  const height = Math.max(
    Math.round(viewportHeight * WORLD_SCALE),
    Math.round((viewportWidth * WORLD_SCALE) / MAP_ASPECT),
  );
  const width = Math.round(height * MAP_ASPECT);
  // Spawn at center of maze for most modes; rig-defense has the player spawn
  // near the workbench, away from the RIG at ~0.49, 0.50.
  const playerStart = { x: width * 0.30, y: height * 0.30 };
  const s: GameState = {
    arena: { width, height },
    viewport: { width: viewportWidth, height: viewportHeight },
    camera: {
      x: clampCameraAxis(playerStart.x, viewportWidth, width),
      y: clampCameraAxis(playerStart.y, viewportHeight, height),
    },
    player: {
      pos: playerStart,
      facing: 0,
      hp: playerMaxHp,
      maxHp: playerMaxHp,
      fireCd: 0,
      damageFlash: 0,
      hurtSfxCd: 0,
      ammo: maxAmmo,
      maxAmmo,
      ammoAcc: 0,
      reloading: false,
      idleTimer: 999,
      hasAimedThisTouch: false,
      dashTime: 0,
      dashVel: { x: 0, y: 0 },
      invuln: 0,
      overdrive: 0,
      laserCharge: 0,
      laserCharging: false,
      crateBoost: 0,
    },
    rig: { pos: { x: width * (gameMode === "rig-defense" ? 0.4906 : 0.50), y: height * (gameMode === "rig-defense" ? 0.4960 : 0.50) }, hp: rigMaxHp, maxHp: rigMaxHp, radius: 38, damageFlash: 0, hitSfxCd: 0 },
    zombies: [], zombieProjectiles: [], bullets: [], scraps: [], particles: [],
    explosions: [], grenades: [], mines: [], turrets: [],
    upgrades,
    equippedWeapon: startWeapon,
    ownedWeapons: [startWeapon],
    weaponMods: {},
    throwables: { grenade: 0, sticky: 0, mine: 0 },
    turretOwned: false,
    turretUpgrades: { damage: 1, fireRate: 1, defense: 1, magnetizer: 1 },
    abilities: {
      dash: { level: 0, cooldown: 0 },
      grenade: { level: 0, cooldown: 0 },
      flashbang: { level: 0, cooldown: 0 },
      emp: { level: 0, cooldown: 0 },
      overdrive: { level: 0, cooldown: 0 },
    },
    equippedAbility: null,
    turretRedeployCd: 0,
    scrap: 0,
    wave: 0,
    spawnQueue: 0,
    spawnCd: 0,
    isHorde: false,
    hordeWarning: 0,
    hordeTimer: 0,
    event: null,
    eventCd: 20 + Math.random() * 10,
    bossWarning: 0,
    bossSpawned: false,
    status: "playing",
    stats: { kills: 0, totalScrap: 0, earnedScrap: 0, wavesCleared: 0 },
    flash: { screen: 0, rig: 0 },
    input: { x: 0, y: 0 },
    fireHeld: false,
    fireQueued: false,
    nextId: 1,
    equippedUniform: uniformId,
    sfxQueue: [],
    floatingTexts: [],
    gameMode,
    scavengeQuota: 0,
    scavengeCollected: 0,
    scavengeTimeLeft: 0,
    scavengeCrates: [],
    activeBounties: drawBounties(Date.now(), gameMode),
    bountyTracking: createBountyTracking(),
    storyMissionId: null,
    storyObjective: null,
    workbench: gameMode === "rig-defense" ? { pos: { x: width * 0.3359, y: height * 0.1715 }, radius: 36, active: true } : null,
  };
  applyUniformToState(s, uniformId);
  return s;
}

export function applyUniformToState(s: GameState, uniformId: UniformId) {
  const b = uniformBonuses(uniformId);
  s.equippedUniform = uniformId;

  // ARMY BASIC: AR auto-unlocked
  if (b.arUnlocked && !s.ownedWeapons.includes("ar")) {
    s.ownedWeapons.push("ar");
  }

  // STREET: Gatling auto-unlocked
  if (b.gatlingUnlocked && !s.ownedWeapons.includes("gatling")) {
    s.ownedWeapons.push("gatling");
  }

  // ZOMBIE: only pistol available
  if (b.zombieMode) {
    s.ownedWeapons = ["pistol"];
    s.equippedWeapon = "pistol";
  }

  // ARMY BASIC / STREET: ammo level bonuses (stored as separate fields on state)
  // We represent these by bumping the ammoCap / ammoRegen upgrade levels directly
  if (b.ammoCap > 0) {
    s.upgrades.ammoCap = Math.max(s.upgrades.ammoCap, b.ammoCap + 1);
  }
  if (b.ammoRegen > 0) {
    s.upgrades.ammoRegen = Math.max(s.upgrades.ammoRegen, b.ammoRegen + 1);
  }

  // Recalculate ammo from current weapon after upgrades applied
  const eq = WEAPONS[s.equippedWeapon];
  const magBonus = Math.round(upgradeValue("ammoCap", s.upgrades.ammoCap));
  s.player.maxAmmo = eq.magSize + magBonus;
  s.player.ammo = s.player.maxAmmo;
}

// ─── Story mission setup ──────────────────────────────────────────────────────

export function setupStoryMission(s: GameState, missionId: number): void {
  const mission = getMission(missionId);
  if (!mission) return;
  s.storyMissionId = missionId;
  s.gameMode = "story";
  s.activeBounties = [];
  s.bountyTracking = {
    kindKills: {
      walker: 0, runner: 0, brute: 0, tank: 0,
      spitter: 0, screamer: 0, bomber: 0, crawler: 0, boss: 0,
    },
    scrapThisWave: 0,
    earnedScrapThisWave: 0,
    hordeKillsThisRun: 0,
    explosiveKills: 0,
    tookDamageThisWave: false,
    waveTimer: 0,
  };

  const cx = s.arena.width / 2;
  const cy = s.arena.height / 2;

  switch (mission.objectiveType) {
    case "escape": {
      s.storyObjective = {
        type: "escape",
        extractionPos: {
          x: s.arena.width * 0.10,
          y: s.arena.height * 0.50,
        },
        timeLeft: mission.escapeTimeSecs ?? 120,
        reached: false,
      };
      // Pre-spawn zombies in the outer annular space (between ring 3 and 4)
      for (let i = 0; i < 6; i++) {
        const pos = randomMapPos(s.arena, s.gameMode);
        spawnZombieAt(s, pos.x, pos.y);
      }
      break;
    }
    case "scavenge":
      s.storyObjective = {
        type: "scavenge",
        quota: mission.scavengeQuota ?? 200,
        timeLeft: mission.scavengeTimeSecs ?? 150,
      };
      s.scavengeQuota = mission.scavengeQuota ?? 200;
      s.scavengeCollected = 0;
      s.scavengeTimeLeft = mission.scavengeTimeSecs ?? 150;
      break;
    case "eliminate":
      s.storyObjective = {
        type: "eliminate",
        bossName: mission.eliminateName ?? "TARGET",
        bossSpawned: false,
        killed: false,
      };
      break;
    case "hold":
      s.storyObjective = {
        type: "hold",
        zoneCenter: { x: cx - 60, y: cy + 80 },
        zoneRadius: mission.holdZoneRadius ?? 140,
        timeLeft: mission.holdDurationSecs ?? 180,
      };
      break;
    case "escort": {
      const npcMaxHp = 120;
      const escortDuration = 90; // seconds NPC must survive
      s.storyObjective = {
        type: "escort",
        npcPos: { x: cx + 120, y: cy - 60 },
        npcHp: npcMaxHp,
        npcMaxHp,
        timeLeft: escortDuration,
      };
      break;
    }
    case "sabotage": {
      // Place spawners at valid random map positions, avoiding walls
      const spawners: StorySpawner[] = [];
      for (let i = 0; i < 3; i++) {
        const pos = randomMapPos(s.arena, s.gameMode);
        spawners.push({
          pos,
          destroyed: false,
          interactProgress: 0,
          spawnTimer: 4 + Math.random() * 2,
        });
      }
      s.storyObjective = {
        type: "sabotage",
        spawners,
        destroyed: 0,
      };
      break;
    }
    case "defend":
      s.storyObjective = {
        type: "defend",
        targetWave: mission.defendTargetWave ?? 5,
      };
      break;
  }
}

export const HORDE_INTERVAL = 5;
export const HORDE_WARNING_TIME = 3;
export const HORDE_DURATION = 25; // was 30 — slightly shorter survival window

export function isHordeWave(wave: number): boolean {
  return wave > 0 && wave % HORDE_INTERVAL === 0;
}

// Boss waves land on a cadence deliberately NOT a multiple of HORDE_INTERVAL
// so bosses and hordes never overlap on the same wave.
export const BOSS_INTERVAL = 7;
export const BOSS_WARNING_TIME = 3;

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % BOSS_INTERVAL === 0;
}

// Soft-cap wave scaling — grows steadily through the early/mid game then
// decelerates at high wave counts, so difficulty ramps smoothly instead of
// spiking unfairly on long runs. `rate` controls how fast a stat grows.
const WAVE_SOFTCAP = 65;
// Brief invuln window granted after any zombie contact hit — see usages below.
// Caps how often contact damage can land regardless of how many zombies are
// simultaneously touching the player, without changing sustained single-attacker dps.
const CONTACT_INVULN = 0.35;
// Base contact-dps multiplier (was 1.8/2.0 pre-rebalance). Tuned down alongside the
// invuln window above and the faster auto-aim tracking below so early waves give the
// player a realistic chance to out-shoot 2-3 simultaneous attackers.
const CONTACT_DPS_MUL = 1.3;
function waveCurve(wave: number, rate: number): number {
  return 1 + (rate * wave) / (1 + wave / WAVE_SOFTCAP);
}
// Same soft-cap shape, but for additive base+rate*wave style stats (e.g. speed).
function waveAdd(base: number, wave: number, rate: number): number {
  return base + (rate * wave) / (1 + wave / WAVE_SOFTCAP);
}

export function startWave(s: GameState) {
  s.wave += 1;
  s.event = null;
  s.eventCd = 20 + Math.random() * 10;
  s.bossSpawned = false;
  s.bossWarning = 0;
  resetWaveBountyTracking(s.bountyTracking);

  // Boss Rush: every wave is a solo boss — no escorts, no hordes
  if (s.gameMode === "boss-rush") {
    s.isHorde = false;
    s.hordeWarning = 0;
    s.hordeTimer = 0;
    s.bossWarning = BOSS_WARNING_TIME;
    s.sfxQueue.push("horde_warning");
    s.spawnQueue = 0;
    s.spawnCd = 0;
    s.status = "playing";
    return;
  }

  // Scavenge: normal zombie flow but quota/timer gated instead of kill-all.
  // Zombies patrol the open map (no RIG target). Crates spawn around the arena.
  if (s.gameMode === "scavenge") {
    s.isHorde = false;
    s.hordeWarning = 0;
    s.hordeTimer = 0;
    const count = 6 + Math.floor(s.wave * 2.2);
    s.spawnQueue = count;
    s.spawnCd = 1.8;
    s.scavengeQuota = 80 + (s.wave - 1) * 40;
    s.scavengeCollected = 0;
    s.scavengeTimeLeft = 90;

    // Spawn scrap crates — high-value pickups scattered around the map.
    // Crate count and value scale with wave so they're worth hunting.
    const crateCount = 3 + Math.min(4, Math.floor(s.wave / 2));
    const crateValue = 18 + s.wave * 4;
    s.scavengeCrates = [];
    for (let i = 0; i < crateCount; i++) {
      const pos = randomMapPos(s.arena, s.gameMode);
      s.scavengeCrates.push({ id: s.nextId++, pos, value: crateValue, claimed: false });
    }

    s.status = "playing";
    return;
  }

  // Story: each mission drives its own wave setup
  if (s.gameMode === "story" && s.storyMissionId != null) {
    s.isHorde = false;
    s.hordeWarning = 0;
    s.hordeTimer = 0;
    s.bossWarning = 0;
    const mission = getMission(s.storyMissionId);
    const mul = mission?.enemyMul ?? 1;
    const obj = s.storyObjective;
    if (!obj) { s.status = "playing"; return; }

    switch (obj.type) {
      case "escape": {
        // Dense spawn — zombies block every route to the extraction point
        const count = Math.round((8 + s.wave * 2.5) * mul);
        s.spawnQueue = count;
        s.spawnCd = 1.1;
        break;
      }
      case "scavenge": {
        const count = Math.round((5 + s.wave * 2.0) * mul);
        s.spawnQueue = count;
        s.spawnCd = 1.8;
        s.scavengeCollected = 0;
        break;
      }
      case "eliminate": {
        if (!obj.bossSpawned) {
          s.bossWarning = BOSS_WARNING_TIME;
          s.sfxQueue.push("horde_warning");
          const escort = Math.round((3 + s.wave * 1.0) * mul);
          s.spawnQueue = escort;
          s.spawnCd = 3.0;
        }
        break;
      }
      case "hold": {
        const count = Math.round((8 + s.wave * 2.5) * mul);
        s.spawnQueue = count;
        s.spawnCd = 1.6;
        break;
      }
      case "escort": {
        const count = Math.round((6 + s.wave * 2.0) * mul);
        s.spawnQueue = count;
        s.spawnCd = 1.8;
        break;
      }
      case "sabotage": {
        s.spawnQueue = 0;
        s.spawnCd = 0;
        break;
      }
      case "defend": {
        if (s.wave >= obj.targetWave) {
          s.bossWarning = BOSS_WARNING_TIME;
          s.sfxQueue.push("horde_warning");
          // Spawn enhanced BEHEMOTH finale boss
          spawnFinaleBoss(s);
          const escort2 = Math.round((4 + s.wave * 1.2) * mul);
          s.spawnQueue = escort2;
          s.spawnCd = 2.5;
        } else {
          const count2 = Math.round((6 + s.wave * 2.2) * mul);
          s.spawnQueue = count2;
          s.spawnCd = 1.8;
        }
        break;
      }
    }
    s.status = "playing";
    return;
  }

  // Rig Defense (default): existing logic unchanged
  if (isBossWave(s.wave)) {
    s.isHorde = false;
    s.hordeWarning = 0;
    s.hordeTimer = 0;
    s.bossWarning = BOSS_WARNING_TIME;
    s.sfxQueue.push("horde_warning");
    // A modest escort of regular zombies still trickles in during the boss fight.
    const count = 3 + Math.floor(s.wave * 0.8);
    s.spawnQueue = count;
    s.spawnCd = 3.5;
  } else if (isHordeWave(s.wave)) {
    s.isHorde = true;
    s.sfxQueue.push("horde_warning");
    s.hordeWarning = HORDE_WARNING_TIME;
    s.hordeTimer = HORDE_DURATION;
    s.spawnQueue = 0;
    s.spawnCd = 0;
  } else {
    s.isHorde = false;
    s.hordeWarning = 0;
    s.hordeTimer = 0;
    const count = 6 + Math.floor(s.wave * 2.2);
    s.spawnQueue = count;
    s.spawnCd = 1.8;
  }
  s.status = "playing";
}

// Zombie sprite variants per class (matched to Arena.tsx requires):
// Walker = 0,1,2  (3 variants: b1, b2, b3)
// Runner = 0,1    (2 variants: b4, b5)
// Brute  = 0      (1 variant:  gasmask — kept single, most imposing)
// Tank   = 0      (rendered as heavy armored circle in Arena)
// Spawns just outside the visible camera viewport (not the far world edges) so
// zombies always walk on-screen at a consistent pace regardless of world size.
function edgeSpawnPos(s: GameState): { x: number; y: number } {
  // Spawns are relative to the camera (just off-screen from the player).
  // Use a fixed 80px off-screen margin so zombies are never visible when they appear.
  const margin = 80;
  const halfW = s.viewport.width / 2 + margin;
  const halfH = s.viewport.height / 2 + margin;
  const side = Math.floor(Math.random() * 4);
  let x: number, y: number;
  if (side === 0) { x = s.camera.x + (Math.random() * 2 - 1) * halfW; y = s.camera.y - halfH; }
  else if (side === 1) { x = s.camera.x + halfW; y = s.camera.y + (Math.random() * 2 - 1) * halfH; }
  else if (side === 2) { x = s.camera.x + (Math.random() * 2 - 1) * halfW; y = s.camera.y + halfH; }
  else { x = s.camera.x - halfW; y = s.camera.y + (Math.random() * 2 - 1) * halfH; }
  // Clamp to visible map bounds so zombies never spawn in the dark void
  const mb = mapBounds(s.arena);
  return {
    x: clamp(x, mb.left + 40, mb.right - 40),
    y: clamp(y, mb.top + 40, mb.bottom - 40),
  };
}

function spawnTank(s: GameState) {
  const { x, y } = edgeSpawnPos(s);
  const hp = 350 * waveCurve(s.wave, 0.05);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 28,
    hp, maxHp: hp, speed: waveAdd(18, s.wave, 0.4), damage: waveAdd(18, s.wave, 0.3),
    reward: Math.max(1, Math.round(25 * waveCurve(s.wave, 0.05))),
    hitFlash: 0, stunTime: 0, slowTime: 0, burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0, variant: 0, kind: "tank",
    attackCd: 0, telegraphed: false,
  });
}

// Spitter: keeps distance, lobs acid projectiles at the player/rig.
function spawnSpitter(s: GameState) {
  const { x, y } = edgeSpawnPos(s);
  const hp = 22 * waveCurve(s.wave, 0.045);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 15,
    hp, maxHp: hp, speed: waveAdd(34, s.wave, 1.2), damage: waveAdd(6, s.wave, 0.15),
    reward: Math.max(1, Math.round(5 * waveCurve(s.wave, 0.05))),
    hitFlash: 0, stunTime: 0, slowTime: 0, burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0, variant: 0, kind: "spitter",
    attackCd: 1 + Math.random(), telegraphed: false,
  });
}

// Screamer: fragile, but buffs nearby zombies and should be prioritized.
function spawnScreamer(s: GameState) {
  const { x, y } = edgeSpawnPos(s);
  const hp = 12 * waveCurve(s.wave, 0.045);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 13,
    hp, maxHp: hp, speed: waveAdd(44, s.wave, 1.4), damage: waveAdd(3, s.wave, 0.08),
    reward: Math.max(1, Math.round(6 * waveCurve(s.wave, 0.05))),
    hitFlash: 0, stunTime: 0, slowTime: 0, burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0, variant: 0, kind: "screamer",
    attackCd: 0, telegraphed: false,
  });
}

// Bomber: rushes the target and self-destructs in a damaging blast.
function spawnBomber(s: GameState) {
  const { x, y } = edgeSpawnPos(s);
  const hp = 20 * waveCurve(s.wave, 0.048);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 16,
    hp, maxHp: hp, speed: waveAdd(58, s.wave, 1.6), damage: waveAdd(30, s.wave, 0.4),
    reward: Math.max(1, Math.round(8 * waveCurve(s.wave, 0.05))),
    hitFlash: 0, stunTime: 0, slowTime: 0, burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0, variant: 0, kind: "bomber",
    attackCd: 0, telegraphed: false,
  });
}

// Crawler: cheap, fast, low-HP swarm unit — spawns in small packs.
function spawnCrawler(s: GameState) {
  const { x, y } = edgeSpawnPos(s);
  const hp = 6 * waveCurve(s.wave, 0.042);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 10,
    hp, maxHp: hp, speed: waveAdd(78, s.wave, 2.2), damage: waveAdd(3, s.wave, 0.06),
    reward: Math.max(1, Math.round(2 * waveCurve(s.wave, 0.05))),
    hitFlash: 0, stunTime: 0, slowTime: 0, burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0, variant: 0, kind: "crawler",
    attackCd: 0, telegraphed: false,
  });
}

function spawnCrawlerSwarm(s: GameState) {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) spawnCrawler(s);
}

// Boss: heavy chaser with a telegraphed slam attack and a guaranteed drop on death.
// HP growth is deliberately tamer than a linear ramp (tough-but-fair), while the
// reward grows faster than regular zombies so boss waves stay worth the risk.
export function spawnBoss(s: GameState) {
  const { x, y } = edgeSpawnPos(s);
  const hp = 900 * waveCurve(s.wave, 0.05);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 40,
    hp, maxHp: hp, speed: waveAdd(24, s.wave, 0.3), damage: waveAdd(26, s.wave, 0.35),
    reward: Math.max(1, Math.round(120 * waveCurve(s.wave, 0.08))),
    hitFlash: 0, stunTime: 0, slowTime: 0, burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0, variant: 0, kind: "boss",
    attackCd: 2.5, telegraphed: false,
  });
}

// Enhanced story-finale boss (BEHEMOTH) — 3× HP, larger radius, higher damage
function spawnFinaleBoss(s: GameState) {
  const { x, y } = edgeSpawnPos(s);
  const hp = 2700 * waveCurve(s.wave, 0.04);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 60,
    hp, maxHp: hp, speed: waveAdd(18, s.wave, 0.2), damage: waveAdd(40, s.wave, 0.5),
    reward: Math.max(1, Math.round(300 * waveCurve(s.wave, 0.08))),
    hitFlash: 0, stunTime: 0, slowTime: 0, burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0, variant: 0, kind: "boss",
    attackCd: 2.0, telegraphed: false,
  });
  s.bossSpawned = true;
}

function spawnZombie(s: GameState) {
  const { x, y } = edgeSpawnPos(s);

  const tier = Math.random();
  let hp = 15 * waveCurve(s.wave, 0.04);
  let speed = waveAdd(40, s.wave, 1.6);
  let damage = waveAdd(4, s.wave, 0.1);
  let reward = Math.max(1, Math.round(2 * waveCurve(s.wave, 0.05)));
  let radius = 14;
  let variantCount = 3;
  let kind: "walker" | "runner" | "brute" = "walker";

  // Random tank chance after wave 10 (3% per spawn outside hordes)
  if (s.wave >= 10 && !s.isHorde && Math.random() < 0.03) {
    spawnTank(s);
    return;
  }
  // Bomber: appears from wave 6 onward (4% chance per spawn)
  if (s.wave >= 6 && Math.random() < 0.04) {
    spawnBomber(s);
    return;
  }
  // Crawler swarm: appears from wave 5 onward (5% chance per spawn)
  if (s.wave >= 5 && Math.random() < 0.05) {
    spawnCrawlerSwarm(s);
    return;
  }

  // Waves 1-2 are a walker-only onboarding ramp — no runners/brutes/specials yet,
  // so a fresh player with the starting pistol always has a fair first fight.
  if (s.wave >= 3 && tier > 0.94) {
    hp = 46 * waveCurve(s.wave, 0.045); speed = waveAdd(27, s.wave, 1.0);
    damage = waveAdd(9, s.wave, 0.25); reward = Math.max(1, Math.round(7 * waveCurve(s.wave, 0.05)));
    radius = 20; variantCount = 1; kind = "brute";
  } else if (s.wave >= 4 && tier > 0.86) {
    spawnScreamer(s);
    return;
  } else if (s.wave >= 3 && tier > 0.76) {
    spawnSpitter(s);
    return;
  } else if (s.wave >= 2 && tier > 0.55) {
    hp = 9 * waveCurve(s.wave, 0.04); speed = waveAdd(62, s.wave, 2.0);
    damage = waveAdd(3, s.wave, 0.08); reward = Math.max(1, Math.round(3 * waveCurve(s.wave, 0.05)));
    radius = 11; variantCount = 2; kind = "runner";
  }

  const variant = Math.floor(Math.random() * variantCount);
  s.zombies.push({
    id: s.nextId++, pos: { x, y }, vel: { x: 0, y: 0 }, radius,
    hp, maxHp: hp, speed, damage, reward, hitFlash: 0, stunTime: 0, slowTime: 0,
    burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0,
    variant, kind, attackCd: 0, telegraphed: false,
  });
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function spawnParticles(s: GameState, pos: Vec2, color: string, count: number, speed: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.3 + Math.random() * 0.7) * speed;
    s.particles.push({
      id: s.nextId++,
      pos: { x: pos.x, y: pos.y },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      ttl: 0.4 + Math.random() * 0.3,
      maxTtl: 0.7,
      color,
      size: 2 + Math.random() * 2,
    });
  }
}

function explode(
  s: GameState,
  pos: Vec2,
  radius: number,
  damage: number,
  color = "#F39C12",
  opts?: { hurtsObjectives?: boolean; armorReduction?: number },
) {
  s.sfxQueue.push("explosion");
  s.explosions.push({
    id: s.nextId++, pos: { x: pos.x, y: pos.y },
    radius, ttl: 0.35, maxTtl: 0.35, color,
  });
  spawnParticles(s, pos, color, 18, 220);
  for (const z of s.zombies) {
    if (z.hp <= 0) continue;
    const d = dist(z.pos, pos);
    if (d < radius) {
      const falloff = 1 - d / radius;
      z.hp -= damage * (0.4 + 0.6 * falloff);
      z.hitFlash = 0.15;
      if (z.hp <= 0) z.killedByExplosion = true;
    }
  }
  for (const t of s.turrets) {
    const d = dist(t.pos, pos);
    if (d < radius) t.hp -= damage * 0.4;
  }
  if (opts?.hurtsObjectives) {
    const armorReduction = opts.armorReduction ?? 0;
    const pd = dist(s.player.pos, pos);
    if (pd < radius + 14 && s.player.invuln <= 0) {
      const falloff = 1 - pd / (radius + 14);
      s.player.hp -= damage * (0.4 + 0.6 * falloff) * (1 - Math.min(0.85, armorReduction));
      s.player.damageFlash = 0.18;
    }
    const rd = dist(s.rig.pos, pos);
    if (isRigActive(s) && rd < radius + s.rig.radius) {
      const falloff = 1 - rd / (radius + s.rig.radius);
      s.rig.hp -= damage * (0.4 + 0.6 * falloff);
    }
  }
  s.flash.screen = Math.max(s.flash.screen, 0.18);
}

function findAimTarget(s: GameState): Zombie | null {
  const CONE = Math.PI / 5;
  const RANGE = 320;
  let best: Zombie | null = null;
  let bestScore = Infinity;
  for (const z of s.zombies) {
    if (z.hp <= 0) continue;
    const dx = z.pos.x - s.player.pos.x, dy = z.pos.y - s.player.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > RANGE) continue;
    const ang = Math.atan2(dy, dx);
    const diff = Math.abs(angleDiff(ang, s.player.facing));
    if (diff > CONE) continue;
    const score = d + diff * 140;
    if (score < bestScore) { bestScore = score; best = z; }
  }
  return best;
}

function applyProximityFacing(s: GameState, dt: number) {
  const NEAR = 220;
  let nearest: Zombie | null = null;
  let nd = Infinity;
  for (const z of s.zombies) {
    if (z.hp <= 0) continue;
    const d = dist(z.pos, s.player.pos);
    if (d < nd) { nd = d; nearest = z; }
  }
  if (!nearest || nd > NEAR) return;
  const target = Math.atan2(nearest.pos.y - s.player.pos.y, nearest.pos.x - s.player.pos.x);
  const diff = angleDiff(target, s.player.facing);
  const max = 6 * dt;
  s.player.facing += clamp(diff, -max, max);
}

function fireOne(s: GameState) {
  if (s.player.ammo < 1) return;
  // Overdrive grants unlimited ammo — don't consume rounds while active
  if (s.player.overdrive <= 0) s.player.ammo -= 1;
  const w = getEquipped(s);
  const attackMul = upgradeValue("attack", s.upgrades.attack);
  const overMul = s.player.overdrive > 0 ? 1.4 : 1;
  const ub2 = uniformBonuses(s.equippedUniform);
  const laserMul = w.id === "laser" ? ub2.laserDamageMul : 1;
  const hordeMul = s.isHorde ? ub2.hordeDamageMul : 1;
  const crateMul = s.player.crateBoost > 0 ? 1.5 : 1;
  const dmg = w.damage * attackMul * overMul * laserMul * hordeMul * crateMul;
  const aoeDmg = w.aoeDamage * attackMul * overMul * hordeMul * crateMul;

  const target = findAimTarget(s);
  let baseAngle = s.player.facing;
  const steering = Math.hypot(s.input.x, s.input.y) > 0.05;
  if (target && !steering) {
    baseAngle = Math.atan2(target.pos.y - s.player.pos.y, target.pos.x - s.player.pos.x);
  }

  // Muzzle origin: bullets leave from the visible barrel TIP. The sprite's gun
  // points along the firing direction, so the muzzle sits ahead of the player
  // center along that same angle. Tuned to the hero sprite's barrel length.
  // Hero sprite gun points RIGHT (+x). We now rotate by `facing` directly
  // (Arena rotation fix), so barrel tip is ~22px ahead along facing.
  // MUZZLE_SIDE=-4 nudges slightly below centerline to match the barrel position.
  const BARREL_OFFSET = 22;
  const MUZZLE_SIDE = -4;
  const muzzleX = s.player.pos.x + Math.cos(baseAngle) * BARREL_OFFSET + Math.cos(baseAngle + Math.PI / 2) * MUZZLE_SIDE;
  const muzzleY = s.player.pos.y + Math.sin(baseAngle) * BARREL_OFFSET + Math.sin(baseAngle + Math.PI / 2) * MUZZLE_SIDE;
  // muzzle flash so the firing origin reads clearly
  spawnParticles(s, { x: muzzleX, y: muzzleY }, "#FFEFA8", 3, 90);

  const modSlots = s.weaponMods[s.equippedWeapon] ?? [];
  const mBundle = computeModBundle(modSlots);

  const spread = (w.spreadDeg * Math.PI) / 180;
  for (let i = 0; i < w.pellets; i++) {
    const offset = w.pellets === 1 ? 0 : (i / (w.pellets - 1) - 0.5) * spread;
    const jitter = (Math.random() - 0.5) * spread * (w.pellets === 1 ? 1 : 0.3);
    const ang = baseAngle + offset + jitter;
    const spd = w.projectileSpeed * mBundle.projectileSpeedMul;
    s.bullets.push({
      id: s.nextId++,
      pos: { x: muzzleX, y: muzzleY },
      vel: { x: Math.cos(ang) * spd, y: Math.sin(ang) * spd },
      radius: w.bulletSize,
      ttl: w.aoeRadius > 0 ? 1.6 : 1.2,
      damage: dmg,
      weapon: w.id,
      pierceLeft: w.pierce + mBundle.piercePlus,
      aoeRadius: w.aoeRadius,
      aoeDamage: aoeDmg,
      fromTurret: false,
      hitIds: {},
      ...(mBundle.ammoEffect ? { ammoEffect: mBundle.ammoEffect, color: mBundle.bulletColor ?? undefined } : {}),
    });
  }
  s.sfxQueue.push("shoot_" + w.id);
}

function fireLaserCharged(s: GameState, charge: number) {
  if (s.player.ammo < 1) return;
  if (s.player.overdrive <= 0) s.player.ammo -= 1;
  const w = getEquipped(s);
  const attackMul = upgradeValue("attack", s.upgrades.attack);
  const chargeMul = 1 + charge * 2; // 1× at 0 charge, 3× at full
  const crateMul = s.player.crateBoost > 0 ? 1.5 : 1;
  const dmg = w.damage * attackMul * chargeMul * crateMul;

  let baseAngle = s.player.facing;
  const steering = Math.hypot(s.input.x, s.input.y) > 0.05;
  if (!steering) {
    let best: Zombie | null = null;
    let bd = Infinity;
    for (const z of s.zombies) {
      if (z.hp <= 0) continue;
      const d = dist(z.pos, s.player.pos);
      if (d < bd) { bd = d; best = z; }
    }
    if (best) baseAngle = Math.atan2(best.pos.y - s.player.pos.y, best.pos.x - s.player.pos.x);
  }

  const laserModSlots = s.weaponMods[s.equippedWeapon] ?? [];
  const laserBundle = computeModBundle(laserModSlots);
  const laserSpd = w.projectileSpeed * laserBundle.projectileSpeedMul;

  s.bullets.push({
    id: s.nextId++,
    pos: { x: s.player.pos.x, y: s.player.pos.y },
    vel: { x: Math.cos(baseAngle) * laserSpd, y: Math.sin(baseAngle) * laserSpd },
    radius: w.bulletSize + charge * 4,
    ttl: 1.2,
    damage: dmg,
    weapon: "laser",
    pierceLeft: w.pierce + Math.floor(charge * 4) + laserBundle.piercePlus,
    aoeRadius: 0,
    aoeDamage: 0,
    fromTurret: false,
    hitIds: {},
    ...(laserBundle.ammoEffect ? { ammoEffect: laserBundle.ammoEffect, color: laserBundle.bulletColor ?? undefined } : {}),
  });
  spawnParticles(s, s.player.pos, laserBundle.bulletColor ?? "#FF2A95", Math.ceil(charge * 6), 120);
  s.sfxQueue.push("shoot_laser");
  s.player.fireCd = 0.45;
}

function turretFire(s: GameState, t: Turret) {
  let best: Zombie | null = null;
  let bd = Infinity;
  for (const z of s.zombies) {
    if (z.hp <= 0) continue;
    const d = dist(z.pos, t.pos);
    if (d < t.range && d < bd) { bd = d; best = z; }
  }
  if (!best) return;
  const ang = Math.atan2(best.pos.y - t.pos.y, best.pos.x - t.pos.x);
  t.facing = ang;
  s.bullets.push({
    id: s.nextId++,
    pos: { x: t.pos.x, y: t.pos.y },
    vel: { x: Math.cos(ang) * 560, y: Math.sin(ang) * 560 },
    radius: 4,
    ttl: 1.0,
    damage: t.damage,
    weapon: "pistol",
    pierceLeft: 0,
    aoeRadius: 0,
    aoeDamage: 0,
    fromTurret: true,
    hitIds: {},
  });
}

export function deployThrowable(s: GameState, type: ThrowableType) {
  if (s.status !== "playing") return false;
  if (s.throwables[type] <= 0) return false;
  const def = THROWABLES[type];
  const attackMul = upgradeValue("attack", s.upgrades.attack);
  s.throwables[type] -= 1;
  if (type === "mine") {
    s.mines.push({
      id: s.nextId++,
      pos: { x: s.player.pos.x, y: s.player.pos.y },
      armTime: def.fuseTime,
      damage: def.damage * attackMul,
      radius: def.radius,
    });
  } else {
    const a = s.player.facing;
    const sp = 360;
    s.grenades.push({
      id: s.nextId++,
      type,
      pos: { x: s.player.pos.x, y: s.player.pos.y },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      fuse: def.fuseTime,
      stuckTo: null,
      stuckOffset: null,
      damage: def.damage * attackMul,
      radius: def.radius,
    });
  }
  return true;
}

export function deployTurret(s: GameState): boolean {
  if (s.status !== "playing") return false;
  if (!s.turretOwned) return false;
  const ubDeploy = uniformBonuses(s.equippedUniform);
  if (s.turrets.length >= ubDeploy.maxTurrets) return false;
  if (s.turretRedeployCd > 0) return false;
  const up = s.turretUpgrades;
  const hp = turretHpForLevel(up.defense);
  const a = s.player.facing;
  const off = 40;
  s.turrets.push({
    id: s.nextId++,
    pos: { x: s.player.pos.x + Math.cos(a) * off, y: s.player.pos.y + Math.sin(a) * off },
    hp, maxHp: hp,
    fireCd: 0,
    facing: a,
    damage: turretDamageForLevel(up.damage),
    fireRate: turretFireRateForLevel(up.fireRate),
    range: 300,
    magnetizerRange: turretMagnetizerRange(up.magnetizer),
  });
  return true;
}

export function buyTurret(s: GameState): boolean {
  if (s.turretOwned) return false;
  const ub = uniformBonuses(s.equippedUniform);
  const waveReq = ub.turretUnlocked ? 0 : TURRET_PURCHASE_WAVE;
  if (s.stats.wavesCleared < waveReq) return false;
  const cost = turretPurchaseCost(s);
  if (s.scrap < cost) return false;
  s.scrap -= cost;
  s.turretOwned = true;
  return true;
}

export function upgradeTurretStat(s: GameState, stat: TurretStatKey): boolean {
  const lv = s.turretUpgrades[stat];
  if (lv >= TURRET_MAX_LEVEL) return false;
  const cost = TURRET_UPGRADE_COSTS[stat][lv - 1];
  if (s.scrap < cost) return false;
  s.scrap -= cost;
  s.turretUpgrades[stat] += 1;
  return true;
}

export function equipWeapon(s: GameState, id: WeaponId) {
  if (!s.ownedWeapons.includes(id)) return false;
  s.equippedWeapon = id;
  const w = WEAPONS[id];
  const mag = maxAmmoFor(s, w);
  s.player.maxAmmo = mag;
  s.player.ammo = mag;
  s.player.reloading = false;
  s.player.ammoAcc = 0;
  s.player.fireCd = 0;
  return true;
}

export function weaponCost(s: GameState, id: WeaponId): number {
  const ub = uniformBonuses(s.equippedUniform);
  return Math.max(1, Math.round(WEAPONS[id].cost * ub.upgradeCostMul));
}

export function throwableCost(s: GameState, type: ThrowableType, qty = 1): number {
  const ub = uniformBonuses(s.equippedUniform);
  return Math.max(1, Math.round(THROWABLES[type].cost * qty * ub.grenadeCostMul));
}

export function turretPurchaseCost(s: GameState): number {
  const ub = uniformBonuses(s.equippedUniform);
  return Math.max(1, Math.round(TURRET_PURCHASE_COST * ub.turretCostMul));
}

export function effectiveUpgradeCost(s: GameState, key: keyof Upgrades): number {
  const ub = uniformBonuses(s.equippedUniform);
  return Math.max(1, Math.round(upgradeCost(key, s.upgrades[key]) * ub.upgradeCostMul));
}

export function buyWeapon(s: GameState, id: WeaponId): boolean {
  const w = WEAPONS[id];
  if (s.ownedWeapons.includes(id)) return false;
  const ub = uniformBonuses(s.equippedUniform);
  // Zombie uniform: only pistol allowed
  if (ub.zombieMode && id !== "pistol") return false;
  // Wave gate — uniform auto-unlocks override it
  const autoUnlocked = (ub.arUnlocked && id === "ar") || (ub.gatlingUnlocked && id === "gatling");
  if (!autoUnlocked && s.stats.wavesCleared < w.unlockWave) return false;
  const cost = weaponCost(s, id);
  if (s.scrap < cost) return false;
  s.scrap -= cost;
  s.ownedWeapons.push(id);
  return true;
}

export function buyThrowable(s: GameState, type: ThrowableType, qty = 1): boolean {
  const def = THROWABLES[type];
  const ub = uniformBonuses(s.equippedUniform);
  // Apocalypse: grenades/mines always unlocked
  const unlocked = ub.grenadesUnlocked || s.stats.wavesCleared >= def.unlockWave;
  if (!unlocked) return false;
  const total = throwableCost(s, type, qty);
  if (s.scrap < total) return false;
  s.scrap -= total;
  s.throwables[type] += qty;
  return true;
}


export function abilityStats(id: AbilityId, level: number) {
  const def = ABILITIES[id];
  const lv = Math.max(1, level);
  const step = lv - 1;
  let value = def.baseValue;
  let radius = def.baseRadius;
  let cooldown = def.baseCooldown;
  switch (id) {
    case "dash":
      value = def.baseValue + step * 30;
      cooldown = Math.max(1.6, def.baseCooldown - step * 0.35);
      break;
    case "grenade":
      value = def.baseValue * (1 + step * 0.28);
      radius = def.baseRadius + step * 14;
      cooldown = Math.max(3, def.baseCooldown - step * 0.45);
      break;
    case "flashbang":
      value = def.baseValue + step * 0.5;
      radius = def.baseRadius + step * 16;
      cooldown = Math.max(4.5, def.baseCooldown - step * 0.7);
      break;
    case "emp":
      value = def.baseValue + step * 0.8;
      radius = def.baseRadius + step * 18;
      cooldown = Math.max(6, def.baseCooldown - step * 0.8);
      break;
    case "overdrive":
      value = def.baseValue + step * 1.2;
      cooldown = Math.max(9, def.baseCooldown - step * 1.2);
      break;
  }
  return { value, radius, cooldown };
}

export function abilityUpgradeCost(id: AbilityId, level: number): number {
  const def = ABILITIES[id];
  return Math.round(def.upgradeBaseCost * Math.pow(1.5, level - 1));
}

export function unlockAbility(s: GameState, id: AbilityId): boolean {
  const def = ABILITIES[id];
  if (s.abilities[id].level > 0) return false;
  if (s.stats.wavesCleared < def.unlockWave) return false;
  if (s.scrap < def.unlockCost) return false;
  s.scrap -= def.unlockCost;
  s.abilities[id].level = 1;
  s.abilities[id].cooldown = 0;
  if (s.equippedAbility == null) s.equippedAbility = id;
  return true;
}

export function upgradeAbility(s: GameState, id: AbilityId): boolean {
  const def = ABILITIES[id];
  const cur = s.abilities[id].level;
  if (cur <= 0) return false;
  if (cur >= def.maxLevel) return false;
  const cost = abilityUpgradeCost(id, cur);
  if (s.scrap < cost) return false;
  s.scrap -= cost;
  s.abilities[id].level += 1;
  return true;
}

export function equipAbility(s: GameState, id: AbilityId): boolean {
  if (s.abilities[id].level <= 0) return false;
  s.equippedAbility = id;
  return true;
}

export function useAbility(s: GameState): boolean {
  if (s.status !== "playing") return false;
  const id = s.equippedAbility;
  if (!id) return false;
  const ab = s.abilities[id];
  if (ab.level <= 0) return false;
  if (ab.cooldown > 0) return false;
  const st = abilityStats(id, ab.level);
  const attackMul = upgradeValue("attack", s.upgrades.attack);

  switch (id) {
    case "dash": {
      const a = s.player.facing;
      const dur = 0.18;
      const speed = st.value / dur;
      s.player.dashVel = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      s.player.dashTime = dur;
      s.player.invuln = Math.max(s.player.invuln, dur + 0.12);
      spawnParticles(s, s.player.pos, "#00FFFF", 10, 160);
      break;
    }
    case "grenade": {
      explode(s, { ...s.player.pos }, st.radius, st.value * attackMul, "#F39C12");
      break;
    }
    case "flashbang": {
      s.explosions.push({
        id: s.nextId++, pos: { ...s.player.pos },
        radius: st.radius, ttl: 0.4, maxTtl: 0.4, color: "#FFEFA8",
      });
      spawnParticles(s, s.player.pos, "#FFFFFF", 24, 260);
      for (const z of s.zombies) {
        if (z.hp <= 0) continue;
        if (dist(z.pos, s.player.pos) < st.radius) {
          z.stunTime = Math.max(z.stunTime, st.value);
        }
      }
      s.flash.screen = Math.max(s.flash.screen, 0.4);
      break;
    }
    case "emp": {
      // Audit fix: EMP color changed from #9B59FF (purple) to #4FC3F7 (electric blue)
      // — purple is banned by design_guidelines.json global_rules.
      s.explosions.push({
        id: s.nextId++, pos: { ...s.player.pos },
        radius: st.radius, ttl: 0.45, maxTtl: 0.45, color: "#4FC3F7",
      });
      spawnParticles(s, s.player.pos, "#4FC3F7", 20, 230);
      for (const z of s.zombies) {
        if (z.hp <= 0) continue;
        if (dist(z.pos, s.player.pos) < st.radius) {
          z.slowTime = Math.max(z.slowTime, st.value);
        }
      }
      break;
    }
    case "overdrive": {
      s.player.overdrive = Math.max(s.player.overdrive, st.value);
      spawnParticles(s, s.player.pos, "#FF2A95", 16, 200);
      break;
    }
  }
  ab.cooldown = st.cooldown;
  return true;
}

// ─── New zombie kinds: shared tuning + helpers ───────────────────────────────

const SCREAMER_AURA_RADIUS = 150;
const SCREAMER_SPEED_MUL = 1.35;
const SCREAMER_DAMAGE_MUL = 1.25;
const BOMBER_TRIGGER_RANGE = 70;
const BOMBER_FUSE = 0.6;
const BOMBER_BLAST_RADIUS = 90;
const SPITTER_RANGE = 230;
const SPITTER_FIRE_INTERVAL = 2.2;
const SPITTER_PROJECTILE_SPEED = 190;
const BOSS_SLAM_RANGE = 90;
const BOSS_SLAM_WINDUP = 0.8;
const BOSS_SLAM_RADIUS = 130;
const BOSS_SLAM_COOLDOWN = 3.5;

// Screamers buff nearby zombies' speed and damage — makes them a priority kill.
function screamerBuffMultiplier(s: GameState, z: Zombie): { speedMul: number; damageMul: number } {
  for (const other of s.zombies) {
    if (other.id === z.id || other.hp <= 0) continue;
    if (other.kind !== "screamer") continue;
    if (dist(other.pos, z.pos) < SCREAMER_AURA_RADIUS) {
      return { speedMul: SCREAMER_SPEED_MUL, damageMul: SCREAMER_DAMAGE_MUL };
    }
  }
  return { speedMul: 1, damageMul: 1 };
}

function detonateBomber(s: GameState, z: Zombie, ub: ReturnType<typeof uniformBonuses>, armorReduction: number) {
  if (!ub.zombieMode) {
    explode(s, z.pos, BOMBER_BLAST_RADIUS, z.damage, "#F39C12", { hurtsObjectives: true, armorReduction });
  } else {
    // still show the visual/audio punch, just no damage to anything
    spawnParticles(s, z.pos, "#F39C12", 14, 180);
  }
  z.hp = -1;
}

function spawnZombieProjectile(s: GameState, from: Vec2, target: Vec2, damage: number) {
  const a = Math.atan2(target.y - from.y, target.x - from.x);
  s.zombieProjectiles.push({
    id: s.nextId++,
    pos: { x: from.x, y: from.y },
    vel: { x: Math.cos(a) * SPITTER_PROJECTILE_SPEED, y: Math.sin(a) * SPITTER_PROJECTILE_SPEED },
    radius: 6,
    ttl: 2.2,
    damage,
    color: "#39FF14",
  });
  s.sfxQueue.push("zombie_groan_2");
}

function bossSlamAttack(s: GameState, z: Zombie, ub: ReturnType<typeof uniformBonuses>) {
  s.sfxQueue.push("explosion");
  s.explosions.push({
    id: s.nextId++, pos: { x: z.pos.x, y: z.pos.y },
    radius: BOSS_SLAM_RADIUS, ttl: 0.4, maxTtl: 0.4, color: "#FF2A2A",
  });
  spawnParticles(s, z.pos, "#FF2A2A", 22, 240);
  if (!ub.zombieMode) {
    if (dist(z.pos, s.player.pos) < BOSS_SLAM_RADIUS && s.player.invuln <= 0) {
      s.player.hp -= z.damage * 1.6;
      s.player.damageFlash = 0.3;
      s.flash.screen = 0.35;
      if (s.player.hurtSfxCd <= 0) { s.sfxQueue.push("player_hurt"); s.player.hurtSfxCd = 0.5; }
    }
    if (isRigActive(s) && dist(z.pos, s.rig.pos) < BOSS_SLAM_RADIUS + s.rig.radius) {
      s.rig.hp -= z.damage * 1.6;
      s.rig.damageFlash = 0.3;
      s.flash.rig = 0.35;
      if (s.rig.hitSfxCd <= 0) { s.sfxQueue.push("rig_hit"); s.rig.hitSfxCd = 0.6; }
    }
  }
  s.flash.screen = Math.max(s.flash.screen, 0.2);
}

// ─── Bounty progress tracking ────────────────────────────────────────────────

function getBountyProgress(s: GameState, templateId: string): number {
  const t = BOUNTY_POOL.find((x) => x.id === templateId);
  if (!t) return 0;
  switch (t.conditionType) {
    case "total_kills": return s.stats.kills;
    case "kind_kills": {
      const key = t.conditionKey as keyof typeof s.bountyTracking.kindKills;
      return s.bountyTracking.kindKills[key] ?? 0;
    }
    case "total_scrap": return s.stats.earnedScrap;
    case "scrap_this_wave": return s.bountyTracking.earnedScrapThisWave;
    case "horde_kills": return s.bountyTracking.hordeKillsThisRun;
    case "waves_cleared": return s.stats.wavesCleared;
    case "explosive_kills": return s.bountyTracking.explosiveKills;
    case "no_damage_wave": return 0;
    case "fast_wave_clear": return 0;
    default: return 0;
  }
}

function isBountyImpossible(s: GameState, templateId: string): boolean {
  const template = BOUNTY_POOL.find((t) => t.id === templateId);
  if (!template?.excludeModes) return false;
  return template.excludeModes.includes(s.gameMode);
}

export function tickBountyProgress(s: GameState): void {
  for (const b of s.activeBounties) {
    if (b.state !== "active") continue;
    const t = BOUNTY_POOL.find((x) => x.id === b.templateId);
    if (!t) continue;
    // Wave-event bounties are only checked at wave clear, not mid-tick
    if (t.conditionType === "no_damage_wave" || t.conditionType === "fast_wave_clear") continue;
    // Mark impossible bounties as failed immediately
    if (isBountyImpossible(s, b.templateId)) {
      b.state = "failed";
      continue;
    }
    const prog = getBountyProgress(s, b.templateId);
    b.progress = Math.min(b.target, prog);
    if (b.progress >= b.target && b.state === "active") {
      b.state = "completed";
      b.completedWave = s.wave;
      b.justCompleted = true;
      // Award immediately so reward is not lost if the player dies before wave clear
      if (!b.rewardAwarded) {
        b.rewardAwarded = true;
        s.scrap += b.reward;
        s.stats.totalScrap += b.reward;
      }
    }
  }
}

// ─── Mid-wave random events ───────────────────────────────────────────────────

const EVENT_MIN_CD = 22;
const EVENT_MAX_CD = 38;
const AIRDROP_HOLD_TIME = 3;
const AIRDROP_RADIUS = 50;
const AIRDROP_SCRAP = 60;
const HAZARD_RADIUS = 70;
const HAZARD_DURATION = 14;
const HAZARD_DPS = 14;
const CRATE_RADIUS = 26;
const CRATE_DURATION = 20;
const CRATE_BOOST_TIME = 12;

// Events spawn within a reachable radius of the player (relative to the camera
// view) rather than anywhere across the much larger world, so they stay a
// realistic side-trip instead of an unreachable trek.
function randomEventPos(s: GameState): Vec2 {
  const margin = 90;
  const radius = Math.max(s.viewport.width, s.viewport.height) * 0.7;
  const angle = Math.random() * Math.PI * 2;
  const r = margin + Math.random() * radius;
  return {
    x: clamp(s.player.pos.x + Math.cos(angle) * r, margin, s.arena.width - margin),
    y: clamp(s.player.pos.y + Math.sin(angle) * r, margin, s.arena.height - margin),
  };
}

function spawnRandomEvent(s: GameState) {
  const roll = Math.random();
  const type: GameEventType = roll < 0.4 ? "airdrop" : roll < 0.7 ? "hazard" : "crate";
  const pos = randomEventPos(s);
  if (type === "airdrop") {
    s.event = { type, pos, radius: AIRDROP_RADIUS, ttl: 30, progress: 0, claimed: false };
    s.sfxQueue.push("ui_wave_start");
  } else if (type === "hazard") {
    s.event = { type, pos, radius: HAZARD_RADIUS, ttl: HAZARD_DURATION, progress: 0, claimed: false };
    s.sfxQueue.push("emp_pulse");
  } else {
    s.event = { type, pos, radius: CRATE_RADIUS, ttl: CRATE_DURATION, progress: 0, claimed: false, variant: Math.floor(Math.random() * 3) };
    s.sfxQueue.push("ui_deploy");
  }
}

function tickEvent(s: GameState, dt: number) {
  const ev = s.event;
  if (!ev) return;
  ev.ttl -= dt;
  if (ev.type === "airdrop" && !ev.claimed) {
    if (dist(s.player.pos, ev.pos) < ev.radius) {
      ev.progress = Math.min(1, ev.progress + dt / AIRDROP_HOLD_TIME);
      if (ev.progress >= 1) {
        ev.claimed = true;
        s.scrap += AIRDROP_SCRAP;
        s.stats.totalScrap += AIRDROP_SCRAP;
        s.stats.earnedScrap += AIRDROP_SCRAP;
        s.bountyTracking.scrapThisWave += AIRDROP_SCRAP;
        s.bountyTracking.earnedScrapThisWave += AIRDROP_SCRAP;
        s.sfxQueue.push("scrap_pickup");
        spawnParticles(s, ev.pos, "#F39C12", 20, 200);
        s.event = null;
        return;
      }
    } else {
      ev.progress = Math.max(0, ev.progress - dt / AIRDROP_HOLD_TIME);
    }
  } else if (ev.type === "hazard") {
    const ub = uniformBonuses(s.equippedUniform);
    if (!ub.zombieMode && dist(s.player.pos, ev.pos) < ev.radius && s.player.invuln <= 0) {
      s.player.hp -= HAZARD_DPS * dt;
      s.player.damageFlash = 0.12;
    }
  } else if (ev.type === "crate" && !ev.claimed) {
    if (dist(s.player.pos, ev.pos) < ev.radius + 14) {
      ev.claimed = true;
      const variant = ev.variant ?? 0;
      // Chest rewards based on variant:
      // 0 = scrap bonus, 1 = random upgrade, 2 = turret redeploy
      if (variant === 0) {
        const scrapBonus = 40 + s.wave * 5;
        s.scrap += scrapBonus;
        s.stats.totalScrap += scrapBonus;
        s.stats.earnedScrap += scrapBonus;
        s.bountyTracking.scrapThisWave += scrapBonus;
        s.bountyTracking.earnedScrapThisWave += scrapBonus;
        spawnFloatingText(s, ev.pos, `+${scrapBonus}`, "#F39C12");
      } else if (variant === 1) {
        const keys = ["attack", "health", "armor", "rigPlating", "ammoCap", "ammoRegen", "moveSpeed"] as const;
        const key = keys[Math.floor(Math.random() * keys.length)];
        s.upgrades[key] += 1;
        spawnFloatingText(s, ev.pos, `${key.toUpperCase()} +1`, "#39FF14");
      } else {
        s.turretRedeployCd = 0;
        if (!s.turretOwned) { s.turretOwned = true; }
        spawnFloatingText(s, ev.pos, "TURRET READY", "#00FFFF");
      }
      s.sfxQueue.push("ui_upgrade");
      spawnParticles(s, ev.pos, "#4FC3F7", 16, 180);
      s.event = null;
      return;
    }
  }
  if (ev.ttl <= 0) {
    s.event = null;
  }
}

// ─── Story objective tick ─────────────────────────────────────────────────────

const SPAWNER_INTERACT_RANGE = 65;
const SPAWNER_DESTROY_TIME = 3.0;
const SPAWNER_EMIT_INTERVAL = 5.0;
const ESCORT_NPC_RADIUS = 20;
const HOLD_ZONE_PENALTY_PER_SEC = 3.5; // seconds drained per second outside zone

function tickStoryObjective(s: GameState, dt: number): void {
  const obj = s.storyObjective;
  if (!obj) return;

  switch (obj.type) {
    case "escape": {
      obj.timeLeft = Math.max(0, obj.timeLeft - dt);
      const d = dist(s.player.pos, obj.extractionPos);
      if (d < 55 && !obj.reached) {
        obj.reached = true;
        s.status = "missioncomplete";
        return;
      }
      if (obj.timeLeft <= 0 && !obj.reached) {
        s.status = "gameover";
      }
      break;
    }

    case "scavenge": {
      obj.timeLeft = Math.max(0, obj.timeLeft - dt);
      s.scavengeTimeLeft = obj.timeLeft;
      if (s.scavengeCollected >= obj.quota) {
        s.status = "missioncomplete";
        return;
      }
      if (obj.timeLeft <= 0) {
        s.status = "gameover";
      }
      break;
    }

    case "eliminate": {
      if (!obj.bossSpawned && s.bossSpawned) {
        obj.bossSpawned = true;
      }
      const boss = s.zombies.find((z) => z.kind === "boss" && z.hp > 0);
      if (obj.bossSpawned && !boss && !obj.killed) {
        obj.killed = true;
        s.status = "missioncomplete";
      }
      break;
    }

    case "hold": {
      const d = dist(s.player.pos, obj.zoneCenter);
      const inZone = d <= obj.zoneRadius;
      if (inZone) {
        obj.timeLeft = Math.max(0, obj.timeLeft - dt);
        if (obj.timeLeft <= 0) {
          s.status = "missioncomplete";
          return;
        }
      }
      // When out of zone the timer simply pauses — no refill penalty.
      // Strict enforcement: only time spent inside the zone counts.
      break;
    }

    case "escort": {
      // Count down per-wave pressure timer (reaching 0 = NPC abandons, game over)
      obj.timeLeft = Math.max(0, obj.timeLeft - dt);
      if (obj.timeLeft <= 0) {
        obj.npcHp = 0;
        s.status = "gameover";
        return;
      }
      // Zombies damage NPC on contact
      for (const z of s.zombies) {
        if (z.hp <= 0) continue;
        if (dist(z.pos, obj.npcPos) < z.radius + ESCORT_NPC_RADIUS) {
          obj.npcHp -= z.damage * dt * 1.5;
          if (obj.npcHp <= 0) {
            obj.npcHp = 0;
            s.status = "gameover";
            return;
          }
        }
      }
      break;
    }

    case "sabotage": {
      for (const sp of obj.spawners) {
        if (sp.destroyed) continue;
        // Emit zombies from active spawner
        sp.spawnTimer -= dt;
        if (sp.spawnTimer <= 0) {
          spawnZombieAt(s, sp.pos.x, sp.pos.y);
          sp.spawnTimer = SPAWNER_EMIT_INTERVAL;
        }
        // Player hold-interact to destroy
        const playerDist = dist(s.player.pos, sp.pos);
        if (playerDist < SPAWNER_INTERACT_RANGE) {
          sp.interactProgress = Math.min(1, sp.interactProgress + dt / SPAWNER_DESTROY_TIME);
          if (sp.interactProgress >= 1) {
            sp.destroyed = true;
            obj.destroyed += 1;
            spawnParticles(s, sp.pos, "#FF2A2A", 20, 240);
            s.sfxQueue.push("explosion");
          }
        } else {
          sp.interactProgress = Math.max(0, sp.interactProgress - dt / SPAWNER_DESTROY_TIME);
        }
      }
      if (obj.destroyed >= obj.spawners.length) {
        s.status = "missioncomplete";
      }
      break;
    }

    case "defend": {
      // Mission complete when final boss is killed after reaching target wave
      if (s.wave >= obj.targetWave) {
        const hasBoss = s.zombies.some((z) => z.kind === "boss" && z.hp > 0);
        const bossWasSpawned = s.bossSpawned;
        if (bossWasSpawned && !hasBoss && s.spawnQueue === 0 && s.zombies.length === 0) {
          s.status = "missioncomplete";
        }
      }
      break;
    }
  }
}

function spawnZombieAt(s: GameState, x: number, y: number) {
  const hp = 15 * waveCurve(s.wave, 0.04);
  s.zombies.push({
    id: s.nextId++,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius: 14,
    hp, maxHp: hp,
    speed: waveAdd(40, s.wave, 1.2),
    damage: waveAdd(4, s.wave, 0.1),
    reward: Math.max(1, Math.round(2 * waveCurve(s.wave, 0.05))),
    hitFlash: 0, stunTime: 0, slowTime: 0,
    burnTime: 0, burnDps: 0, poisonStacks: 0, poisonTime: 0,
    variant: Math.floor(Math.random() * 3),
    kind: "walker",
    attackCd: 0, telegraphed: false,
  });
}

export function tick(s: GameState, dt: number) {
  if (s.status !== "playing") return;
  s.sfxQueue = [];
  const playerHpBefore = s.player.hp;
  s.bountyTracking.waveTimer += dt;

  // Scavenge: count down the wave timer
  if (s.gameMode === "scavenge" && s.scavengeTimeLeft > 0) {
    s.scavengeTimeLeft = Math.max(0, s.scavengeTimeLeft - dt);
  }

  for (const id of Object.keys(s.abilities) as AbilityId[]) {
    if (s.abilities[id].cooldown > 0) {
      s.abilities[id].cooldown = Math.max(0, s.abilities[id].cooldown - dt);
    }
  }
  s.player.overdrive = Math.max(0, s.player.overdrive - dt);
  s.player.invuln = Math.max(0, s.player.invuln - dt);
  s.player.crateBoost = Math.max(0, s.player.crateBoost - dt);
  if (s.turretRedeployCd > 0) {
    s.turretRedeployCd = Math.max(0, s.turretRedeployCd - dt);
  }

  if (s.bossWarning > 0) {
    s.bossWarning = Math.max(0, s.bossWarning - dt);
    if (s.bossWarning <= 0 && !s.bossSpawned) {
      s.bossSpawned = true;
      spawnBoss(s);
    }
  }

  // Mid-wave random events — only outside hordes/boss warnings, so they never
  // compete for attention with the bigger set-piece moments.
  if (s.event) {
    tickEvent(s, dt);
  } else if (
    !s.isHorde &&
    s.bossWarning <= 0 &&
    s.wave >= 3 &&
    !s.zombies.some((z) => z.kind === "boss" && z.hp > 0)
  ) {
    s.eventCd -= dt;
    if (s.eventCd <= 0) {
      spawnRandomEvent(s);
      s.eventCd = EVENT_MIN_CD + Math.random() * (EVENT_MAX_CD - EVENT_MIN_CD);
    }
  }

  if (s.isHorde) {
    if (s.hordeWarning > 0) {
      s.hordeWarning = Math.max(0, s.hordeWarning - dt);
    } else if (s.hordeTimer > 0) {
      s.hordeTimer = Math.max(0, s.hordeTimer - dt);
      s.spawnCd -= dt;
      if (s.spawnCd <= 0) {
        // Burst: starts at 1 zombie per cadence, gains 1 every 5 horde waves.
        const burst = 1 + Math.floor(s.wave / (HORDE_INTERVAL * 2));
        for (let i = 0; i < burst; i++) spawnZombie(s);
        // Tanks spawn during hordes after wave 10 (~15% chance per burst)
        if (s.wave >= 10 && Math.random() < 0.15) spawnTank(s);
        const hordeBase = Math.max(0.55, 1.15 - s.wave * 0.01);
        s.spawnCd = hordeBase * (0.5 + Math.random() * 1.0);
      }
    }
  } else if (s.spawnQueue > 0) {
    s.spawnCd -= dt;
    if (s.spawnCd <= 0) {
      spawnZombie(s);
      s.spawnQueue -= 1;
      // Random ±40% jitter on the cadence so zombies don't arrive in lockstep
      const base = Math.max(0.60, 1.9 - s.wave * 0.04);
      s.spawnCd = base * (0.6 + Math.random() * 0.8);
    }
  }

  const ub = uniformBonuses(s.equippedUniform);
  const moveSpeed = upgradeValue("moveSpeed", s.upgrades.moveSpeed) * ub.moveSpeedMul;
  const mb = mapBounds(s.arena);
  const oldPX = s.player.pos.x;
  const oldPY = s.player.pos.y;
  if (s.player.dashTime > 0) {
    s.player.dashTime = Math.max(0, s.player.dashTime - dt);
    const dp = resolveWallCollision(
      oldPX, oldPY,
      oldPX + s.player.dashVel.x * dt,
      oldPY + s.player.dashVel.y * dt,
      PLAYER_RADIUS, s.arena, s.gameMode,
    );
    s.player.pos.x = dp.x;
    s.player.pos.y = dp.y;
    if (Math.hypot(s.player.dashVel.x, s.player.dashVel.y) > 1) {
      s.player.facing = Math.atan2(s.player.dashVel.y, s.player.dashVel.x);
    }
    spawnParticles(s, s.player.pos, "#00FFFF", 1, 40);
    s.player.idleTimer = 0;
  } else {
    const inLen = Math.hypot(s.input.x, s.input.y);
    if (inLen > 0.05) {
      const nx = s.input.x / Math.max(inLen, 1);
      const ny = s.input.y / Math.max(inLen, 1);
      const np = resolveWallCollision(
        oldPX, oldPY,
        oldPX + nx * moveSpeed * dt,
        oldPY + ny * moveSpeed * dt,
        PLAYER_RADIUS, s.arena, s.gameMode,
      );
      s.player.pos.x = np.x;
      s.player.pos.y = np.y;
      s.player.facing = Math.atan2(ny, nx);
      s.player.idleTimer = 0;
    } else {
      s.player.idleTimer += dt;
      if (s.player.idleTimer > 0.15) {
        applyProximityFacing(s, dt);
      }
    }
  }
  // Clamp to arena bounds so player can't walk off the map
  s.player.pos.x = clamp(s.player.pos.x, PLAYER_RADIUS, s.arena.width - PLAYER_RADIUS);
  s.player.pos.y = clamp(s.player.pos.y, PLAYER_RADIUS, s.arena.height - PLAYER_RADIUS);

  // Camera follows the player, clamped so it never shows past the world edge.
  s.camera.x = clampCameraAxis(s.player.pos.x, s.viewport.width, s.arena.width);
  s.camera.y = clampCameraAxis(s.player.pos.y, s.viewport.height, s.arena.height);

  // RIG is a solid obstacle — push the player out if they walk into it.
  // (Skip when the RIG is hidden — no invisible obstruction at the map center.)
  const rigDx = s.player.pos.x - s.rig.pos.x;
  const rigDy = s.player.pos.y - s.rig.pos.y;
  const rigDist = Math.sqrt(rigDx * rigDx + rigDy * rigDy);
  const rigMinDist = s.rig.radius + 14; // 14 = player collision radius
  if (isRigActive(s) && rigDist < rigMinDist && rigDist > 0) {
    const push = rigMinDist / rigDist;
    s.player.pos.x = s.rig.pos.x + rigDx * push;
    s.player.pos.y = s.rig.pos.y + rigDy * push;
  }

  // Auto-reload only when empty and not in overdrive (overdrive has unlimited ammo)
  if (s.player.ammo <= 0 && !s.player.reloading && s.player.overdrive <= 0) {
    s.player.reloading = true;
    s.player.ammoAcc = 0;
    s.sfxQueue.push("reload");
  }
  if (s.player.reloading) {
    const w = getEquipped(s);
    const _reloadBundle = computeModBundle(s.weaponMods[s.equippedWeapon] ?? []);
    const reloadRate = w.reloadRate * upgradeValue("ammoRegen", s.upgrades.ammoRegen) * _reloadBundle.reloadRateMul;
    s.player.ammoAcc += reloadRate * dt;
    while (s.player.ammoAcc >= 1) {
      s.player.ammoAcc -= 1;
      if (s.player.ammo < s.player.maxAmmo) s.player.ammo += 1;
    }
    if (s.player.ammo >= s.player.maxAmmo) {
      s.player.reloading = false;
      s.player.ammoAcc = 0;
    }
  }

  s.player.fireCd = Math.max(0, s.player.fireCd - dt);

  if (s.equippedWeapon === "laser") {
    // Laser: hold to charge, release to fire a scaled shot
    const CHARGE_TIME = 1.5;
    if (s.player.overdrive > 0) {
      // Overdrive bypasses charge — laser fires normally at boosted rate
      const wantFire = s.fireHeld || s.fireQueued;
      const eq = getEquipped(s);
      if (wantFire && !s.player.reloading && s.player.fireCd <= 0 && s.player.ammo > 0) {
        fireOne(s);
        const interval = s.fireHeld && eq.autoInterval > 0 ? eq.autoInterval : eq.tapInterval;
        const _laserBundle = computeModBundle(s.weaponMods[s.equippedWeapon] ?? []);
        s.player.fireCd = interval * _laserBundle.fireRateMul * 0.6;
        s.fireQueued = false;
      }
      s.player.laserCharging = false;
      s.player.laserCharge = 0;
    } else if (s.fireHeld && !s.player.reloading && s.player.ammo > 0) {
      if (!s.player.laserCharging) {
        s.player.laserCharging = true;
        s.player.laserCharge = 0;
      }
      s.player.laserCharge = Math.min(1, s.player.laserCharge + dt / CHARGE_TIME);
      if (s.player.laserCharge >= 1 && s.player.fireCd <= 0) {
        fireLaserCharged(s, 1.0);
      }
    } else if (s.player.laserCharging) {
      if (s.player.laserCharge > 0.05 && !s.player.reloading && s.player.ammo > 0 && s.player.fireCd <= 0) {
        fireLaserCharged(s, s.player.laserCharge);
      }
      s.player.laserCharging = false;
      s.player.laserCharge = 0;
    }
    s.fireQueued = false;
  } else {
    // All other weapons fire normally
    s.player.laserCharging = false;
    s.player.laserCharge = 0;
    const wantFire = s.fireHeld || s.fireQueued;
    const eq = getEquipped(s);
    if (wantFire && !s.player.reloading && s.player.fireCd <= 0 && s.player.ammo > 0) {
      fireOne(s);
      const interval = s.fireHeld && eq.autoInterval > 0 ? eq.autoInterval : eq.tapInterval;
      const _mainBundle = computeModBundle(s.weaponMods[s.equippedWeapon] ?? []);
      s.player.fireCd = interval * _mainBundle.fireRateMul * (s.player.overdrive > 0 ? 0.6 : 1);
      s.fireQueued = false;
    }
  }

  for (const b of s.bullets) {
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.ttl -= dt;
  }
  for (const b of s.bullets) {
    if (b.ttl <= 0) continue;
    for (const z of s.zombies) {
      if (z.hp <= 0) continue;
      if (b.hitIds[z.id]) continue;
      const d = dist(b.pos, z.pos);
      if (d < z.radius + b.radius) {
        if (b.damage > 0) {
          z.hp -= b.damage;
          if (z.hitFlash <= 0) s.sfxQueue.push("zombie_hit");
          z.hitFlash = 0.1;
        }
        // Apply ammo effect on hit
        if (b.ammoEffect === "fire") {
          z.burnTime = 3;
          z.burnDps = 5;
        } else if (b.ammoEffect === "cryo") {
          z.slowTime = Math.max(z.slowTime, 2);
        } else if (b.ammoEffect === "poison") {
          z.poisonStacks = Math.min(2, (z.poisonStacks ?? 0) + 1);
          z.poisonTime = 5;
        }
        b.hitIds[z.id] = true;
        spawnParticles(s, b.pos, b.color ?? "#FFFFFF", 2, 70);
        if (b.aoeRadius > 0) {
          explode(s, b.pos, b.aoeRadius, b.aoeDamage, "#F39C12");
          b.ttl = 0;
          break;
        }
        if (b.pierceLeft > 0) {
          b.pierceLeft -= 1;
        } else {
          b.ttl = 0;
          break;
        }
      }
    }
  }
  for (const b of s.bullets) {
    if (b.ttl <= 0 && b.aoeRadius > 0 && Object.keys(b.hitIds).length === 0) {
      explode(s, b.pos, b.aoeRadius, b.aoeDamage, "#F39C12");
    }
  }
  s.bullets = s.bullets.filter(
    (b) => b.ttl > 0 &&
      b.pos.x > s.camera.x - s.viewport.width / 2 - 60 && b.pos.x < s.camera.x + s.viewport.width / 2 + 60 &&
      b.pos.y > s.camera.y - s.viewport.height / 2 - 60 && b.pos.y < s.camera.y + s.viewport.height / 2 + 60,
  );

  for (const g of s.grenades) {
    if (g.stuckTo != null) {
      const target = s.zombies.find((z) => z.id === g.stuckTo);
      if (target && target.hp > 0 && g.stuckOffset) {
        g.pos.x = target.pos.x + g.stuckOffset.x;
        g.pos.y = target.pos.y + g.stuckOffset.y;
      }
    } else {
      g.pos.x += g.vel.x * dt;
      g.pos.y += g.vel.y * dt;
      g.vel.x *= 0.96;
      g.vel.y *= 0.96;
      if (g.type === "sticky") {
        for (const z of s.zombies) {
          if (z.hp <= 0) continue;
          if (dist(g.pos, z.pos) < z.radius + 6) {
            g.stuckTo = z.id;
            g.stuckOffset = { x: g.pos.x - z.pos.x, y: g.pos.y - z.pos.y };
            g.vel.x = 0; g.vel.y = 0;
            break;
          }
        }
      }
    }
    g.fuse -= dt;
  }
  s.grenades = s.grenades.filter((g) => {
    if (g.fuse <= 0) {
      explode(s, g.pos, g.radius, g.damage, "#FF2A2A");
      return false;
    }
    return true;
  });

  for (const m of s.mines) {
    if (m.armTime > 0) {
      m.armTime -= dt;
      continue;
    }
    for (const z of s.zombies) {
      if (z.hp <= 0) continue;
      if (dist(m.pos, z.pos) < z.radius + 18) {
        m.armTime = -1;
        explode(s, m.pos, m.radius, m.damage, "#FF8800");
        break;
      }
    }
  }
  s.mines = s.mines.filter((m) => m.armTime >= 0);

  for (const t of s.turrets) {
    t.fireCd = Math.max(0, t.fireCd - dt);
    if (t.hp <= 0) continue;
    if (t.fireCd <= 0) {
      turretFire(s, t);
      t.fireCd = 1 / t.fireRate;
    }
    if (t.magnetizerRange > 0) {
      for (const sc of s.scraps) {
        if (sc.ttl <= 0) continue;
        if (dist(sc.pos, t.pos) < t.magnetizerRange) {
          s.scrap += sc.value;
          s.stats.totalScrap += sc.value;
          s.stats.earnedScrap += sc.value;
          s.bountyTracking.scrapThisWave += sc.value;
          s.bountyTracking.earnedScrapThisWave += sc.value;
          sc.ttl = 0;
        }
      }
    }
  }
  const hadTurret = s.turrets.length > 0;
  s.turrets = s.turrets.filter((t) => t.hp > 0);
  if (hadTurret && s.turrets.length === 0 && s.turretRedeployCd <= 0) {
    s.turretRedeployCd = TURRET_REDEPLOY_COOLDOWN;
    spawnParticles(s, s.player.pos, "#00FFFF", 4, 60);
  }

  const armorReduction = upgradeValue("armor", s.upgrades.armor) * ub.defenseMul;
  for (const z of s.zombies) {
    if (z.hp <= 0) continue;
    z.hitFlash = Math.max(0, z.hitFlash - dt);
    if (z.stunTime > 0) z.stunTime = Math.max(0, z.stunTime - dt);
    if (z.slowTime > 0) z.slowTime = Math.max(0, z.slowTime - dt);
    if (z.burnTime > 0) {
      z.hp -= z.burnDps * dt;
      z.burnTime = Math.max(0, z.burnTime - dt);
    }
    if (z.poisonTime > 0) {
      z.hp -= (z.poisonStacks * 3) * dt;
      z.poisonTime = Math.max(0, z.poisonTime - dt);
      if (z.poisonTime <= 0) z.poisonStacks = 0;
    }
    if (z.attackCd > 0) z.attackCd = Math.max(0, z.attackCd - dt);
    if (z.stunTime > 0) {
      z.vel.x = 0; z.vel.y = 0;
      continue;
    }
    const buff = z.kind === "screamer" ? { speedMul: 1, damageMul: 1 } : screamerBuffMultiplier(s, z);
    const speedMul = (z.slowTime > 0 ? 0.45 : 1) * buff.speedMul;
    const effDamage = z.damage * buff.damageMul;

    // Scavenge mode: standard zombies roam the open map — no RIG to target.
    // Specials (bomber, spitter, boss) fall through to their own AI below so
    // their special abilities still work; they just target the player directly.
    const isStandardKind = z.kind !== "bomber" && z.kind !== "spitter" && z.kind !== "boss";
    if (s.gameMode === "scavenge" && isStandardKind) {
      const playerDist = dist(z.pos, s.player.pos);
      const CHASE_RANGE = 280;
      if (playerDist < CHASE_RANGE && !ub.zombieMode) {
        // Player is close — chase directly
        const aToPlayer = Math.atan2(s.player.pos.y - z.pos.y, s.player.pos.x - z.pos.x);
        z.vel.x = Math.cos(aToPlayer) * z.speed * speedMul;
        z.vel.y = Math.sin(aToPlayer) * z.speed * speedMul;
        moveZombieWithWalls(z, dt, s.arena, s.gameMode);
        z.patrolTarget = undefined;
        if (dist(z.pos, s.player.pos) < z.radius + 14 && s.player.invuln <= 0) {
          const dmgContact = effDamage * CONTACT_INVULN * CONTACT_DPS_MUL * (1 - Math.min(0.85, upgradeValue("armor", s.upgrades.armor) * ub.defenseMul));
          s.player.hp -= dmgContact;
          s.player.invuln = CONTACT_INVULN;
          if (s.player.hurtSfxCd <= 0) { s.sfxQueue.push("player_hurt"); s.player.hurtSfxCd = 0.5; }
          s.player.damageFlash = 0.18;
          s.flash.screen = 0.25;
        }
      } else {
        // Patrol: wander toward a random map point; reassign when reached or stuck.
        if (!z.patrolTarget || dist(z.pos, z.patrolTarget) < 70) {
          z.patrolTarget = randomMapPos(s.arena, s.gameMode);
          z.patrolStuckTimer = 0;
          z.patrolCheckPos = { x: z.pos.x, y: z.pos.y };
          z.patrolCheckTimer = 0;
        }
        const aToPatrol = Math.atan2(z.patrolTarget.y - z.pos.y, z.patrolTarget.x - z.pos.x);
        z.vel.x = Math.cos(aToPatrol) * z.speed * speedMul * 0.7;
        z.vel.y = Math.sin(aToPatrol) * z.speed * speedMul * 0.7;
        moveZombieWithWalls(z, dt, s.arena, s.gameMode);
        // Stuck detection: every 0.5s compare actual displacement to expected travel
        // distance. If the zombie barely moved despite having velocity (wedged against
        // a wall corner), accumulate stuck time and reassign the patrol target at 2s.
        z.patrolCheckTimer = (z.patrolCheckTimer ?? 0) + dt;
        if (z.patrolCheckTimer >= 0.5) {
          const checkPos = z.patrolCheckPos ?? { x: z.pos.x, y: z.pos.y };
          const progress = dist(z.pos, checkPos);
          const expectedTravel = z.speed * speedMul * 0.7 * 0.5;
          z.patrolCheckPos = { x: z.pos.x, y: z.pos.y };
          z.patrolCheckTimer = 0;
          if (expectedTravel > 0.5 && progress < expectedTravel * 0.25) {
            z.patrolStuckTimer = (z.patrolStuckTimer ?? 0) + 0.5;
            if (z.patrolStuckTimer >= 2.0) {
              z.patrolTarget = randomMapPos(s.arena, s.gameMode);
              z.patrolStuckTimer = 0;
              z.patrolCheckPos = { x: z.pos.x, y: z.pos.y };
            }
          } else {
            z.patrolStuckTimer = 0;
          }
        }
      }
      continue;
    }

    // ZOMBIE uniform: zombies ignore the player entirely, target only rig/turrets.
    // In scavenge mode, special kinds (bomber/spitter/boss) target the player by
    // default since there is no RIG to defend.
    // No RIG in scavenge mode or story escape missions — zombies hunt the player.
    const rigActive = isRigActive(s);
    let target: Vec2 = rigActive ? s.rig.pos : s.player.pos;
    let bestD = dist(z.pos, target);
    // Story escort: NPC is a valid attack target
    if (s.gameMode === "story" && s.storyObjective?.type === "escort") {
      const npcD = dist(z.pos, s.storyObjective.npcPos);
      if (npcD < bestD - 20) { bestD = npcD; target = s.storyObjective.npcPos; }
    }
    if (!ub.zombieMode) {
      const dp = dist(z.pos, s.player.pos);
      if (dp < bestD - 40) { target = s.player.pos; bestD = dp; }
    }
    let nearestTurret: Turret | null = null;
    for (const t of s.turrets) {
      const d = dist(z.pos, t.pos);
      if (d < bestD - 30) { bestD = d; nearestTurret = t; target = t.pos; }
    }
    const distToTarget = dist(z.pos, target);
    const a = Math.atan2(target.y - z.pos.y, target.x - z.pos.x);

    if (z.kind === "bomber") {
      if (z.telegraphed) {
        z.vel.x = 0; z.vel.y = 0;
        if (z.attackCd <= 0) {
          detonateBomber(s, z, ub, armorReduction);
        }
      } else if (distToTarget < BOMBER_TRIGGER_RANGE) {
        z.telegraphed = true;
        z.attackCd = BOMBER_FUSE;
        z.vel.x = 0; z.vel.y = 0;
        s.sfxQueue.push("zombie_groan_1");
      } else {
        z.vel.x = Math.cos(a) * z.speed * speedMul;
        z.vel.y = Math.sin(a) * z.speed * speedMul;
        moveZombieWithWalls(z, dt, s.arena, s.gameMode);
      }
      continue;
    }

    if (z.kind === "spitter") {
      if (distToTarget < SPITTER_RANGE * 0.55) {
        // too close — kite away from the target
        z.vel.x = -Math.cos(a) * z.speed * speedMul;
        z.vel.y = -Math.sin(a) * z.speed * speedMul;
      } else if (distToTarget > SPITTER_RANGE) {
        z.vel.x = Math.cos(a) * z.speed * speedMul;
        z.vel.y = Math.sin(a) * z.speed * speedMul;
      } else {
        z.vel.x = 0; z.vel.y = 0;
      }
      moveZombieWithWalls(z, dt, s.arena, s.gameMode);
      if (!ub.zombieMode && distToTarget < SPITTER_RANGE && z.attackCd <= 0) {
        spawnZombieProjectile(s, z.pos, target, effDamage);
        z.attackCd = SPITTER_FIRE_INTERVAL;
      }
      continue;
    }

    if (z.kind === "boss") {
      if (z.telegraphed) {
        z.vel.x = 0; z.vel.y = 0;
        if (z.attackCd <= 0) {
          bossSlamAttack(s, z, ub);
          z.telegraphed = false;
          z.attackCd = BOSS_SLAM_COOLDOWN;
        }
      } else if (distToTarget < BOSS_SLAM_RANGE && z.attackCd <= 0) {
        z.telegraphed = true;
        z.attackCd = BOSS_SLAM_WINDUP;
        z.vel.x = 0; z.vel.y = 0;
        s.sfxQueue.push("zombie_groan_1");
      } else {
        z.vel.x = Math.cos(a) * z.speed * speedMul;
        z.vel.y = Math.sin(a) * z.speed * speedMul;
        moveZombieWithWalls(z, dt, s.arena, s.gameMode);
      }
      // Boss is too tough to insta-die on rig contact — it just grinds the rig down.
      if (rigActive && !ub.zombieMode && dist(z.pos, s.rig.pos) < z.radius + s.rig.radius) {
        if (s.rig.hitSfxCd <= 0) { s.sfxQueue.push("rig_hit"); s.rig.hitSfxCd = 0.6; }
        s.rig.hp -= effDamage * dt * 1.5;
        s.rig.damageFlash = 0.25;
        s.flash.rig = 0.3;
      }
      if (!ub.zombieMode && dist(z.pos, s.player.pos) < z.radius + 14 && s.player.invuln <= 0) {
        // Contact damage is delivered as a lump per CONTACT_INVULN window (rather than
        // every single frame) so being surrounded by several zombies at once can't
        // stack unbounded per-frame damage from every attacker simultaneously — the
        // brief invuln caps how often any one hit lands while preserving the same
        // sustained dps from a single attacker.
        const dmg = effDamage * CONTACT_INVULN * CONTACT_DPS_MUL * (1 - Math.min(0.85, armorReduction));
        s.player.hp -= dmg;
        s.player.invuln = CONTACT_INVULN;
        if (s.player.hurtSfxCd <= 0) { s.sfxQueue.push("player_hurt"); s.player.hurtSfxCd = 0.5; }
        s.player.damageFlash = 0.18;
        s.flash.screen = 0.25;
      }
      if (nearestTurret && dist(z.pos, nearestTurret.pos) < z.radius + 18) {
        nearestTurret.hp -= effDamage * dt * 6;
      }
      continue;
    }

    // Standard movement — walker, runner, brute, tank, crawler, screamer
    z.vel.x = Math.cos(a) * z.speed * speedMul;
    z.vel.y = Math.sin(a) * z.speed * speedMul;
    moveZombieWithWalls(z, dt, s.arena, s.gameMode);

    // ZOMBIE uniform: rig takes no damage
    if (rigActive && dist(z.pos, s.rig.pos) < z.radius + s.rig.radius) {
      if (!ub.zombieMode) {
        if (s.rig.hitSfxCd <= 0) { s.sfxQueue.push("rig_hit"); s.rig.hitSfxCd = 0.6; }
        s.rig.hp -= effDamage;
        s.rig.damageFlash = 0.25;
        s.flash.rig = 0.3;
      }
      z.hp = -1;
      spawnParticles(s, z.pos, "#00FFFF", 6, 110);
    }
    // ZOMBIE uniform: zombies do not attack the player
    if (!ub.zombieMode && dist(z.pos, s.player.pos) < z.radius + 14 && s.player.invuln <= 0) {
      // See CONTACT_INVULN note above: lump damage per invuln window instead of
      // every frame, so multiple simultaneous attackers can't melt the player instantly.
      const dmg = effDamage * CONTACT_INVULN * CONTACT_DPS_MUL * (1 - Math.min(0.85, armorReduction));
      s.player.hp -= dmg;
      s.player.invuln = CONTACT_INVULN;
      if (s.player.hurtSfxCd <= 0) { s.sfxQueue.push("player_hurt"); s.player.hurtSfxCd = 0.5; }
      s.player.damageFlash = 0.18;
      s.flash.screen = 0.25;
    }
    if (nearestTurret && dist(z.pos, nearestTurret.pos) < z.radius + 18) {
      nearestTurret.hp -= effDamage * dt * 6;
    }
  }

  // Zombie-fired projectiles (Spitter acid globs)
  for (const zp of s.zombieProjectiles) {
    zp.pos.x += zp.vel.x * dt;
    zp.pos.y += zp.vel.y * dt;
    zp.ttl -= dt;
  }
  if (!ub.zombieMode) {
    for (const zp of s.zombieProjectiles) {
      if (zp.ttl <= 0) continue;
      if (s.player.invuln <= 0 && dist(zp.pos, s.player.pos) < zp.radius + 14) {
        s.player.hp -= zp.damage;
        if (s.player.hurtSfxCd <= 0) { s.sfxQueue.push("player_hurt"); s.player.hurtSfxCd = 0.5; }
        s.player.damageFlash = 0.18;
        s.flash.screen = 0.2;
        zp.ttl = 0;
        spawnParticles(s, zp.pos, "#39FF14", 6, 100);
      } else if (isRigActive(s) && dist(zp.pos, s.rig.pos) < zp.radius + s.rig.radius) {
        s.rig.hp -= zp.damage;
        s.rig.damageFlash = 0.2;
        s.flash.rig = 0.2;
        zp.ttl = 0;
        spawnParticles(s, zp.pos, "#39FF14", 6, 100);
      }
    }
  }
  s.zombieProjectiles = s.zombieProjectiles.filter(
    (zp) => zp.ttl > 0 &&
      zp.pos.x > s.camera.x - s.viewport.width / 2 - 40 && zp.pos.x < s.camera.x + s.viewport.width / 2 + 40 &&
      zp.pos.y > s.camera.y - s.viewport.height / 2 - 40 && zp.pos.y < s.camera.y + s.viewport.height / 2 + 40,
  );

  const bossRushMul = s.gameMode === "boss-rush" ? 2 : 1;
  for (const z of s.zombies) {
    if (z.hp <= 0) {
      s.stats.kills += 1;
      const _kk = s.bountyTracking.kindKills as Record<string, number>;
      if (z.kind in _kk) _kk[z.kind]++;
      if (s.isHorde) s.bountyTracking.hordeKillsThisRun++;
      if (z.killedByExplosion) s.bountyTracking.explosiveKills++;
      s.sfxQueue.push("zombie_die");
      spawnParticles(s, z.pos, "#39FF14", 10, 120);
      s.scraps.push({
        id: s.nextId++,
        pos: { x: z.pos.x, y: z.pos.y },
        vel: { x: 0, y: 0 },
        radius: 6,
        value: z.reward * bossRushMul,
        ttl: 12,
      });
      // Boss: guaranteed extra drop on top of its normal scrap reward.
      if (z.kind === "boss") {
        s.scraps.push({
          id: s.nextId++,
          pos: { x: z.pos.x + 14, y: z.pos.y + 14 },
          vel: { x: 0, y: 0 },
          radius: 8,
          value: z.reward * bossRushMul,
          ttl: 16,
        });
        spawnParticles(s, z.pos, "#F39C12", 26, 220);
      }
    }
  }
  s.zombies = s.zombies.filter((z) => z.hp > 0);

  const pickup = upgradeValue("pickupRadius", s.upgrades.pickupRadius);
  for (const sc of s.scraps) {
    const d = dist(sc.pos, s.player.pos);
    if (d < pickup) {
      const a = Math.atan2(s.player.pos.y - sc.pos.y, s.player.pos.x - sc.pos.x);
      const pull = 220 + (pickup - d) * 3;
      sc.pos.x += Math.cos(a) * pull * dt;
      sc.pos.y += Math.sin(a) * pull * dt;
    }
    sc.ttl -= dt;
    if (d < 16) {
      s.scrap += sc.value;
      s.stats.totalScrap += sc.value;
      s.stats.earnedScrap += sc.value;
      s.bountyTracking.scrapThisWave += sc.value;
      s.bountyTracking.earnedScrapThisWave += sc.value;
      if (s.gameMode === "scavenge" || (s.gameMode === "story" && s.storyObjective?.type === "scavenge"))
        s.scavengeCollected += sc.value;
      sc.ttl = -1;
      s.sfxQueue.push("scrap_pickup");
      spawnParticles(s, sc.pos, "#F39C12", 4, 60);
    }
  }
  s.scraps = s.scraps.filter((sc) => sc.ttl > 0);

  // Scavenge crates: player walks over them to collect (radius 28).
  // Each crate contributes directly to the quota (higher value than zombie drops).
  if (s.scavengeCrates.length > 0) {
    const CRATE_PICKUP_R = 28;
    for (const crate of s.scavengeCrates) {
      if (crate.claimed) continue;
      if (dist(crate.pos, s.player.pos) < CRATE_PICKUP_R) {
        crate.claimed = true;
        s.scrap += crate.value;
        s.stats.totalScrap += crate.value;
        s.stats.earnedScrap += crate.value;
        s.bountyTracking.scrapThisWave += crate.value;
        s.bountyTracking.earnedScrapThisWave += crate.value;
        if (s.gameMode === "scavenge") s.scavengeCollected += crate.value;
        s.sfxQueue.push("scrap_pickup");
        spawnParticles(s, crate.pos, "#F39C12", 10, 100);
        s.floatingTexts.push({
          id: s.nextId++,
          pos: { x: crate.pos.x, y: crate.pos.y - 20 },
          text: `+${crate.value}`,
          ttl: 1.2,
          maxTtl: 1.2,
        });
      }
    }
    s.scavengeCrates = s.scavengeCrates.filter((c) => !c.claimed);
  }

  for (const p of s.particles) {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.vel.x *= 0.92;
    p.vel.y *= 0.92;
    p.ttl -= dt;
  }
  s.particles = s.particles.filter((p) => p.ttl > 0);

  for (const ft of s.floatingTexts) {
    ft.pos.y -= 38 * dt;
    ft.ttl -= dt;
  }
  s.floatingTexts = s.floatingTexts.filter((ft) => ft.ttl > 0);

  for (const e of s.explosions) e.ttl -= dt;
  s.explosions = s.explosions.filter((e) => e.ttl > 0);

  s.flash.screen = Math.max(0, s.flash.screen - dt);
  s.flash.rig = Math.max(0, s.flash.rig - dt);
  s.player.damageFlash = Math.max(0, s.player.damageFlash - dt);
  s.player.hurtSfxCd = Math.max(0, s.player.hurtSfxCd - dt);
  s.rig.damageFlash = Math.max(0, s.rig.damageFlash - dt);
  s.rig.hitSfxCd = Math.max(0, s.rig.hitSfxCd - dt);

  if (s.player.hp < playerHpBefore) s.bountyTracking.tookDamageThisWave = true;
  tickBountyProgress(s);

  // Story objectives tick — may set status to missioncomplete or gameover
  if (s.gameMode === "story") {
    tickStoryObjective(s, dt);
    if (s.status !== "playing") return;
  }

  // RIG overload: only applies to non-story or defend missions
  const storyNeedsRig = s.gameMode === "story" && s.storyObjective?.type === "defend";
  const rigOverloaded = s.rig.hp <= 0 && s.gameMode !== "scavenge" && (s.gameMode !== "story" || storyNeedsRig);
  if (s.player.hp <= 0 || rigOverloaded) {
    s.player.hp = Math.max(0, s.player.hp);
    s.rig.hp = Math.max(0, s.rig.hp);
    s.status = "gameover";
    return;
  }
  // Scavenge: time expiry = game over (only if quota not yet met)
  if (s.gameMode === "scavenge" && s.scavengeTimeLeft <= 0 && s.scavengeCollected < s.scavengeQuota) {
    s.player.hp = Math.max(0, s.player.hp);
    s.status = "gameover";
    return;
  }

  // Scavenge: wave clears when quota is met — enemies don't all need to be dead
  if (s.gameMode === "scavenge" && s.scavengeQuota > 0 && s.scavengeCollected >= s.scavengeQuota) {
    s.stats.wavesCleared += 1;
    s.isHorde = false;
    s.hordeWarning = 0;
    s.hordeTimer = 0;
    s.event = null;
    s.bossWarning = 0;
    s.turrets = [];
    s.turretRedeployCd = 0;
    s.mines = [];
    s.grenades = [];
    s.zombieProjectiles = [];
    s.zombies = [];
    s.scavengeCrates = [];
    s.status = "waveclear";
    return;
  }

  const hordeSpawningDone = !s.isHorde || (s.hordeWarning <= 0 && s.hordeTimer <= 0);
  if (hordeSpawningDone && s.spawnQueue === 0 && s.zombies.length === 0) {
    s.stats.wavesCleared += 1;
    const bossRushBonus = s.gameMode === "boss-rush" ? 2 : 1;
    const baseBonus = (8 + s.wave * 3) * (s.isHorde ? 2 : 1) * bossRushBonus;
    const bonus = Math.round(baseBonus * ub.scrapMul);
    s.scrap += bonus;
    s.stats.totalScrap += bonus;
    s.stats.earnedScrap += bonus;
    s.isHorde = false;
    s.hordeWarning = 0;
    s.hordeTimer = 0;
    s.event = null;
    s.bossWarning = 0;
    s.turrets = []; // turretOwned stays true — permanently owned
    s.turretRedeployCd = 0;
    s.mines = [];
    s.grenades = [];
    s.zombieProjectiles = [];

    // Story missions: decide wave-clear behavior per objective type
    if (s.gameMode === "story" && s.storyObjective) {
      const obj = s.storyObjective;
      const mission = getMission(s.storyMissionId ?? -1);

      if (obj.type === "hold") {
        // Hold completes strictly via timer (tickStoryObjective); no wave-count shortcut.
        // Fall through to waveclear so player can use shop between waves.
      } else if (obj.type === "escort") {
        // Escort: wave-count based completion (no inter-wave shop)
        const waveTarget = mission?.escortWaveCount ?? 2;
        if (s.stats.wavesCleared >= waveTarget) {
          s.status = "missioncomplete";
          return;
        }
        // NPC survived this wave — keep pressure, re-arm without shop
        s.spawnQueue = Math.round((4 + s.wave * 1.5) * (mission?.enemyMul ?? 1));
        s.spawnCd = 2.5;
        return;
      } else if (obj.type === "defend") {
        // Defend falls through to waveclear — player needs shop upgrades between waves
      } else {
        // Single-objective missions (escape, scavenge, eliminate, sabotage):
        // enemies dead but objective not yet complete — re-arm next wave so
        // pressure continues. Never enter shop for these missions.
        s.spawnQueue = Math.round((3 + s.wave * 1.2) * (mission?.enemyMul ?? 1));
        s.spawnCd = 2.5;
        // Stay in playing status — tickStoryObjective will handle completion
        return;
      }
    }

    s.status = "waveclear";
  }
}

export function applyUpgrade(s: GameState, key: keyof Upgrades): boolean {
  const cost = effectiveUpgradeCost(s, key);
  if (s.scrap < cost) return false;
  s.scrap -= cost;
  s.upgrades[key] += 1;

  if (key === "health") {
    const newMax = upgradeValue("health", s.upgrades.health);
    const diff = newMax - s.player.maxHp;
    s.player.maxHp = newMax;
    s.player.hp = Math.min(newMax, s.player.hp + Math.max(0, diff));
  }
  if (key === "rigPlating") {
    const newMax = upgradeValue("rigPlating", s.upgrades.rigPlating);
    const diff = newMax - s.rig.maxHp;
    s.rig.maxHp = newMax;
    s.rig.hp = Math.min(newMax, s.rig.hp + Math.max(0, diff));
  }
  if (key === "ammoCap") {
    const newCap = maxAmmoFor(s, getEquipped(s));
    const diff = newCap - s.player.maxAmmo;
    s.player.maxAmmo = newCap;
    s.player.ammo = Math.min(newCap, s.player.ammo + Math.max(0, diff));
  }
  return true;
}

// Audit fix: repair() also restores player ammo to full magazine capacity,
// making it a true "field repair" that tops off HP, RIG, and ammo simultaneously.
// Manual reload — triggers immediately if mag isn't full and not already reloading.
export function startReload(s: GameState): boolean {
  if (s.player.reloading || s.player.ammo >= s.player.maxAmmo || s.player.overdrive > 0) return false;
  s.player.reloading = true;
  s.player.ammoAcc = 0;
  return true;
}

export function repair(s: GameState) {
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.maxHp * 0.15);
  s.rig.hp = Math.min(s.rig.maxHp, s.rig.hp + s.rig.maxHp * 0.1);
  s.player.ammo = s.player.maxAmmo; // restores ammo to full magazine capacity
}

// ─── Save / Load ─────────────────────────────────────────────────────────────

export type SaveData = {
  wave: number;
  scrap: number;
  upgrades: Upgrades;
  abilities: Record<AbilityId, { level: number; cooldown: number }>;
  equippedAbility: AbilityId | null;
  equippedWeapon: WeaponId;
  ownedWeapons: WeaponId[];
  weaponMods?: Partial<Record<WeaponId, (ModId | null)[]>>;
  throwables: Record<ThrowableType, number>;
  turretOwned: boolean;
  turretUpgrades: { damage: number; fireRate: number; defense: number; magnetizer: number };
  playerHp: number;
  playerMaxHp: number;
  rigHp: number;
  rigMaxHp: number;
  stats: { kills: number; totalScrap: number; earnedScrap: number; wavesCleared: number };
  equippedUniform: UniformId;
  gameMode: GameMode;
  storyMissionId?: number | null;
  activeBounties?: Bounty[];
  bountyTracking?: BountyTracking;
};

export function extractSave(s: GameState): SaveData {
  return {
    wave: s.wave,
    scrap: s.scrap,
    upgrades: { ...s.upgrades },
    abilities: {
      dash: { ...s.abilities.dash },
      grenade: { ...s.abilities.grenade },
      flashbang: { ...s.abilities.flashbang },
      emp: { ...s.abilities.emp },
      overdrive: { ...s.abilities.overdrive },
    },
    equippedAbility: s.equippedAbility,
    equippedWeapon: s.equippedWeapon,
    ownedWeapons: [...s.ownedWeapons],
    weaponMods: Object.fromEntries(
      Object.entries(s.weaponMods).map(([k, v]) => [k, v ? [...v] : v])
    ) as Partial<Record<WeaponId, (ModId | null)[]>>,
    throwables: { ...s.throwables },
    turretOwned: s.turretOwned,
    turretUpgrades: { ...s.turretUpgrades },
    playerHp: s.player.hp,
    playerMaxHp: s.player.maxHp,
    rigHp: s.rig.hp,
    rigMaxHp: s.rig.maxHp,
    stats: { ...s.stats },
    equippedUniform: s.equippedUniform,
    gameMode: s.gameMode,
    storyMissionId: s.storyMissionId,
    activeBounties: s.activeBounties.map((b) => ({ ...b })),
    bountyTracking: {
      ...s.bountyTracking,
      kindKills: { ...s.bountyTracking.kindKills },
    },
  };
}

export function applySave(s: GameState, save: SaveData): void {
  s.wave = save.wave;
  s.scrap = save.scrap;
  s.upgrades = { ...save.upgrades };
  s.abilities = {
    dash: { ...save.abilities.dash },
    grenade: { ...save.abilities.grenade },
    flashbang: { ...save.abilities.flashbang },
    emp: { ...save.abilities.emp },
    overdrive: { ...save.abilities.overdrive },
  };
  s.equippedAbility = save.equippedAbility;
  s.equippedWeapon = save.equippedWeapon;
  s.ownedWeapons = [...save.ownedWeapons];
  s.weaponMods = save.weaponMods
    ? Object.fromEntries(Object.entries(save.weaponMods).map(([k, v]) => [k, v ? [...v] : v])) as Partial<Record<WeaponId, (ModId | null)[]>>
    : {};
  s.throwables = { ...save.throwables };
  s.turretOwned = save.turretOwned ?? false;
  s.turretUpgrades = save.turretUpgrades
    ? { ...save.turretUpgrades }
    : { damage: 1, fireRate: 1, defense: 1, magnetizer: 1 };
  s.player.hp = Math.min(save.playerHp, save.playerMaxHp);
  s.player.maxHp = save.playerMaxHp;
  s.rig.hp = Math.min(save.rigHp, save.rigMaxHp);
  s.rig.maxHp = save.rigMaxHp;
  s.stats = { ...save.stats, earnedScrap: save.stats.earnedScrap ?? save.stats.totalScrap };
  s.equippedUniform = save.equippedUniform ?? "standard";
  s.gameMode = save.gameMode ?? "rig-defense";
  if (save.activeBounties && save.activeBounties.length > 0) {
    s.activeBounties = save.activeBounties.map((b) => ({ ...b }));
  }
  if (save.bountyTracking) {
    s.bountyTracking = {
      ...save.bountyTracking,
      earnedScrapThisWave: save.bountyTracking.earnedScrapThisWave ?? save.bountyTracking.scrapThisWave,
      kindKills: { ...save.bountyTracking.kindKills },
    };
  }
  // Story saves must carry mission context so the objective zone, spawners, and
  // game-mode branches are re-established.  setupStoryMission overwrites
  // activeBounties / bountyTracking with clean story values, which is correct
  // because story runs never use the regular bounty system.
  if (s.gameMode === "story" && save.storyMissionId != null) {
    setupStoryMission(s, save.storyMissionId);
  }
  // Recalculate ammo from current weapon + ammoCap upgrade + mod magBonus
  const w = WEAPONS[s.equippedWeapon];
  s.player.maxAmmo = maxAmmoFor(s, w);
  s.player.ammo = s.player.maxAmmo;
  s.status = "shop";
}

// ─── Weapon Mod Management ────────────────────────────────────────────────────

export function getSlottedMods(s: GameState, weaponId: WeaponId): (ModId | null)[] {
  return s.weaponMods[weaponId] ?? Array(MOD_SLOTS).fill(null);
}

export function buyAndSlotMod(s: GameState, weaponId: WeaponId, slotIndex: number, modId: ModId): boolean {
  const mod = MODS[modId];
  if (slotIndex < 0 || slotIndex >= MOD_SLOTS) return false;

  if (!s.weaponMods[weaponId]) {
    s.weaponMods[weaponId] = Array(MOD_SLOTS).fill(null) as (ModId | null)[];
  }
  const slots = s.weaponMods[weaponId]!;

  // No-op guard: mod already in this exact slot — nothing to do
  if (slots[slotIndex] === modId) return false;

  // Stack cap: count existing copies of this modId across all slots (excluding target slot)
  const existingCount = slots.filter((id, i) => i !== slotIndex && id === modId).length;
  if (existingCount >= mod.stackCap) return false;

  // ── Atomic affordability check ────────────────────────────────────────────
  // Compute ALL refunds upfront before touching state, then validate net cost.

  // Refund from old ammo mod in a different slot (ammo-swap path)
  let ammoSwapRefund = 0;
  let ammoSwapSlot = -1;
  if (mod.family === "ammo") {
    for (let i = 0; i < slots.length; i++) {
      if (i === slotIndex) continue;
      const otherId = slots[i];
      if (otherId !== null && MODS[otherId].family === "ammo") {
        ammoSwapRefund = Math.floor(MODS[otherId].cost * 0.5);
        ammoSwapSlot = i;
        break;
      }
    }
  }

  // Refund from mod currently in the target slot (if it will be displaced)
  const displaced = slots[slotIndex];
  const displacedRefund = (displaced && displaced !== modId)
    ? Math.floor(MODS[displaced].cost * 0.5)
    : 0;

  // Net cost after all refunds; reject if player can't afford it
  const netCost = mod.cost - ammoSwapRefund - displacedRefund;
  if (s.scrap < netCost) return false;

  // ── Commit mutations ──────────────────────────────────────────────────────
  if (ammoSwapSlot >= 0) slots[ammoSwapSlot] = null;
  slots[slotIndex] = modId;
  s.scrap -= netCost;

  // Recompute maxAmmo if this weapon is equipped
  if (weaponId === s.equippedWeapon) {
    const ww = WEAPONS[weaponId];
    const newMax = maxAmmoFor(s, ww);
    if (newMax !== s.player.maxAmmo) {
      s.player.maxAmmo = newMax;
      s.player.ammo = Math.min(s.player.ammo, newMax);
    }
  }
  return true;
}

export function removeSlottedMod(s: GameState, weaponId: WeaponId, slotIndex: number): void {
  const slots = s.weaponMods[weaponId];
  if (!slots) return;
  const existing = slots[slotIndex];
  if (existing) {
    // 50% refund on removal
    s.scrap += Math.floor(MODS[existing].cost * 0.5);
  }
  slots[slotIndex] = null;

  if (weaponId === s.equippedWeapon) {
    const ww = WEAPONS[weaponId];
    const newMax = maxAmmoFor(s, ww);
    if (newMax !== s.player.maxAmmo) {
      s.player.maxAmmo = newMax;
      s.player.ammo = Math.min(s.player.ammo, newMax);
    }
  }
}
