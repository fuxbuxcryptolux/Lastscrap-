import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, PanResponder } from "react-native";
import ModsPanel from "./ModsPanel";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  MaterialIcons,
} from "@expo/vector-icons";
import { UNIFORMS } from "../game/uniforms";
import {
  GameState,
  UPGRADE_META,
  abilityStats,
  abilityUpgradeCost,
  applyUpgrade,
  buyThrowable,
  buyTurret,
  buyWeapon,
  equipAbility,
  equipWeapon,
  repair,
  unlockAbility,
  upgradeAbility,
  upgradeCost,
  upgradeValue,
  upgradeTurretStat,
  effectiveUpgradeCost,
  weaponCost,
  throwableCost,
  turretPurchaseCost,
} from "../game/engine";
import { uniformBonuses } from "../game/uniforms";
import { UPGRADE_KEYS, Upgrades } from "../game/types";
import {
  ABILITIES,
  ABILITY_ORDER,
  THROWABLE_ORDER,
  THROWABLES,
  TURRET_MAX_LEVEL,
  TURRET_PURCHASE_COST,
  TURRET_PURCHASE_WAVE,
  TURRET_UPGRADE_COSTS,
  TurretStatKey,
  WEAPON_ORDER,
  WEAPONS,
  turretDamageForLevel,
  turretFireRateForLevel,
  turretHpForLevel,
  turretMagnetizerRange,
} from "../game/weapons";

type Props = {
  state: GameState;
  onDeploy: () => void;
  onSave: () => void;
  forceTick: () => void;
};

type Tab = "upgrades" | "arsenal" | "mods" | "bounties";

function IconFor({ family, name, color, size = 22 }: any) {
  if (family === "Ionicons") return <Ionicons name={name} size={size} color={color} />;
  if (family === "MaterialCommunityIcons")
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  if (family === "FontAwesome5") return <FontAwesome5 name={name} size={size} color={color} />;
  if (family === "MaterialIcons") return <MaterialIcons name={name} size={size} color={color} />;
  return null;
}

function formatValue(key: keyof Upgrades, v: number) {
  if (key === "armor") return `${Math.round(v * 100)}%`;
  if (key === "ammoRegen") return `${v.toFixed(2)}×`;
  if (key === "ammoCap") return `+${Math.round(v)} rds`;
  if (key === "moveSpeed") return `${Math.round(v)}u/s`;
  if (key === "pickupRadius") return `${Math.round(v)}px`;
  if (key === "attack") return `${v.toFixed(2)}× dmg`;
  return Math.round(v).toString();
}

export default function UpgradeShop({ state, onDeploy, onSave, forceTick }: Props) {
  const [tab, setTab] = useState<Tab>("upgrades");

  return (
    <View style={styles.overlay} testID="upgrade-shop">
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.headerTag}>[ SYSTEM ]</Text>
          <Text style={styles.headerTitle}>UPGRADE TERMINAL</Text>
          <View style={styles.headerRow}>
            <Text style={styles.headerSub}>
              WAVE {state.wave.toString().padStart(2, "0")} CLEARED
            </Text>
            <View style={styles.scrapPill}>
              <MaterialCommunityIcons name="nut" size={14} color="#F39C12" />
              <Text style={styles.scrapPillText} testID="shop-scrap-count">
                {state.scrap}
              </Text>
            </View>
          </View>
          {state.equippedUniform && state.equippedUniform !== "standard" && (() => {
            const ud = UNIFORMS[state.equippedUniform];
            return (
              <View style={[styles.uniformBadge, { borderColor: ud.color + "55" }]}>
                <MaterialCommunityIcons name="tshirt-crew" size={11} color={ud.color} />
                <Text style={[styles.uniformBadgeText, { color: ud.color }]}>{ud.name}</Text>
              </View>
            );
          })()}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            testID="tab-upgrades"
            style={[styles.tab, tab === "upgrades" && styles.tabActive]}
            onPress={() => setTab("upgrades")}
          >
            <Text style={[styles.tabText, tab === "upgrades" && styles.tabTextActive]}>
              UPGRADES
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-arsenal"
            style={[styles.tab, tab === "arsenal" && styles.tabActive]}
            onPress={() => setTab("arsenal")}
          >
            <Text style={[styles.tabText, tab === "arsenal" && styles.tabTextActive]}>
              ARSENAL
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-mods"
            style={[styles.tab, tab === "mods" && styles.tabActive]}
            onPress={() => setTab("mods")}
          >
            <Text style={[styles.tabText, tab === "mods" && styles.tabTextActive]}>
              MODS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-bounties"
            style={[styles.tab, tab === "bounties" && styles.tabActive]}
            onPress={() => setTab("bounties")}
          >
            <Text style={[styles.tabText, tab === "bounties" && styles.tabTextActive]}>
              BOUNTIES
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 6 }}>
          {tab === "upgrades" && (
            <UpgradesPanel state={state} forceTick={forceTick} />
          )}
          {tab === "arsenal" && (
            <ArsenalPanel state={state} forceTick={forceTick} />
          )}
          {tab === "mods" && (
            <ModsPanel state={state} forceTick={forceTick} />
          )}
          {tab === "bounties" && (
            <BountiesPanel state={state} />
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.repairBtn}
          testID="repair-btn"
          activeOpacity={0.8}
          onPress={() => {
            repair(state);
            forceTick();
          }}
        >
          <FontAwesome5 name="wrench" size={14} color="#39FF14" />
          <Text style={styles.repairText}>FIELD REPAIR · FREE</Text>
        </TouchableOpacity>

        {/* Ability picker — swap equipped ability between waves */}
        <AbilityPicker state={state} forceTick={forceTick} />

        {/* Manual save */}
        <TouchableOpacity
          testID="shop-save-btn"
          style={styles.saveBtn}
          activeOpacity={0.8}
          onPress={onSave}
        >
          <Ionicons name="save-outline" size={14} color="#27AE60" />
          <Text style={styles.saveBtnText}>SAVE GAME</Text>
        </TouchableOpacity>

        {/* Hold-to-deploy — prevents accidental fire-button bounce */}
        <HoldToDeployButton wave={state.wave + 1} onDeploy={onDeploy} />
      </View>
    </View>
  );
}

// Hold-to-deploy: player must hold for 1s to confirm, preventing accidental taps.
// Uses PanResponder so the hold isn't cancelled by slight pointer drift (unlike TouchableOpacity).
const HOLD_MS = 900;
function HoldToDeployButton({ wave, onDeploy }: { wave: number; onDeploy: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const deployedRef = useRef(false);

  const startHold = () => {
    deployedRef.current = false;
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1, duration: HOLD_MS, useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished && !deployedRef.current) {
        deployedRef.current = true;
        onDeploy();
      }
    });
  };

  const cancelHold = () => {
    animRef.current?.stop();
    animRef.current = null;
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: startHold,
      onPanResponderRelease: cancelHold,
      onPanResponderTerminate: cancelHold,
    })
  ).current;

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View
      testID="deploy-btn"
      style={styles.deployBtn}
      {...pan.panHandlers}
    >
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#E67E22", width: fillWidth }]}
      />
      <Text style={styles.deployText}>HOLD TO DEPLOY · WAVE {wave}</Text>
      <Ionicons name="arrow-forward" size={18} color="#080808" />
    </View>
  );
}

// Ability picker shown between waves — tap any unlocked ability to equip it.
function AbilityPicker({ state, forceTick }: { state: GameState; forceTick: () => void }) {
  const unlocked = ABILITY_ORDER.filter(id => state.abilities[id].level > 0);
  if (unlocked.length === 0) return null;

  return (
    <View style={styles.abilityPicker}>
      <Text style={styles.abilityPickerLabel}>EQUIPPED ABILITY</Text>
      <View style={styles.abilityPickerRow}>
        {unlocked.map(id => {
          const def = ABILITIES[id];
          const equipped = state.equippedAbility === id;
          const st = abilityStats(id, state.abilities[id].level);
          return (
            <TouchableOpacity
              key={id}
              style={[styles.abilityChip, equipped && styles.abilityChipActive, { borderColor: def.color }]}
              activeOpacity={0.7}
              onPress={() => { equipAbility(state, id); forceTick(); }}
            >
              <MaterialCommunityIcons name={def.icon as any} size={20} color={equipped ? def.color : "#555"} />
              <Text style={[styles.abilityChipText, { color: equipped ? def.color : "#666" }]}>{def.short}</Text>
              {equipped && (
                <Text style={[styles.abilityChipCd, { color: def.color }]}>{st.cooldown.toFixed(0)}s CD</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function UpgradesPanel({
  state,
  forceTick,
}: {
  state: GameState;
  forceTick: () => void;
}) {
  return (
    <>
      {UPGRADE_KEYS.map((key) => {
        const meta = UPGRADE_META[key];
        const lvl = state.upgrades[key];
        const cost = effectiveUpgradeCost(state, key);
        const next = upgradeValue(key, lvl + 1);
        const cur = upgradeValue(key, lvl);
        const canAfford = state.scrap >= cost;
        return (
          <TouchableOpacity
            key={key}
            testID={`upgrade-${key}`}
            style={[styles.card, !canAfford && styles.cardDisabled]}
            onPress={() => {
              if (applyUpgrade(state, key)) forceTick();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.cardIcon}>
              <IconFor {...meta.icon} color={meta.color} size={24} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardLabel}>{meta.label}</Text>
                <Text style={styles.cardLevel}>LV {lvl}</Text>
              </View>
              <Text style={styles.cardSub}>{meta.sub}</Text>
              <Text style={styles.cardDelta}>
                {formatValue(key, cur)} → {formatValue(key, next)}
              </Text>
            </View>
            <Cost cost={cost} canAfford={canAfford} />
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function ArsenalPanel({
  state,
  forceTick,
}: {
  state: GameState;
  forceTick: () => void;
}) {
  return (
    <>
      <SectionLabel text="WEAPONS" />
      {WEAPON_ORDER.map((id) => {
        const w = WEAPONS[id];
        const owned = state.ownedWeapons.includes(id);
        const equipped = state.equippedWeapon === id;
        const ub = uniformBonuses(state.equippedUniform);
        const waveUnlocked = state.stats.wavesCleared >= w.unlockWave
          || (ub.arUnlocked && id === "ar")
          || (ub.gatlingUnlocked && id === "gatling");
        const locked = !waveUnlocked || (ub.zombieMode && id !== "pistol");
        const cost = weaponCost(state, id);
        const canAfford = state.scrap >= cost;
        return (
          <TouchableOpacity
            key={id}
            testID={`weapon-${id}`}
            disabled={locked}
            style={[
              styles.card,
              locked && styles.cardDisabled,
              equipped && styles.cardEquipped,
            ]}
            activeOpacity={0.7}
            onPress={() => {
              if (locked) return;
              if (!owned) {
                if (buyWeapon(state, id)) {
                  equipWeapon(state, id);
                  forceTick();
                }
              } else if (!equipped) {
                equipWeapon(state, id);
                forceTick();
              }
            }}
          >
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons name="pistol" size={22} color="#EAEAEA" />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardLabel}>{w.name}</Text>
                {equipped && <Text style={styles.equippedTag}>EQUIPPED</Text>}
                {!equipped && owned && <Text style={styles.ownedTag}>OWNED</Text>}
                {locked && !ub.zombieMode && <Text style={styles.lockTag}>WAVE {w.unlockWave}</Text>}
                {locked && ub.zombieMode && <Text style={styles.lockTag}>LOCKED</Text>}
              </View>
              <Text style={styles.cardSub}>{w.description}</Text>
              <Text style={styles.cardStats}>
                {w.damage} dmg · mag {w.magSize}
                {w.pellets > 1 ? ` · ×${w.pellets} pellets` : ""}
                {w.pierce > 0 ? ` · pierce ${w.pierce}` : ""}
                {w.aoeRadius > 0 ? ` · AoE ${w.aoeRadius}px` : ""}
              </Text>
            </View>
            {!owned && <Cost cost={cost} canAfford={canAfford && !locked} />}
            {owned && !equipped && (
              <View style={styles.cardCost}>
                <Text style={styles.equipText}>EQUIP</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <SectionLabel text="THROWABLES" />
      {THROWABLE_ORDER.map((id) => {
        const t = THROWABLES[id];
        const ub = uniformBonuses(state.equippedUniform);
        const locked = !ub.grenadesUnlocked && state.stats.wavesCleared < t.unlockWave;
        const cost = throwableCost(state, id, 1);
        const canAfford = state.scrap >= cost;
        const count = state.throwables[id];
        return (
          <TouchableOpacity
            key={id}
            testID={`throwable-${id}`}
            disabled={locked}
            style={[styles.card, locked && styles.cardDisabled]}
            activeOpacity={0.7}
            onPress={() => {
              if (buyThrowable(state, id, 1)) forceTick();
            }}
          >
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons
                name={(id === "mine" ? "land-mines" : "grenade") as any}
                size={22}
                color="#FF8800"
              />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardLabel}>{t.name}</Text>
                <Text style={styles.cardLevel}>×{count}</Text>
                {locked && <Text style={styles.lockTag}>WAVE {t.unlockWave}</Text>}
              </View>
              <Text style={styles.cardSub}>{t.description}</Text>
              <Text style={styles.cardStats}>
                {t.damage} dmg · {t.radius}px AoE
              </Text>
            </View>
            <Cost cost={cost} canAfford={canAfford && !locked} />
          </TouchableOpacity>
        );
      })}

      <TurretSection state={state} forceTick={forceTick} />

      <AbilitiesSection state={state} forceTick={forceTick} />
    </>
  );
}

function BountiesPanel({ state }: { state: GameState }) {
  const bounties = state.activeBounties ?? [];
  const completed = bounties.filter((b) => b.state === "completed");
  const failed = bounties.filter((b) => b.state === "failed");
  const totalReward = completed.reduce((acc, b) => acc + b.reward, 0);

  return (
    <>
      <SectionLabel text={`BOUNTIES · ${completed.length}/${bounties.length} COMPLETE`} />
      {totalReward > 0 && (
        <View style={bShopStyles.rewardSummary}>
          <MaterialCommunityIcons name="trophy" size={12} color="#F39C12" />
          <Text style={bShopStyles.rewardSummaryText}>+{totalReward} scrap earned from bounties</Text>
        </View>
      )}
      {bounties.map((b) => {
        const isComplete = b.state === "completed";
        const isFailed = b.state === "failed";
        const ratio = b.target > 0 ? Math.min(1, b.progress / b.target) : 0;
        const barColor = isComplete ? "#39FF14" : isFailed ? "#FF2A2A" : "#F39C12";
        const cardBg = isComplete
          ? "rgba(57,255,20,0.07)"
          : isFailed
          ? "rgba(255,42,42,0.05)"
          : "rgba(243,156,18,0.05)";
        const borderColor = isComplete ? "#39FF14" : isFailed ? "#333" : "#555";
        return (
          <View key={b.templateId} style={[bShopStyles.card, { backgroundColor: cardBg, borderColor }]}>
            <View style={bShopStyles.cardHeader}>
              <View style={bShopStyles.statusPill}>
                {isComplete && <Text style={bShopStyles.statusComplete}>✓ DONE</Text>}
                {isFailed && <Text style={bShopStyles.statusFailed}>✕ FAILED</Text>}
                {!isComplete && !isFailed && <Text style={bShopStyles.statusActive}>● ACTIVE</Text>}
              </View>
              <Text style={[bShopStyles.cardName, { color: isComplete ? "#39FF14" : isFailed ? "#555" : "#EAEAEA" }]}>
                {b.name}
              </Text>
              {isComplete && (
                <View style={bShopStyles.rewardPill}>
                  <Text style={bShopStyles.rewardPillText}>+{b.reward}⊙</Text>
                </View>
              )}
            </View>
            <Text style={bShopStyles.cardDesc}>{b.description}</Text>
            <View style={bShopStyles.track}>
              <View style={[bShopStyles.fill, { width: `${ratio * 100}%` as any, backgroundColor: barColor }]} />
            </View>
            <Text style={bShopStyles.progressLabel}>
              {isComplete || isFailed
                ? isComplete ? "Completed" : "Not completed"
                : `${b.progress} / ${b.target}`}
            </Text>
          </View>
        );
      })}
      {bounties.length === 0 && (
        <Text style={bShopStyles.empty}>No bounties this run.</Text>
      )}
    </>
  );
}

const bShopStyles = StyleSheet.create({
  rewardSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(243,156,18,0.08)",
    borderWidth: 1,
    borderColor: "#D35400",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginBottom: 6,
  },
  rewardSummaryText: {
    color: "#F39C12",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  card: {
    borderWidth: 1,
    marginHorizontal: 4,
    marginBottom: 8,
    padding: 10,
    gap: 5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {},
  statusComplete: {
    color: "#39FF14",
    fontSize: 9,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  statusFailed: {
    color: "#555",
    fontSize: 9,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  statusActive: {
    color: "#F39C12",
    fontSize: 9,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  cardName: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 2,
  },
  rewardPill: {
    backgroundColor: "rgba(243,156,18,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rewardPillText: {
    color: "#F39C12",
    fontSize: 11,
    fontWeight: "900",
    fontFamily: "Courier",
  },
  cardDesc: {
    color: "#7A7A7A",
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: "Courier",
  },
  track: {
    height: 5,
    backgroundColor: "rgba(243,156,18,0.12)",
    borderWidth: 1,
    borderColor: "#333",
    marginTop: 2,
  },
  fill: {
    height: "100%",
  },
  progressLabel: {
    color: "#555",
    fontSize: 9,
    fontFamily: "Courier",
    letterSpacing: 0.5,
  },
  empty: {
    color: "#555",
    fontSize: 11,
    fontFamily: "Courier",
    textAlign: "center",
    marginTop: 20,
  },
});

const TURRET_STAT_META: Record<TurretStatKey, { label: string; icon: string; color: string; desc: string }> = {
  damage:    { label: "DAMAGE",     icon: "bullet",       color: "#FF2A2A", desc: "Shot damage per hit" },
  fireRate:  { label: "FIRE RATE",  icon: "fire",         color: "#F39C12", desc: "Shots per second" },
  defense:   { label: "DEFENSE",    icon: "shield",       color: "#9a9a9a", desc: "Turret max HP" },
  magnetizer:{ label: "MAGNETIZER", icon: "magnet",       color: "#00FFFF", desc: "Auto-collect scrap in radius" },
};

function turretStatValue(stat: TurretStatKey, lv: number): string {
  switch (stat) {
    case "damage":    return `${turretDamageForLevel(lv)} dmg`;
    case "fireRate":  return `${turretFireRateForLevel(lv).toFixed(1)}/s`;
    case "defense":   return `${turretHpForLevel(lv)} HP`;
    case "magnetizer":return turretMagnetizerRange(lv) === 0 ? "OFF" : `${turretMagnetizerRange(lv)}px`;
  }
}

function TurretSection({ state, forceTick }: { state: GameState; forceTick: () => void }) {
  const ub = uniformBonuses(state.equippedUniform);
  const waveReq = ub.turretUnlocked ? 0 : TURRET_PURCHASE_WAVE;
  const locked = state.stats.wavesCleared < waveReq;
  const cost = turretPurchaseCost(state);
  const canAfford = state.scrap >= cost;

  return (
    <>
      <SectionLabel text="TURRET · PERMANENT · DEPLOY ANY WAVE" />

      {!state.turretOwned ? (
        <TouchableOpacity
          testID="turret-buy"
          disabled={locked}
          style={[styles.card, locked && styles.cardDisabled]}
          activeOpacity={0.7}
          onPress={() => { if (buyTurret(state)) forceTick(); }}
        >
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="cctv" size={22} color="#00FFFF" />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.cardLabel}>AUTO-TURRET</Text>
              {locked && <Text style={styles.lockTag}>WAVE {waveReq}</Text>}
            </View>
            <Text style={styles.cardSub}>Permanent sentry. Deploy each wave. Upgrade all 4 stats.</Text>
            <Text style={styles.cardStats}>
              {turretDamageForLevel(1)} dmg · {turretFireRateForLevel(1).toFixed(1)}/s · 300px · {turretHpForLevel(1)} HP
            </Text>
          </View>
          <Cost cost={cost} canAfford={canAfford && !locked} />
        </TouchableOpacity>
      ) : (
        <View style={styles.turretCard}>
          <View style={styles.turretCardHeader}>
            <MaterialCommunityIcons name="cctv" size={18} color="#00FFFF" />
            <Text style={styles.turretCardTitle}>AUTO-TURRET</Text>
            <View style={styles.ownedBadge}><Text style={styles.ownedBadgeText}>OWNED</Text></View>
          </View>
          {(["damage", "fireRate", "defense", "magnetizer"] as TurretStatKey[]).map((stat) => {
            const lv = state.turretUpgrades[stat];
            const maxed = lv >= TURRET_MAX_LEVEL;
            const cost = maxed ? 0 : TURRET_UPGRADE_COSTS[stat][lv - 1];
            const canAffordUpgrade = state.scrap >= cost;
            const meta = TURRET_STAT_META[stat];
            return (
              <View key={stat} style={styles.turretStatRow}>
                <MaterialCommunityIcons name={meta.icon as any} size={16} color={meta.color} />
                <View style={styles.turretStatInfo}>
                  <Text style={[styles.turretStatLabel, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={styles.turretStatDesc}>{meta.desc}</Text>
                </View>
                <View style={styles.turretStatRight}>
                  <Text style={[styles.turretStatValue, { color: meta.color }]}>
                    {turretStatValue(stat, lv)}
                  </Text>
                  {maxed ? (
                    <Text style={styles.maxTag}>MAX</Text>
                  ) : (
                    <TouchableOpacity
                      testID={`turret-upgrade-${stat}`}
                      style={[styles.turretUpgradeBtn, !canAffordUpgrade && styles.turretUpgradeBtnDisabled]}
                      activeOpacity={0.7}
                      onPress={() => { if (upgradeTurretStat(state, stat)) forceTick(); }}
                    >
                      <Text style={[styles.turretUpgradeBtnText, !canAffordUpgrade && { color: "#555" }]}>
                        ▲ {cost}⊙
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

function AbilitiesSection({
  state,
  forceTick,
}: {
  state: GameState;
  forceTick: () => void;
}) {
  return (
    <>
      <SectionLabel text="ABILITIES · ONE EQUIPPED AT A TIME" />
      {ABILITY_ORDER.map((id) => {
        const def = ABILITIES[id];
        const ab = state.abilities[id];
        const owned = ab.level > 0;
        const equipped = state.equippedAbility === id;
        const locked = state.stats.wavesCleared < def.unlockWave;
        const maxed = ab.level >= def.maxLevel;
        const st = abilityStats(id, Math.max(1, ab.level));
        const cost = owned ? abilityUpgradeCost(id, ab.level) : def.unlockCost;
        const canAfford = state.scrap >= cost;

        const valueLabel = (() => {
          if (id === "dash") return `${Math.round(st.value)}px dash`;
          if (id === "grenade") return `${Math.round(st.value)} dmg · ${Math.round(st.radius)}px`;
          if (id === "flashbang") return `${st.value.toFixed(1)}s stun · ${Math.round(st.radius)}px`;
          if (id === "emp") return `${st.value.toFixed(1)}s slow · ${Math.round(st.radius)}px`;
          return `${st.value.toFixed(1)}s surge`;
        })();

        return (
          // Audit fix: whole card is touchable to equip when owned
          <TouchableOpacity
            key={id}
            testID={`ability-${id}`}
            style={[
              styles.card,
              locked && styles.cardDisabled,
              equipped && styles.cardEquipped,
            ]}
            activeOpacity={owned ? 0.7 : 1}
            disabled={!owned || locked}
            onPress={() => {
              if (owned && equipAbility(state, id)) forceTick();
            }}
          >
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons name={def.icon as any} size={24} color={def.color} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardLabel}>{def.name}</Text>
                {owned && <Text style={styles.cardLevel}>LV {ab.level}/{def.maxLevel}</Text>}
                {equipped && <Text style={styles.equippedTag}>EQUIPPED</Text>}
                {!owned && locked && <Text style={styles.lockTag}>WAVE {def.unlockWave}</Text>}
              </View>
              <Text style={styles.cardSub}>{def.description}</Text>
              <Text style={[styles.cardStats, { color: def.color }]}>
                {valueLabel} · {st.cooldown.toFixed(1)}s CD
              </Text>
              {owned && !equipped && (
                <Text style={styles.tapHint}>Tap card to equip</Text>
              )}
            </View>
            {!owned && (
              <TouchableOpacity
                disabled={locked || !canAfford}
                style={styles.cardCost}
                activeOpacity={0.7}
                onPress={(e) => {
                  e.stopPropagation?.();
                  if (unlockAbility(state, id)) forceTick();
                }}
              >
                <MaterialCommunityIcons name="lock-open" size={12} color="#F39C12" />
                <Text style={[styles.cardCostText, { color: canAfford && !locked ? "#F39C12" : "#5a4a30" }]}>
                  {cost}
                </Text>
              </TouchableOpacity>
            )}
            {owned && !maxed && (
              <TouchableOpacity
                disabled={!canAfford}
                style={styles.cardCost}
                activeOpacity={0.7}
                onPress={(e) => {
                  e.stopPropagation?.();
                  if (upgradeAbility(state, id)) forceTick();
                }}
              >
                <MaterialCommunityIcons name="arrow-up-bold" size={12} color="#39FF14" />
                <Text style={[styles.cardCostText, { color: canAfford ? "#39FF14" : "#5a4a30" }]}>
                  {cost}
                </Text>
              </TouchableOpacity>
            )}
            {owned && maxed && (
              <View style={styles.cardCost}>
                <Text style={styles.maxTag}>MAX</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelText}>{text}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function Cost({ cost, canAfford }: { cost: number; canAfford: boolean }) {
  return (
    <View style={styles.cardCost}>
      <MaterialCommunityIcons name="nut" size={12} color="#F39C12" />
      <Text style={[styles.cardCostText, { color: canAfford ? "#F39C12" : "#5a4a30" }]}>
        {cost}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,8,8,0.85)", alignItems: "center", justifyContent: "center", padding: 16 },
  panel: { width: "100%", maxWidth: 460, maxHeight: "92%", backgroundColor: "rgba(20,18,16,0.97)", borderWidth: 1, borderColor: "#D35400", padding: 16 },
  header: { borderBottomWidth: 1, borderColor: "#333", paddingBottom: 10, marginBottom: 8 },
  headerTag: { color: "#D35400", fontSize: 10, letterSpacing: 3, fontFamily: "Courier" },
  headerTitle: { color: "#EAEAEA", fontSize: 22, fontWeight: "900", letterSpacing: 3, marginTop: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  headerSub: { color: "#7A7A7A", fontSize: 11, letterSpacing: 2, fontFamily: "Courier" },
  scrapPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(243,156,18,0.1)", borderWidth: 1, borderColor: "#F39C12", paddingHorizontal: 8, paddingVertical: 3 },
  scrapPillText: { color: "#F39C12", fontSize: 14, fontWeight: "700", marginLeft: 6, fontFamily: "Courier" },
  tabs: { flexDirection: "row", marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#333" },
  tabActive: { borderBottomColor: "#D35400" },
  tabText: { color: "#666", fontSize: 12, letterSpacing: 3, fontWeight: "800" },
  tabTextActive: { color: "#EAEAEA" },
  list: { flexGrow: 0 },
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#333", backgroundColor: "rgba(10,9,8,0.7)", padding: 10, marginVertical: 4 },
  cardDisabled: { opacity: 0.45 },
  cardEquipped: { borderColor: "#39FF14" },
  cardIcon: { width: 36, alignItems: "center" },
  cardBody: { flex: 1, marginLeft: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" },
  cardLabel: { color: "#EAEAEA", fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  cardLevel: { color: "#7A7A7A", fontSize: 10, letterSpacing: 2, fontFamily: "Courier" },
  cardSub: { color: "#7A7A7A", fontSize: 10, letterSpacing: 1, marginTop: 1 },
  cardStats: { color: "#39FF14", fontSize: 10, fontFamily: "Courier", marginTop: 2 },
  cardDelta: { color: "#39FF14", fontSize: 11, fontFamily: "Courier", marginTop: 2 },
  cardCost: { flexDirection: "row", alignItems: "center", marginLeft: 6, minWidth: 56, justifyContent: "flex-end" },
  cardCostText: { fontSize: 14, fontWeight: "700", marginLeft: 4, fontFamily: "Courier" },
  equippedTag: { color: "#39FF14", fontSize: 9, letterSpacing: 2, fontWeight: "900", backgroundColor: "rgba(57,255,20,0.15)", paddingHorizontal: 4, paddingVertical: 1 },
  ownedTag: { color: "#00FFFF", fontSize: 9, letterSpacing: 2, fontWeight: "900" },
  lockTag: { color: "#FF2A2A", fontSize: 9, letterSpacing: 2, fontWeight: "800" },
  equipText: { color: "#00FFFF", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  tapHint: { color: "#00FFFF", fontSize: 9, letterSpacing: 1, marginTop: 2, fontStyle: "italic" },
  maxTag: { color: "#39FF14", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  sectionLabel: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 2 },
  sectionLabelText: { color: "#D35400", fontSize: 10, letterSpacing: 3, fontWeight: "900", fontFamily: "Courier" },
  sectionLine: { flex: 1, height: 1, backgroundColor: "#333", marginLeft: 8 },
  uniformBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, marginTop: 6 },
  uniformBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 2, fontFamily: "Courier" },
  repairBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#39FF14", paddingVertical: 8, marginTop: 10, gap: 8 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#27AE60", paddingVertical: 8, marginTop: 6, gap: 8 },
  saveBtnText: { color: "#27AE60", fontSize: 11, fontWeight: "800", letterSpacing: 3, fontFamily: "Courier" },
  repairText: { color: "#39FF14", fontSize: 12, letterSpacing: 2, fontWeight: "800" },
  deployBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#D35400", paddingVertical: 14, marginTop: 10, gap: 8,
    overflow: "hidden", position: "relative",
  },
  deployText: { color: "#080808", fontWeight: "900", fontSize: 14, letterSpacing: 2, zIndex: 1 },
  abilityPicker: { marginTop: 10, paddingHorizontal: 4 },
  abilityPickerLabel: {
    color: "#7A7A7A", fontSize: 10, letterSpacing: 3, fontWeight: "800",
    fontFamily: "Courier", marginBottom: 6,
  },
  abilityPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  abilityChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#444", borderRadius: 4,
    paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "rgba(20,18,16,0.6)",
  },
  abilityChipActive: { backgroundColor: "rgba(20,18,16,0.9)" },
  abilityChipText: { fontSize: 11, fontWeight: "900", fontFamily: "Courier", letterSpacing: 1 },
  abilityChipCd: { fontSize: 9, fontFamily: "Courier", opacity: 0.8 },
  turretCard: {
    backgroundColor: "rgba(0,20,20,0.7)",
    borderWidth: 1,
    borderColor: "#00FFFF",
    marginTop: 6,
    padding: 10,
    gap: 8,
  },
  turretCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  turretCardTitle: { color: "#00FFFF", fontSize: 12, fontWeight: "900", letterSpacing: 3, fontFamily: "Courier", flex: 1 },
  ownedBadge: { backgroundColor: "rgba(0,255,255,0.15)", paddingHorizontal: 6, paddingVertical: 2 },
  ownedBadgeText: { color: "#00FFFF", fontSize: 8, fontWeight: "900", letterSpacing: 2 },
  turretStatRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  turretStatInfo: { flex: 1 },
  turretStatLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 2, fontFamily: "Courier" },
  turretStatDesc: { color: "#555", fontSize: 9, letterSpacing: 1, marginTop: 1 },
  turretStatRight: { alignItems: "flex-end", gap: 2 },
  turretStatValue: { fontSize: 11, fontWeight: "800", fontFamily: "Courier", letterSpacing: 1 },
  turretUpgradeBtn: {
    borderWidth: 1, borderColor: "#D35400",
    paddingHorizontal: 6, paddingVertical: 2,
  },
  turretUpgradeBtnDisabled: { borderColor: "#333" },
  turretUpgradeBtnText: { color: "#D35400", fontSize: 9, fontWeight: "900", letterSpacing: 1, fontFamily: "Courier" },
});
