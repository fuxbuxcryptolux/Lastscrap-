import React from "react";
import { View, StyleSheet, Image, Platform, Text, ScrollView, Pressable } from "react-native";
import { GameState, WALL_CELLS, RIGDEF_WALL_CELLS } from "../game/engine";
import { FloatingText, ScrapCrate, StoryObjective } from "../game/types";
import { UNIFORMS, UniformId } from "../game/uniforms";

const ARENA_BG_MAZE = require("../../assets/images/game/maze.png");
const ARENA_BG_RIGDEF = require("../../assets/images/game/rigdef_map.png");
const RIG_IMG = require("../../assets/images/game/rig.png");
const RIGDEF_RIG_IMG = require("../../assets/images/game/rigdef_rig.jpg");
const HERO_IMG = require("../../assets/images/game/hero.png");
const TURRET_IMG = require("../../assets/images/game/turret.png");
const Z_WALKER_B1 = require("../../assets/images/game/zombie_walker_b1.png");
const Z_WALKER_B2 = require("../../assets/images/game/zombie_walker_b2.png");
const Z_WALKER_B3 = require("../../assets/images/game/zombie_walker_b3.png");
const Z_RUNNER_B4 = require("../../assets/images/game/zombie_runner_b4.png");
const Z_RUNNER_B5 = require("../../assets/images/game/zombie_runner_b5.png");
const Z_BRUTE     = require("../../assets/images/game/zombie_brute.png");
const Z_TANK      = require("../../assets/images/game/zombie_tank.png");

const WALKER_SPRITES = [Z_WALKER_B1, Z_WALKER_B2, Z_WALKER_B3];
const RUNNER_SPRITES = [Z_RUNNER_B4, Z_RUNNER_B5];

// New zombie kinds reuse existing sprites with a color tint + badge instead of
// new art, matching the tank's existing aura-ring treatment below.
const SPECIAL_ZOMBIE_CONFIG: Partial<Record<
  string,
  { sprite: unknown; tint: string; badge: string; sizeMul: number; auraColor: string }
>> = {
  spitter:  { sprite: Z_BRUTE,      tint: "#39FF14", badge: "SPITTER",  sizeMul: 0.9,  auraColor: "rgba(57,255,20,0.5)" },
  screamer: { sprite: Z_RUNNER_B4,  tint: "#4FC3F7", badge: "SCREAMER", sizeMul: 0.85, auraColor: "rgba(79,195,247,0.5)" },
  bomber:   { sprite: Z_BRUTE,      tint: "#F39C12", badge: "BOMBER",   sizeMul: 0.95, auraColor: "rgba(243,156,18,0.6)" },
  crawler:  { sprite: Z_RUNNER_B5,  tint: "#FF2A2A", badge: "",         sizeMul: 0.68, auraColor: "rgba(255,42,42,0.4)" },
  boss:     { sprite: Z_TANK,       tint: "#FF2A2A", badge: "BOSS",     sizeMul: 1.7,  auraColor: "rgba(255,42,42,0.6)" },
};

const SCREAMER_AURA_RADIUS = 150;

const HERO_SIZE = 42;
const RIG_SIZE = 110;

// Per-uniform visual config for the player sprite
type UniformVisual = {
  tintOpacity: number;
  ringSize: number;        // outer ring diameter relative to HERO_SIZE
  ringBorderWidth: number;
  ringBorderColor: string;
  ringBgOpacity: number;   // ring background fill opacity
  outerRingSize?: number;  // second outer ring (optional)
  outerRingColor?: string;
  outerRingOpacity?: number;
};

const UNIFORM_VISUAL: Record<UniformId, UniformVisual> = {
  standard: {
    tintOpacity: 0, ringSize: 0, ringBorderWidth: 0, ringBorderColor: "transparent", ringBgOpacity: 0,
  },
  spacemarine: {
    tintOpacity: 0.5, ringSize: 1.6, ringBorderWidth: 3, ringBorderColor: "#00FFFF", ringBgOpacity: 0.08,
    outerRingSize: 2.1, outerRingColor: "#00FFFF", outerRingOpacity: 0.2,
  },
  armybasic: {
    tintOpacity: 0.45, ringSize: 1.55, ringBorderWidth: 2, ringBorderColor: "#39FF14", ringBgOpacity: 0.06,
    outerRingSize: 2.0, outerRingColor: "#39FF14", outerRingOpacity: 0.18,
  },
  apocalypse: {
    tintOpacity: 0.5, ringSize: 1.7, ringBorderWidth: 3, ringBorderColor: "#F39C12", ringBgOpacity: 0.1,
    outerRingSize: 2.2, outerRingColor: "#FF2A2A", outerRingOpacity: 0.22,
  },
  street: {
    tintOpacity: 0.5, ringSize: 1.6, ringBorderWidth: 2, ringBorderColor: "#FF2A95", ringBgOpacity: 0.08,
    outerRingSize: 2.0, outerRingColor: "#FF2A95", outerRingOpacity: 0.2,
  },
  zombie: {
    tintOpacity: 0.55, ringSize: 1.5, ringBorderWidth: 3, ringBorderColor: "#8BC34A", ringBgOpacity: 0.15,
    outerRingSize: 1.9, outerRingColor: "#8BC34A", outerRingOpacity: 0.25,
  },
};

type Props = {
  state: GameState;
  onDebugChange?: (enabled: boolean) => void;
};

function zombieSprite(variant: number, kind: string) {
  if (kind === "brute") return Z_BRUTE;
  if (kind === "runner") return RUNNER_SPRITES[variant % RUNNER_SPRITES.length];
  return WALKER_SPRITES[variant % WALKER_SPRITES.length];
}

function zombieRenderSize(radius: number) {
  return radius * 2.6;
}

function Arena({ state, onDebugChange }: Props) {
  const { arena, viewport, camera, rig, player, zombies, bullets, scraps, particles, floatingTexts, scavengeCrates } = state;
  const worldLeft = viewport.width / 2 - camera.x;
  const worldTop = viewport.height / 2 - camera.y;

  const rigFlash = rig.damageFlash > 0;
  const rigSize = RIG_SIZE;

  const uniformId = state.equippedUniform ?? "standard";
  const uniformDef = UNIFORMS[uniformId];
  const uv = UNIFORM_VISUAL[uniformId];
  const tintColor = uniformDef.color;
  const isStandard = uniformId === "standard";

  // === WALL DEBUG ===
  // Set to false again once wall placement is finalized — this intentionally
  // overrides __DEV__ so the tool also works on the deployed/production URL.
  const SHOW_WALL_DEBUG = true;
  const [debugEnabled, setDebugEnabled] = React.useState(false);
  const [debugWalls, setDebugWalls] = React.useState<Array<{ x: number; y: number; w: number; h: number }>>(() =>
    SHOW_WALL_DEBUG
      ? (state.gameMode === "rig-defense" ? RIGDEF_WALL_CELLS : WALL_CELLS).map(([x, y, w, h]) => ({ x, y, w, h }))
      : []
  );
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const dragRef = React.useRef<{ startNormX: number; startNormY: number; startPX: number; startPY: number } | null>(null);

  function adjustWall(dw: number, dh: number) {
    if (selectedIdx === null) return;
    setDebugWalls((prev) =>
      prev.map((w, i) =>
        i === selectedIdx ? { ...w, w: Math.max(0.01, w.w + dw), h: Math.max(0.01, w.h + dh) } : w
      )
    );
  }

  return (
    <View
      testID="game-arena"
      pointerEvents="box-none"
      style={[styles.viewport, { width: viewport.width, height: viewport.height }]}
    >
      <View
        pointerEvents="none"
        style={[styles.arena, { width: arena.width, height: arena.height, left: worldLeft, top: worldTop }]}
      >
      {/* Arena floor — full-bleed map fills the entire world */}
      <Image
        source={state.gameMode === "rig-defense" ? ARENA_BG_RIGDEF : ARENA_BG_MAZE}
        resizeMode="stretch"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: arena.width,
          height: arena.height,
          opacity: 0.95,
        }}
      />
      {/* RIG is hidden in story escape mode (no defendable target) */}
      {!(state.gameMode === "story" && state.storyObjective?.type === "escape") && (
        <>
          {/* RIG sprite */}
          <View
            style={{
              position: "absolute",
              left: rig.pos.x - rigSize / 2,
              top: rig.pos.y - rigSize / 2,
              width: rigSize,
              height: rigSize,
            }}
          >
            <Image
              source={state.gameMode === "rig-defense" ? RIGDEF_RIG_IMG : RIG_IMG}
              style={{ width: "100%", height: "100%", opacity: 0.95 }}
              resizeMode="contain"
            />
            {rigFlash && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: "#FF2A2A", opacity: 0.35, borderRadius: rigSize / 2 },
                ]}
              />
            )}
          </View>

          {/* Workbench — only visible in rig-defense during shop phase */}
          {state.gameMode === "rig-defense" && state.status === "shop" && state.workbench && state.workbench.active && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: state.workbench.pos.x - 20,
                top: state.workbench.pos.y - 20,
                width: 40,
                height: 40,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: "#9B59B6",
                backgroundColor: "rgba(155,89,182,0.25)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#9B59B6", fontSize: 10, fontWeight: "800", fontFamily: "Courier" }}>BENCH</Text>
            </View>
          )}

          {/* RIG HP indicator */}
          <View
            style={[
              styles.rigHpBar,
              { left: rig.pos.x - 46, top: rig.pos.y + rigSize / 2 + 6, width: 92 },
            ]}
          >
            <View
              style={[
                styles.rigHpFill,
                {
                  width: `${Math.max(0, (rig.hp / rig.maxHp) * 100)}%`,
                  backgroundColor: rig.hp / rig.maxHp > 0.4 ? "#00FFFF" : "#FF2A2A",
                },
              ]}
            />
          </View>
        </>
      )}

      {/* Scrap drops */}
      {scraps.map((s) => (
        <View key={s.id} style={[styles.scrap, { left: s.pos.x - 5, top: s.pos.y - 5 }]} />
      ))}

      {/* Zombies */}
      {zombies.map((z) => {
        const flash = z.hitFlash > 0;
        const hpRatio = z.hp / z.maxHp;

        // TANK — sprite rendering
        if (z.kind === "tank") {
          const tankSize = zombieRenderSize(z.radius);
          return (
            <View key={z.id}>
              {/* Threat aura ring */}
              <View
                style={{
                  position: "absolute",
                  left: z.pos.x - tankSize / 2 - 8,
                  top: z.pos.y - tankSize / 2 - 8,
                  width: tankSize + 16,
                  height: tankSize + 16,
                  borderRadius: (tankSize + 16) / 2,
                  borderWidth: 2,
                  borderColor: flash ? "#FF8800" : "rgba(139,0,0,0.7)",
                  backgroundColor: flash ? "rgba(255,68,0,0.18)" : "rgba(139,0,0,0.10)",
                }}
              />
              {/* Tank sprite */}
              <Image
                source={Z_TANK}
                resizeMode="contain"
                style={{
                  position: "absolute",
                  left: z.pos.x - tankSize / 2,
                  top: z.pos.y - tankSize / 2,
                  width: tankSize,
                  height: tankSize,
                  opacity: flash ? 0.55 : 1,
                }}
              />
              {/* Hit flash overlay */}
              {flash && (
                <View
                  style={{
                    position: "absolute",
                    left: z.pos.x - tankSize / 2,
                    top: z.pos.y - tankSize / 2,
                    width: tankSize,
                    height: tankSize,
                    backgroundColor: "#FFFFFF",
                    opacity: 0.4,
                    borderRadius: tankSize / 2,
                  }}
                />
              )}
              {/* Burn overlay */}
              {z.burnTime > 0 && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - tankSize / 2,
                    top: z.pos.y - tankSize / 2,
                    width: tankSize,
                    height: tankSize,
                    borderRadius: tankSize / 2,
                    backgroundColor: "rgba(255,69,0,0.35)",
                    borderWidth: 1,
                    borderColor: "rgba(255,140,0,0.6)",
                  }}
                />
              )}
              {/* Poison overlay */}
              {z.poisonStacks > 0 && z.poisonTime > 0 && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - tankSize / 2,
                    top: z.pos.y - tankSize / 2,
                    width: tankSize,
                    height: tankSize,
                    borderRadius: tankSize / 2,
                    backgroundColor: `rgba(139,195,74,${0.18 + z.poisonStacks * 0.1})`,
                    borderWidth: 1,
                    borderColor: "rgba(139,195,74,0.5)",
                  }}
                />
              )}
              {/* Status icons */}
              {(z.burnTime > 0 || (z.poisonStacks > 0 && z.poisonTime > 0)) && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - tankSize / 2,
                    top: z.pos.y - tankSize / 2 - 14,
                    width: tankSize,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  {z.burnTime > 0 && (
                    <Text style={{ fontSize: 10, lineHeight: 12 }}>🔥</Text>
                  )}
                  {z.poisonStacks > 0 && z.poisonTime > 0 && (
                    <Text style={{ fontSize: 10, lineHeight: 12 }}>☠️</Text>
                  )}
                </View>
              )}
              {/* HP bar */}
              {hpRatio < 1 && (
                <View
                  style={[
                    styles.zHp,
                    {
                      left: z.pos.x - tankSize / 2,
                      top: z.pos.y - tankSize / 2 - 8,
                      width: tankSize,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.zHpFill,
                      {
                        width: `${hpRatio * 100}%`,
                        backgroundColor: hpRatio > 0.5 ? "#FF2A2A" : "#FF8800",
                      },
                    ]}
                  />
                </View>
              )}
              {/* TANK badge */}
              <View
                style={{
                  position: "absolute",
                  left: z.pos.x - 20,
                  top: z.pos.y - tankSize / 2 - 20,
                }}
              >
                <Text style={styles.tankBadge}>TANK</Text>
              </View>
            </View>
          );
        }

        // Spitter / Screamer / Bomber / Crawler / Boss — tinted reuse of existing sprites
        const special = SPECIAL_ZOMBIE_CONFIG[z.kind];
        if (special) {
          const size = zombieRenderSize(z.radius) * special.sizeMul * (z.kind === "boss" ? 1 : 1);
          const bossSize = z.kind === "boss" ? zombieRenderSize(z.radius) * special.sizeMul : size;
          const finalSize = z.kind === "boss" ? bossSize : size;
          const telegraphPulse = z.telegraphed ? (Math.sin(Date.now() / 90) + 1) / 2 : 0;
          return (
            <View key={z.id}>
              {/* Screamer persistent buff aura */}
              {z.kind === "screamer" && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - SCREAMER_AURA_RADIUS,
                    top: z.pos.y - SCREAMER_AURA_RADIUS,
                    width: SCREAMER_AURA_RADIUS * 2,
                    height: SCREAMER_AURA_RADIUS * 2,
                    borderRadius: SCREAMER_AURA_RADIUS,
                    borderWidth: 1,
                    borderColor: special.auraColor,
                    backgroundColor: "rgba(79,195,247,0.05)",
                  }}
                />
              )}
              {/* Telegraph warning ring (bomber fuse / boss slam windup) */}
              {z.telegraphed && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - finalSize / 2 - 10 - telegraphPulse * 14,
                    top: z.pos.y - finalSize / 2 - 10 - telegraphPulse * 14,
                    width: finalSize + 20 + telegraphPulse * 28,
                    height: finalSize + 20 + telegraphPulse * 28,
                    borderRadius: (finalSize + 20) / 2 + 14,
                    borderWidth: 3,
                    borderColor: "#FF2A2A",
                    backgroundColor: `rgba(255,42,42,${0.12 + telegraphPulse * 0.18})`,
                  }}
                />
              )}
              {/* Tint aura ring */}
              <View
                style={{
                  position: "absolute",
                  left: z.pos.x - finalSize / 2 - 6,
                  top: z.pos.y - finalSize / 2 - 6,
                  width: finalSize + 12,
                  height: finalSize + 12,
                  borderRadius: (finalSize + 12) / 2,
                  borderWidth: 2,
                  borderColor: flash ? "#FFFFFF" : special.tint,
                  backgroundColor: flash ? "rgba(255,255,255,0.15)" : `${special.tint}22`,
                }}
              />
              <Image
                source={special.sprite as any}
                resizeMode="contain"
                style={{
                  position: "absolute",
                  left: z.pos.x - finalSize / 2,
                  top: z.pos.y - finalSize / 2,
                  width: finalSize,
                  height: finalSize,
                  opacity: flash ? 0.6 : 1,
                }}
              />
              {flash && (
                <View
                  style={{
                    position: "absolute",
                    left: z.pos.x - finalSize / 2,
                    top: z.pos.y - finalSize / 2,
                    width: finalSize,
                    height: finalSize,
                    backgroundColor: "#FFFFFF",
                    opacity: 0.4,
                    borderRadius: finalSize / 2,
                  }}
                />
              )}
              {/* Burn overlay */}
              {z.burnTime > 0 && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - finalSize / 2,
                    top: z.pos.y - finalSize / 2,
                    width: finalSize,
                    height: finalSize,
                    borderRadius: finalSize / 2,
                    backgroundColor: "rgba(255,69,0,0.35)",
                    borderWidth: 1,
                    borderColor: "rgba(255,140,0,0.6)",
                  }}
                />
              )}
              {/* Poison overlay */}
              {z.poisonStacks > 0 && z.poisonTime > 0 && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - finalSize / 2,
                    top: z.pos.y - finalSize / 2,
                    width: finalSize,
                    height: finalSize,
                    borderRadius: finalSize / 2,
                    backgroundColor: `rgba(139,195,74,${0.18 + z.poisonStacks * 0.1})`,
                    borderWidth: 1,
                    borderColor: "rgba(139,195,74,0.5)",
                  }}
                />
              )}
              {/* Status icons */}
              {(z.burnTime > 0 || (z.poisonStacks > 0 && z.poisonTime > 0)) && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: z.pos.x - finalSize / 2,
                    top: z.pos.y - finalSize / 2 - 14,
                    width: finalSize,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  {z.burnTime > 0 && (
                    <Text style={{ fontSize: 10, lineHeight: 12 }}>🔥</Text>
                  )}
                  {z.poisonStacks > 0 && z.poisonTime > 0 && (
                    <Text style={{ fontSize: 10, lineHeight: 12 }}>☠️</Text>
                  )}
                </View>
              )}
              {hpRatio < 1 && (
                <View
                  style={[
                    styles.zHp,
                    { left: z.pos.x - finalSize / 2, top: z.pos.y - finalSize / 2 - 8, width: finalSize },
                  ]}
                >
                  <View
                    style={[
                      styles.zHpFill,
                      { width: `${hpRatio * 100}%`, backgroundColor: special.tint },
                    ]}
                  />
                </View>
              )}
              {special.badge.length > 0 && (
                <View style={{ position: "absolute", left: z.pos.x - 24, top: z.pos.y - finalSize / 2 - 22 }}>
                  <Text style={[styles.tankBadge, { color: special.tint, borderColor: special.tint }]}>
                    {special.badge}
                  </Text>
                </View>
              )}
            </View>
          );
        }

        // Normal zombies (walker / runner / brute)
        const sprite = zombieSprite(z.variant, z.kind ?? "walker");
        const visSize = zombieRenderSize(z.radius);
        return (
          <View key={z.id}>
            <Image
              source={sprite}
              resizeMode="contain"
              style={{
                position: "absolute",
                left: z.pos.x - visSize / 2,
                top: z.pos.y - visSize / 2,
                width: visSize,
                height: visSize,
                opacity: flash ? 0.6 : 1,
                backgroundColor: "transparent",
              }}
            />
            {flash && (
              <View
                style={{
                  position: "absolute",
                  left: z.pos.x - visSize / 2,
                  top: z.pos.y - visSize / 2,
                  width: visSize,
                  height: visSize,
                  backgroundColor: "#FFFFFF",
                  opacity: 0.35,
                  borderRadius: visSize / 2,
                }}
              />
            )}
            {z.stunTime > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: z.pos.x - visSize / 2,
                  top: z.pos.y - visSize / 2,
                  width: visSize,
                  height: visSize,
                  borderRadius: visSize / 2,
                  borderWidth: 2,
                  borderColor: "#FFEFA8",
                  backgroundColor: "rgba(255,239,168,0.25)",
                }}
              />
            )}
            {z.stunTime <= 0 && z.slowTime > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: z.pos.x - visSize / 2,
                  top: z.pos.y - visSize / 2,
                  width: visSize,
                  height: visSize,
                  borderRadius: visSize / 2,
                  backgroundColor: "rgba(79,195,247,0.3)",
                }}
              />
            )}
            {z.burnTime > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: z.pos.x - visSize / 2,
                  top: z.pos.y - visSize / 2,
                  width: visSize,
                  height: visSize,
                  borderRadius: visSize / 2,
                  backgroundColor: "rgba(255,69,0,0.35)",
                  borderWidth: 1,
                  borderColor: "rgba(255,140,0,0.6)",
                }}
              />
            )}
            {z.poisonStacks > 0 && z.poisonTime > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: z.pos.x - visSize / 2,
                  top: z.pos.y - visSize / 2,
                  width: visSize,
                  height: visSize,
                  borderRadius: visSize / 2,
                  backgroundColor: `rgba(139,195,74,${0.18 + z.poisonStacks * 0.1})`,
                  borderWidth: 1,
                  borderColor: "rgba(139,195,74,0.5)",
                }}
              />
            )}
            {/* Status icons above zombie sprite */}
            {(z.burnTime > 0 || z.slowTime > 0 || (z.poisonStacks > 0 && z.poisonTime > 0)) && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: z.pos.x - visSize / 2,
                  top: z.pos.y - visSize / 2 - 14,
                  width: visSize,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                {z.burnTime > 0 && (
                  <Text style={{ fontSize: 10, lineHeight: 12 }}>🔥</Text>
                )}
                {z.slowTime > 0 && (
                  <Text style={{ fontSize: 10, lineHeight: 12 }}>❄️</Text>
                )}
                {z.poisonStacks > 0 && z.poisonTime > 0 && (
                  <Text style={{ fontSize: 10, lineHeight: 12 }}>☠️</Text>
                )}
              </View>
            )}
            {hpRatio < 1 && (
              <View
                style={[
                  styles.zHp,
                  {
                    left: z.pos.x - z.radius,
                    top: z.pos.y - visSize / 2 - 6,
                    width: z.radius * 2,
                  },
                ]}
              >
                <View style={[styles.zHpFill, { width: `${hpRatio * 100}%` }]} />
              </View>
            )}
          </View>
        );
      })}

      {/* Zombie projectiles (Spitter acid globs) */}
      {state.zombieProjectiles.map((zp) => (
        <View
          key={`zp-${zp.id}`}
          style={{
            position: "absolute",
            left: zp.pos.x - zp.radius,
            top: zp.pos.y - zp.radius,
            width: zp.radius * 2,
            height: zp.radius * 2,
            borderRadius: zp.radius,
            backgroundColor: "#39FF14",
            borderWidth: 1,
            borderColor: "#1a7a00",
          }}
        />
      ))}

      {/* Mid-wave event visuals */}
      {state.event && state.event.type === "airdrop" && (
        <View pointerEvents="none">
          <View
            style={{
              position: "absolute",
              left: state.event.pos.x - 22,
              top: state.event.pos.y - 22,
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2,
              borderColor: "#4FC3F7",
              backgroundColor: "rgba(79,195,247,0.18)",
            }}
          />
          <Text
            style={[
              styles.tankBadge,
              { position: "absolute", left: state.event.pos.x - 26, top: state.event.pos.y - 40, color: "#4FC3F7", borderColor: "#4FC3F7" },
            ]}
          >
            AIRDROP
          </Text>
          {state.event.progress > 0 && (
            <View
              style={{
                position: "absolute",
                left: state.event.pos.x - 22,
                top: state.event.pos.y + 26,
                width: 44,
                height: 4,
                backgroundColor: "rgba(79,195,247,0.2)",
              }}
            >
              <View style={{ width: `${state.event.progress * 100}%`, height: "100%", backgroundColor: "#4FC3F7" }} />
            </View>
          )}
        </View>
      )}
      {state.event && state.event.type === "hazard" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: state.event.pos.x - state.event.radius,
            top: state.event.pos.y - state.event.radius,
            width: state.event.radius * 2,
            height: state.event.radius * 2,
            borderRadius: state.event.radius,
            borderWidth: 2,
            borderColor: "#FF2A2A",
            backgroundColor: `rgba(255,42,42,${0.1 + ((Math.sin(Date.now() / 200) + 1) / 2) * 0.12})`,
          }}
        />
      )}
      {state.event && state.event.type === "crate" && (() => {
        const variant = state.event.variant ?? 0;
        const crateColor = variant === 0 ? "#F39C12" : variant === 1 ? "#00FFFF" : "#9B59B6";
        const crateLabel = variant === 0 ? "SCRAP" : variant === 1 ? "UPGRADE" : "TURRET";
        const cx = state.event.pos.x;
        const cy = state.event.pos.y;
        return (
          <View pointerEvents="none">
            {/* Outer glow */}
            <View style={{ position: "absolute", left: cx - 26, top: cy - 26, width: 52, height: 52, borderRadius: 8, backgroundColor: `${crateColor}18`, borderWidth: 1, borderColor: `${crateColor}40` }} />
            {/* Crate body */}
            <View style={{ position: "absolute", left: cx - 18, top: cy - 18, width: 36, height: 36, backgroundColor: "rgba(14,12,8,0.92)", borderWidth: 2.5, borderColor: crateColor, borderRadius: 4 }}>
              {/* Cross brace */}
              <View style={{ position: "absolute", left: 5, top: 16, right: 5, height: 2, backgroundColor: `${crateColor}70` }} />
              <View style={{ position: "absolute", top: 5, left: 16, bottom: 5, width: 2, backgroundColor: `${crateColor}70` }} />
            </View>
            {/* Label */}
            <Text style={[styles.tankBadge, { position: "absolute", left: cx - 28, top: cy - 36, color: crateColor, borderColor: crateColor, fontSize: 7 }]}>
              {crateLabel}
            </Text>
          </View>
        );
      })()}

      {/* Scavenge mode: high-value scrap crates spawned at wave start */}
      {scavengeCrates && scavengeCrates.map((crate: ScrapCrate) => {
        const pulse = (Math.sin(Date.now() / 420 + crate.id) + 1) / 2;
        const glowSize = 44 + pulse * 6;
        return (
          <View key={`sc-${crate.id}`} pointerEvents="none">
            {/* Glow halo */}
            <View
              style={{
                position: "absolute",
                left: crate.pos.x - glowSize / 2,
                top: crate.pos.y - glowSize / 2,
                width: glowSize,
                height: glowSize,
                borderRadius: glowSize / 2,
                backgroundColor: `rgba(243,156,18,${0.10 + pulse * 0.10})`,
              }}
            />
            {/* Crate box (procedural) */}
            <View
              style={{
                position: "absolute",
                left: crate.pos.x - 16,
                top: crate.pos.y - 16,
                width: 32,
                height: 32,
                borderWidth: 2.5,
                borderColor: "#F39C12",
                backgroundColor: "rgba(30,20,5,0.88)",
              }}
            >
              <View style={{ position: "absolute", left: 4, top: 14, right: 4, height: 2, backgroundColor: "rgba(243,156,18,0.55)" }} />
              <View style={{ position: "absolute", top: 4, left: 14, bottom: 4, width: 2, backgroundColor: "rgba(243,156,18,0.55)" }} />
            </View>
            {/* SCRAP label */}
            <Text
              style={[
                styles.tankBadge,
                {
                  position: "absolute",
                  left: crate.pos.x - 22,
                  top: crate.pos.y - 34,
                  color: "#F39C12",
                  borderColor: "#F39C12",
                  fontSize: 8,
                  paddingHorizontal: 3,
                  paddingVertical: 1,
                },
              ]}
            >
              SCRAP +{crate.value}
            </Text>
          </View>
        );
      })}

      {/* Bullets */}
      {bullets.map((b) => {
        const bulletColor =
          b.color ? b.color :
          b.weapon === "lrg" ? "#39FF14" :
          b.weapon === "laser" ? "#FF2A95" :
          b.weapon === "launcher" || b.weapon === "rpg" ? "#F39C12" :
          b.weapon === "shotgun" ? "#FFD37A" :
          "#FFEFA8";
        const baseSize = b.aoeRadius > 0 ? 9 : 6;
        if (b.color) {
          const coreSize = baseSize + 2;
          const glowSize = coreSize + 8;
          return (
            <View
              key={b.id}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: b.pos.x - glowSize / 2,
                top: b.pos.y - glowSize / 2,
                width: glowSize,
                height: glowSize,
                borderRadius: glowSize / 2,
                backgroundColor: bulletColor + "28",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: coreSize,
                  height: coreSize,
                  borderRadius: coreSize / 2,
                  backgroundColor: bulletColor,
                  ...(Platform.OS === "web"
                    ? ({ boxShadow: `0 0 7px 3px ${bulletColor}` } as object)
                    : {
                        shadowColor: bulletColor,
                        shadowRadius: 7,
                        shadowOpacity: 0.95,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 10,
                      }),
                }}
              />
            </View>
          );
        }
        return (
          <View
            key={b.id}
            style={[
              styles.bullet,
              {
                left: b.pos.x - 3,
                top: b.pos.y - 3,
                backgroundColor: bulletColor,
                width: baseSize,
                height: baseSize,
                borderRadius: b.aoeRadius > 0 ? 5 : 3,
              },
            ]}
          />
        );
      })}

      {/* Mines */}
      {state.mines.map((m) => (
        <View
          key={`mine-${m.id}`}
          style={{
            position: "absolute",
            left: m.pos.x - 9,
            top: m.pos.y - 9,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: m.armTime > 0 ? "rgba(255,42,42,0.4)" : "#FF2A2A",
            borderWidth: 2,
            borderColor: "#FF8800",
          }}
        />
      ))}

      {/* Grenades / Sticky */}
      {state.grenades.map((g) => (
        <View
          key={`gren-${g.id}`}
          style={{
            position: "absolute",
            left: g.pos.x - 6,
            top: g.pos.y - 6,
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: g.type === "sticky" ? "#FF8800" : "#39FF14",
            borderWidth: 1,
            borderColor: "#080808",
            opacity: Math.max(0.5, 0.5 + (g.fuse % 0.4) > 0.2 ? 1 : 0.5),
          }}
        />
      ))}

      {/* Turrets */}
      {state.turrets.map((t) => {
        const size = 48;
        const hpRatio = t.hp / t.maxHp;
        return (
          <View key={`tur-${t.id}`}>
            <Image
              source={TURRET_IMG}
              resizeMode="contain"
              style={{
                position: "absolute",
                left: t.pos.x - size / 2,
                top: t.pos.y - size / 2,
                width: size,
                height: size,
                transform: [{ rotate: `${t.facing + Math.PI / 2}rad` }],
              }}
            />
            {hpRatio < 1 && (
              <View
                style={{
                  position: "absolute",
                  left: t.pos.x - 14,
                  top: t.pos.y - size / 2 - 6,
                  width: 28, height: 3,
                  backgroundColor: "rgba(255,42,42,0.2)",
                }}
              >
                <View style={{ width: `${hpRatio * 100}%`, height: "100%", backgroundColor: "#00FFFF" }} />
              </View>
            )}
          </View>
        );
      })}

      {/* Explosions */}
      {state.explosions.map((e) => {
        const t = e.ttl / e.maxTtl;
        const expand = 1 - t;
        const sz = e.radius * 2 * (0.4 + expand * 0.8);
        return (
          <View
            key={`exp-${e.id}`}
            style={{
              position: "absolute",
              left: e.pos.x - sz / 2,
              top: e.pos.y - sz / 2,
              width: sz, height: sz, borderRadius: sz / 2,
              backgroundColor: e.color,
              opacity: t * 0.7,
            }}
          />
        );
      })}

      {/* Wall debug rectangles — rendered in world space */}
      {SHOW_WALL_DEBUG && debugEnabled && debugWalls.map((w, i) => (
        <View
          key={`dbgw-${i}`}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: w.x * arena.width,
            top: w.y * arena.height,
            width: w.w * arena.width,
            height: w.h * arena.height,
            backgroundColor: i === selectedIdx ? "rgba(0,255,0,0.25)" : "rgba(255,0,0,0.25)",
            borderWidth: 2,
            borderColor: i === selectedIdx ? "lime" : "red",
          }}
        >
          <Text style={{ color: "white", fontSize: 10, fontFamily: "Courier", lineHeight: 12 }}>#{i}</Text>
        </View>
      ))}

      {/* Player uniform outer glow ring (second, wider ring) */}
      {!isStandard && uv.outerRingSize && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: player.pos.x - (HERO_SIZE * uv.outerRingSize) / 2,
            top: player.pos.y - (HERO_SIZE * uv.outerRingSize) / 2,
            width: HERO_SIZE * uv.outerRingSize,
            height: HERO_SIZE * uv.outerRingSize,
            borderRadius: (HERO_SIZE * uv.outerRingSize) / 2,
            borderWidth: 1,
            borderColor: uv.outerRingColor ?? tintColor,
            backgroundColor: `${uv.outerRingColor ?? tintColor}${Math.round((uv.outerRingOpacity ?? 0) * 255).toString(16).padStart(2, "0")}`,
          }}
        />
      )}

      {/* Player status auras (dash i-frames / overdrive) */}
      {(player.invuln > 0 || player.overdrive > 0) && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: player.pos.x - HERO_SIZE * 0.75,
            top: player.pos.y - HERO_SIZE * 0.75,
            width: HERO_SIZE * 1.5,
            height: HERO_SIZE * 1.5,
            borderRadius: HERO_SIZE * 0.75,
            borderWidth: 2,
            borderColor: player.invuln > 0 ? "#00FFFF" : "#FF2A95",
            backgroundColor:
              player.invuln > 0 ? "rgba(0,255,255,0.12)" : "rgba(255,42,149,0.12)",
          }}
        />
      )}

      {/* Player hero sprite */}
      <View
        style={{
          position: "absolute",
          left: player.pos.x - HERO_SIZE / 2,
          top: player.pos.y - HERO_SIZE / 2,
          width: HERO_SIZE,
          height: HERO_SIZE,
          transform: [{ rotate: `${player.facing}rad` }],
        }}
      >
        <Image
          source={HERO_IMG}
          resizeMode="contain"
          style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
        />
        {/* Uniform tint overlay */}
        {!isStandard && uv.tintOpacity > 0 && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: tintColor,
                opacity: uv.tintOpacity,
                borderRadius: HERO_SIZE / 2,
              },
            ]}
          />
        )}
        {/* Uniform inner ring */}
        {!isStandard && uv.ringSize > 0 && (
          <View
            style={{
              position: "absolute",
              left: -(HERO_SIZE * (uv.ringSize - 1)) / 2,
              top: -(HERO_SIZE * (uv.ringSize - 1)) / 2,
              width: HERO_SIZE * uv.ringSize,
              height: HERO_SIZE * uv.ringSize,
              borderRadius: (HERO_SIZE * uv.ringSize) / 2,
              borderWidth: uv.ringBorderWidth,
              borderColor: uv.ringBorderColor,
              backgroundColor: `${tintColor}${Math.round(uv.ringBgOpacity * 255).toString(16).padStart(2, "0")}`,
            }}
          />
        )}
        {/* Damage flash */}
        {player.damageFlash > 0 && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "#FF2A2A", opacity: 0.45, borderRadius: HERO_SIZE / 2 },
            ]}
          />
        )}
      </View>

      {/* Particles */}
      {particles.map((p) => (
        <View
          key={p.id}
          style={{
            position: "absolute",
            left: p.pos.x - p.size / 2,
            top: p.pos.y - p.size / 2,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: Math.max(0, p.ttl / p.maxTtl),
          }}
        />
      ))}

      {/* Floating text flyouts — crate pickup "+N" labels */}
      {floatingTexts && floatingTexts.map((ft: FloatingText) => {
        const ratio = Math.max(0, ft.ttl / ft.maxTtl);
        return (
          <Text
            key={ft.id}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: ft.pos.x - 28,
              top: ft.pos.y,
              width: 56,
              textAlign: "center",
              color: "#F39C12",
              fontSize: 13,
              fontWeight: "900",
              fontFamily: "Courier",
              letterSpacing: 1,
              opacity: ratio,
            }}
          >
            {ft.text}
          </Text>
        );
      })}

      {/* Story objective world markers */}
      {state.gameMode === "story" && state.storyObjective && (() => {
        const obj: StoryObjective = state.storyObjective;
        if (obj.type === "escape") {
          const pulse2 = (Math.sin(Date.now() / 600) + 1) / 2;
          const blink = (Math.sin(Date.now() / 300) + 1) / 2;
          const r = 30 + pulse2 * 5;
          return (
            <View key="extraction" pointerEvents="none">
              {/* Outer beacon glow */}
              <View style={{ position: "absolute", left: obj.extractionPos.x - r - 10 - pulse2 * 6, top: obj.extractionPos.y - r - 10 - pulse2 * 6, width: (r + 10 + pulse2 * 6) * 2, height: (r + 10 + pulse2 * 6) * 2, borderRadius: r + 10 + pulse2 * 6, backgroundColor: `rgba(39,174,96,${0.06 + pulse2 * 0.06})` }} />
              {/* Main extraction zone ring */}
              <View style={{ position: "absolute", left: obj.extractionPos.x - r, top: obj.extractionPos.y - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: 3, borderColor: `rgba(39,174,96,${0.6 + blink * 0.4})`, backgroundColor: `rgba(39,174,96,${0.08 + pulse2 * 0.09})`, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: `rgba(39,174,96,${0.7 + blink * 0.3})`, fontSize: 8, fontWeight: "900", fontFamily: "Courier", letterSpacing: 1 }}>EXIT</Text>
              </View>
            </View>
          );
        }
        if (obj.type === "hold") {
          const pulse2 = (Math.sin(Date.now() / 800) + 1) / 2;
          const r = obj.zoneRadius;
          const dx = player.pos.x - obj.zoneCenter.x;
          const dy = player.pos.y - obj.zoneCenter.y;
          const playerInZone = Math.sqrt(dx * dx + dy * dy) <= r;
          const fillAlpha = playerInZone ? 0.08 + pulse2 * 0.10 : 0.02;
          const done = obj.timeLeft <= 0;
          const secsLeft = Math.ceil(obj.timeLeft);
          const timerColor = done
            ? "#27AE60"
            : obj.timeLeft <= 10
            ? `rgba(255,${42 + Math.round(pulse2 * 30)},42,${0.85 + pulse2 * 0.15})`
            : obj.timeLeft <= 30
            ? "#F39C12"
            : "#00FFFF";
          const ringColor = done ? "#27AE60" : "0,255,255";
          return (
            <View key="holdzone" pointerEvents="none">
              {/* Outer glow ring */}
              <View style={{ position: "absolute", left: obj.zoneCenter.x - r - 6, top: obj.zoneCenter.y - r - 6, width: (r + 6) * 2, height: (r + 6) * 2, borderRadius: r + 6, borderWidth: 1, borderColor: done ? "rgba(39,174,96,0.4)" : `rgba(0,255,255,${0.15 + pulse2 * 0.10})`, backgroundColor: "transparent" }} />
              {/* Main zone ring */}
              <View style={{ position: "absolute", left: obj.zoneCenter.x - r, top: obj.zoneCenter.y - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: 2, borderColor: done ? `rgba(39,174,96,${0.6 + pulse2 * 0.4})` : `rgba(${ringColor},${0.55 + pulse2 * 0.40})`, backgroundColor: done ? `rgba(39,174,96,${0.06 + pulse2 * 0.08})` : `rgba(0,255,255,${fillAlpha})` }}>
                {/* Timer centered inside zone */}
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: `rgba(0,255,255,${0.28 + pulse2 * 0.18})`, fontSize: 8, fontWeight: "900", fontFamily: "Courier", letterSpacing: 2, marginBottom: 2 }}>HOLD</Text>
                  <Text style={{ color: timerColor, fontSize: done ? 13 : 16, fontWeight: "900", fontFamily: "Courier", textShadowColor: timerColor, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }}>
                    {done ? "✓" : `${secsLeft}s`}
                  </Text>
                </View>
              </View>
            </View>
          );
        }
        if (obj.type === "escort") {
          const r = 18;
          const hpRatio = obj.npcMaxHp > 0 ? Math.max(0, obj.npcHp / obj.npcMaxHp) : 0;
          const npcColor = hpRatio > 0.5 ? "#27AE60" : hpRatio > 0.25 ? "#F39C12" : "#FF2A2A";
          return (
            <View key="escort-npc">
              <View style={{ position: "absolute", left: obj.npcPos.x - r, top: obj.npcPos.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: "#1A3A1A", borderWidth: 2, borderColor: npcColor, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: npcColor, fontSize: 9, fontWeight: "900", fontFamily: "Courier" }}>VIP</Text>
              </View>
              <View style={{ position: "absolute", left: obj.npcPos.x - 20, top: obj.npcPos.y - r - 8, width: 40, height: 4, backgroundColor: "rgba(255,42,42,0.3)", borderRadius: 2 }}>
                <View style={{ width: `${hpRatio * 100}%`, height: "100%", backgroundColor: npcColor, borderRadius: 2 }} />
              </View>
            </View>
          );
        }
        if (obj.type === "sabotage") {
          return (
            <>
              {obj.spawners.map((sp, i) => {
                if (sp.destroyed) return null;
                const pulse2 = (Math.sin(Date.now() / 500 + i) + 1) / 2;
                const hasProgress = sp.interactProgress > 0;
                const prog = Math.max(0, Math.min(1, sp.interactProgress));
                const MARKER = 16;
                return (
                  <View key={`sp-${i}`}>
                    {/* Outer pulse ring */}
                    <View style={{ position: "absolute", left: sp.pos.x - MARKER - 6 - pulse2 * 4, top: sp.pos.y - MARKER - 6 - pulse2 * 4, width: (MARKER + 6 + pulse2 * 4) * 2, height: (MARKER + 6 + pulse2 * 4) * 2, borderRadius: MARKER + 6 + pulse2 * 4, borderWidth: 1, borderColor: `rgba(255,42,42,${0.3 + pulse2 * 0.3})`, backgroundColor: "transparent" }} />
                    {/* Main spawner marker */}
                    <View style={{ position: "absolute", left: sp.pos.x - MARKER, top: sp.pos.y - MARKER, width: MARKER * 2, height: MARKER * 2, backgroundColor: `rgba(180,0,0,${0.55 + pulse2 * 0.3})`, borderWidth: 2, borderColor: "#FF2A2A", borderRadius: MARKER, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#FF2A2A", fontSize: 7, fontWeight: "900", fontFamily: "Courier", letterSpacing: 0.5 }}>SPAWN</Text>
                    </View>
                    {/* Progress bar — only visible when player is actively interacting */}
                    {hasProgress && (
                      <View style={{ position: "absolute", left: sp.pos.x - MARKER, top: sp.pos.y + MARKER + 4, width: MARKER * 2, height: 4, backgroundColor: "rgba(255,42,42,0.25)", borderRadius: 2 }}>
                        <View style={{ width: `${prog * 100}%`, height: "100%", backgroundColor: "#FF6600", borderRadius: 2 }} />
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          );
        }
        return null;
      })()}
      </View>
      {/* Vignette — screen-fixed, doesn't move with the camera */}
      <View style={styles.vignette} pointerEvents="none" />

      {/* Extraction point off-screen edge indicator — screen-space, on top of vignette */}
      {state.gameMode === "story" && state.storyObjective?.type === "escape" && !state.storyObjective.reached && (() => {
        const obj = state.storyObjective;
        const EDGE_PAD = 28;
        const cx = viewport.width / 2;
        const cy = viewport.height / 2;
        const clampW = cx - EDGE_PAD;
        const clampH = cy - EDGE_PAD;

        const sx = worldLeft + obj.extractionPos.x;
        const sy = worldTop + obj.extractionPos.y;

        const VISIBLE_MARGIN = 40;
        if (
          sx >= VISIBLE_MARGIN &&
          sx <= viewport.width - VISIBLE_MARGIN &&
          sy >= VISIBLE_MARGIN &&
          sy <= viewport.height - VISIBLE_MARGIN
        ) {
          return null;
        }

        const dx = sx - cx;
        const dy = sy - cy;
        const angle = Math.atan2(dy, dx);
        const tx = Math.cos(angle);
        const ty = Math.sin(angle);
        const scaleX = Math.abs(tx) > 0.001 ? clampW / Math.abs(tx) : Infinity;
        const scaleY = Math.abs(ty) > 0.001 ? clampH / Math.abs(ty) : Infinity;
        const sEdge = Math.min(scaleX, scaleY);
        const edgeX = cx + tx * sEdge;
        const edgeY = cy + ty * sEdge;
        const angleDeg = angle * (180 / Math.PI);
        const blink = (Math.sin(Date.now() / 300) + 1) / 2;

        const ICON = 20;
        return (
          <View
            key="exit-indicator"
            pointerEvents="none"
            style={{
              position: "absolute",
              left: edgeX - ICON,
              top: edgeY - ICON,
              width: ICON * 2,
              height: ICON * 2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                position: "absolute",
                width: ICON * 2,
                height: ICON * 2,
                borderRadius: ICON,
                backgroundColor: `rgba(39,174,96,${0.16 + blink * 0.1})`,
                borderWidth: 1,
                borderColor: "rgba(39,174,96,0.6)",
              }}
            />
            <View
              style={{
                transform: [{ rotate: `${angleDeg}deg` }],
                width: 0,
                height: 0,
                borderTopWidth: 8,
                borderBottomWidth: 8,
                borderLeftWidth: 15,
                borderTopColor: "transparent",
                borderBottomColor: "transparent",
                borderLeftColor: "#27AE60",
              }}
            />
            <Text
              style={{
                position: "absolute",
                top: ICON * 2 - 1,
                color: "#27AE60",
                fontSize: 8,
                fontWeight: "900",
                fontFamily: "Courier",
                backgroundColor: "rgba(8,8,8,0.70)",
                paddingHorizontal: 2,
              }}
            >
              EXIT
            </Text>
          </View>
        );
      })()}

      {/* Scavenge crate off-screen edge indicators — screen-space, on top of vignette */}
      {scavengeCrates && scavengeCrates.some(c => !c.claimed) && (() => {
        const EDGE_PAD = 28;
        const cx = viewport.width / 2;
        const cy = viewport.height / 2;
        const clampW = cx - EDGE_PAD;
        const clampH = cy - EDGE_PAD;

        return scavengeCrates
          .filter(c => !c.claimed)
          .map(crate => {
            // World → screen
            const sx = worldLeft + crate.pos.x;
            const sy = worldTop + crate.pos.y;

            // Margin: if the crate box is fully within viewport, skip
            const VISIBLE_MARGIN = 40;
            if (
              sx >= VISIBLE_MARGIN &&
              sx <= viewport.width - VISIBLE_MARGIN &&
              sy >= VISIBLE_MARGIN &&
              sy <= viewport.height - VISIBLE_MARGIN
            ) {
              return null;
            }

            // Direction from screen centre to crate
            const dx = sx - cx;
            const dy = sy - cy;
            const angle = Math.atan2(dy, dx);
            const tx = Math.cos(angle);
            const ty = Math.sin(angle);

            // Clamp to edge rectangle
            const scaleX = Math.abs(tx) > 0.001 ? clampW / Math.abs(tx) : Infinity;
            const scaleY = Math.abs(ty) > 0.001 ? clampH / Math.abs(ty) : Infinity;
            const s = Math.min(scaleX, scaleY);
            const edgeX = cx + tx * s;
            const edgeY = cy + ty * s;
            const angleDeg = angle * (180 / Math.PI);

            const ICON = 18; // half-size of the indicator container

            return (
              <View
                key={`ci-${crate.id}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: edgeX - ICON,
                  top: edgeY - ICON,
                  width: ICON * 2,
                  height: ICON * 2,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Glow circle behind arrow */}
                <View
                  style={{
                    position: "absolute",
                    width: ICON * 2,
                    height: ICON * 2,
                    borderRadius: ICON,
                    backgroundColor: "rgba(243,156,18,0.18)",
                    borderWidth: 1,
                    borderColor: "rgba(243,156,18,0.45)",
                  }}
                />
                {/* Arrow triangle — points in direction of crate */}
                <View
                  style={{
                    transform: [{ rotate: `${angleDeg}deg` }],
                    width: 0,
                    height: 0,
                    borderTopWidth: 7,
                    borderBottomWidth: 7,
                    borderLeftWidth: 13,
                    borderTopColor: "transparent",
                    borderBottomColor: "transparent",
                    borderLeftColor: "#F39C12",
                  }}
                />
                {/* Value label below the indicator */}
                <Text
                  style={{
                    position: "absolute",
                    top: ICON * 2 - 1,
                    color: "#F39C12",
                    fontSize: 8,
                    fontWeight: "900",
                    fontFamily: "Courier",
                    backgroundColor: "rgba(8,8,8,0.70)",
                    paddingHorizontal: 2,
                  }}
                >
                  +{crate.value}
                </Text>
              </View>
            );
          });
      })()}

      {/* === WALL DEBUG: interceptor wraps controls so Pressables (deeper) win the responder === */}
      {SHOW_WALL_DEBUG && debugEnabled && (
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            const px = e.nativeEvent.locationX;
            const py = e.nativeEvent.locationY;
            const touchWorldX = px - worldLeft;
            const touchWorldY = py - worldTop;
            let found = -1;
            for (let i = debugWalls.length - 1; i >= 0; i--) {
              const dw = debugWalls[i];
              if (
                touchWorldX >= dw.x * arena.width &&
                touchWorldX <= (dw.x + dw.w) * arena.width &&
                touchWorldY >= dw.y * arena.height &&
                touchWorldY <= (dw.y + dw.h) * arena.height
              ) { found = i; break; }
            }
            if (found >= 0) {
              setSelectedIdx(found);
              dragRef.current = { startNormX: debugWalls[found].x, startNormY: debugWalls[found].y, startPX: px, startPY: py };
            } else {
              setSelectedIdx(null);
              dragRef.current = null;
            }
          }}
          onResponderMove={(e) => {
            if (selectedIdx === null || !dragRef.current) return;
            const px = e.nativeEvent.locationX;
            const py = e.nativeEvent.locationY;
            const dx = (px - dragRef.current.startPX) / arena.width;
            const dy = (py - dragRef.current.startPY) / arena.height;
            setDebugWalls((prev) =>
              prev.map((dw, i) =>
                i === selectedIdx
                  ? {
                      ...dw,
                      x: Math.max(0, Math.min(0.99 - dw.w, dragRef.current!.startNormX + dx)),
                      y: Math.max(0, Math.min(0.99 - dw.h, dragRef.current!.startNormY + dy)),
                    }
                  : dw
              )
            );
          }}
          onResponderRelease={() => { dragRef.current = null; }}
        >
          {/* Controls panel nested inside interceptor — Pressables are children so they win */}
          <View
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.88)", padding: 8 }}
            pointerEvents="box-none"
          >
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }} pointerEvents="box-none">
              {["W-", "W+", "H-", "H+"].map((label, li) => {
                const deltas: [number, number][] = [[-0.01, 0], [0.01, 0], [0, -0.01], [0, 0.01]];
                return (
                  <Pressable
                    key={label}
                    onPress={() => { const [dw, dh] = deltas[li]; adjustWall(dw, dh); }}
                    style={{ backgroundColor: "#333", borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#666" }}
                  >
                    <Text style={{ color: "white", fontSize: 13, fontFamily: "Courier" }}>{label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  const newIdx = debugWalls.length;
                  setDebugWalls((prev) => [...prev, { x: 0.4, y: 0.4, w: 0.1, h: 0.1 }]);
                  setSelectedIdx(newIdx);
                }}
                style={{ backgroundColor: "#1a4a1a", borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#2a8a2a" }}
              >
                <Text style={{ color: "#0f0", fontSize: 13, fontFamily: "Courier" }}>+ADD</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              <Text style={{ color: "#0f0", fontSize: 9, fontFamily: "Courier" }}>
                {selectedIdx !== null
                  ? `Selected: #${selectedIdx}  x:${debugWalls[selectedIdx]?.x.toFixed(3)} y:${debugWalls[selectedIdx]?.y.toFixed(3)} w:${debugWalls[selectedIdx]?.w.toFixed(3)} h:${debugWalls[selectedIdx]?.h.toFixed(3)}\n\n`
                  : "Tap a red box to select. Drag to move.\n\n"}
                {`// Copy into RIGDEF_WALL_CELLS:\n[\n${debugWalls
                  .map((dw) => `  [${dw.x.toFixed(3)}, ${dw.y.toFixed(3)}, ${dw.w.toFixed(3)}, ${dw.h.toFixed(3)}],`)
                  .join("\n")}\n]`}
              </Text>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Debug toggle button — game loop pauses when active */}
      {SHOW_WALL_DEBUG && (
        <Pressable
          onPress={() => {
            const next = !debugEnabled;
            setDebugEnabled(next);
            onDebugChange?.(next);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: debugEnabled ? "lime" : "rgba(0,0,0,0.6)",
            borderRadius: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: debugEnabled ? "lime" : "#555",
          }}
        >
          <Text style={{ color: debugEnabled ? "black" : "white", fontSize: 11, fontFamily: "Courier" }}>
            WALLS
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    backgroundColor: "#080808",
    overflow: "hidden",
  },
  arena: {
    position: "absolute",
    backgroundColor: "#080808",
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,8,0.35)",
  },
  rigShield: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
  },
  rigHpBar: {
    position: "absolute",
    height: 4,
    backgroundColor: "rgba(255,42,42,0.25)",
    borderWidth: 1,
    borderColor: "#333",
  },
  rigHpFill: {
    height: "100%",
  },
  zHp: {
    position: "absolute",
    height: 3,
    backgroundColor: "rgba(255,42,42,0.25)",
  },
  zHpFill: {
    height: "100%",
    backgroundColor: "#FF2A2A",
  },
  bullet: {
    position: "absolute",
    width: 6,
    height: 6,
    backgroundColor: "#FFEFA8",
    borderRadius: 3,
  },
  scrap: {
    position: "absolute",
    width: 10,
    height: 10,
    backgroundColor: "#F39C12",
    borderWidth: 1,
    borderColor: "#7a4500",
    transform: [{ rotate: "45deg" }],
  },
  tankLabel: {
    color: "#FF6633",
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "Courier",
  },
  tankBadge: {
    color: "#FF2A2A",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: "Courier",
    backgroundColor: "rgba(8,8,8,0.7)",
    paddingHorizontal: 2,
  },
});

export default Arena;
