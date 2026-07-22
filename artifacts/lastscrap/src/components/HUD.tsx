import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { GameState } from "../game/engine";
import { WEAPONS, WeaponId } from "../game/weapons";
import type { Bounty } from "../game/bounties";
import type { StoryObjective } from "../game/types";
import { getMission } from "../game/missions";

type Props = {
  state: GameState;
  onPause: () => void;
  onEquip: (id: WeaponId) => void;
};

const SEG_COUNT = 10;

const WEAPON_COLOR: Partial<Record<WeaponId, string>> = {
  pistol: "#FFEFA8",
  smg: "#FFEFA8",
  ar: "#39FF14",
  shotgun: "#FFD37A",
  lrg: "#39FF14",
  laser: "#FF2A95",
  gatling: "#00FFFF",
  launcher: "#F39C12",
  rpg: "#FF2A2A",
};

function formatTime(s: number): string {
  const sec = Math.ceil(s);
  const m = Math.floor(sec / 60);
  const rem = sec % 60;
  return m > 0 ? `${m}:${rem.toString().padStart(2, "0")}` : `${sec}s`;
}

function BountyRow({ bounty }: { bounty: Bounty }) {
  const ratio = bounty.target > 0 ? Math.min(1, bounty.progress / bounty.target) : 0;
  const isComplete = bounty.state === "completed";
  const isFailed = bounty.state === "failed";
  const barColor = isComplete ? "#39FF14" : isFailed ? "#FF2A2A" : "#F39C12";
  const labelColor = isComplete ? "#39FF14" : isFailed ? "#555" : "#EAEAEA";

  return (
    <View style={bStyles.row}>
      <View style={bStyles.rowTop}>
        {isComplete && <Text style={bStyles.icon}>✓</Text>}
        {isFailed && <Text style={[bStyles.icon, { color: "#555" }]}>✕</Text>}
        {!isComplete && !isFailed && <Text style={[bStyles.icon, { color: "#F39C12" }]}>·</Text>}
        <Text style={[bStyles.name, { color: labelColor }]} numberOfLines={1}>{bounty.name}</Text>
        {isComplete && (
          <Text style={bStyles.reward}>+{bounty.reward}⊙</Text>
        )}
      </View>
      <View style={bStyles.track}>
        <View style={[bStyles.fill, { width: `${ratio * 100}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={bStyles.desc} numberOfLines={1}>{bounty.description}</Text>
    </View>
  );
}

export default function HUD({ state, onPause, onEquip }: Props) {
  const insets = useSafeAreaInsets();
  const { player, rig, scrap, wave, stats } = state;
  const [bountiesOpen, setBountiesOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const hpRatio = player.hp / player.maxHp;
  const rigRatio = rig.hp / rig.maxHp;
  const hpSegs = Math.round(hpRatio * SEG_COUNT);
  const rigPct = Math.round(rigRatio * 100);

  const reloading = player.reloading;
  const boss = state.zombies.find((z) => z.kind === "boss" && z.hp > 0) ?? null;
  const bossRatio = boss ? Math.max(0, boss.hp / boss.maxHp) : 0;

  const isScavenge = state.gameMode === "scavenge";
  const quotaRatio = isScavenge && state.scavengeQuota > 0
    ? Math.min(1, state.scavengeCollected / state.scavengeQuota)
    : 0;
  const timeLeft = state.scavengeTimeLeft;
  const timeLow = isScavenge && timeLeft < 20;

  const bounties = state.activeBounties ?? [];
  const completedCount = bounties.filter((b) => b.state === "completed").length;

  return (
    <View
      style={[styles.root, { top: topPad + 10 }]}
      pointerEvents="box-none"
      testID="hud"
    >
      {/* TOP LEFT — HP + Scrap + Bounty toggle */}
      <View style={styles.leftPanel}>
        <View style={styles.hpRow} testID="player-health-bar">
          <Text style={styles.hpLabel}>HP</Text>
          <View style={styles.hpSegs}>
            {Array.from({ length: SEG_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.hpSeg,
                  {
                    backgroundColor:
                      i < hpSegs
                        ? hpRatio > 0.4 ? "#FF2A2A" : "#FF8800"
                        : "rgba(255,42,42,0.18)",
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.hpNum}>{Math.ceil(player.hp)}</Text>
        </View>

        <View style={styles.scrapRow} testID="scrap-count">
          <MaterialCommunityIcons name="nut" size={13} color="#F39C12" />
          <Text style={styles.scrapText}>{scrap}</Text>
          <Text style={styles.scrapLabel}>SCRAP</Text>
        </View>

        {reloading && (
          <Text style={styles.reloadText} testID="reload-indicator">
            RELOADING…
          </Text>
        )}

        {bounties.length > 0 && (
          <TouchableOpacity
            style={styles.bountyToggle}
            onPress={() => setBountiesOpen((v) => !v)}
            activeOpacity={0.7}
            testID="bounty-toggle"
          >
            <MaterialCommunityIcons name="trophy-outline" size={10} color="#F39C12" />
            <Text style={styles.bountyToggleText}>
              BOUNTIES {completedCount}/{bounties.length}
            </Text>
            <Text style={[styles.bountyToggleText, { color: "#555" }]}>
              {bountiesOpen ? "▴" : "▾"}
            </Text>
          </TouchableOpacity>
        )}

        {bountiesOpen && bounties.length > 0 && (
          <View style={styles.bountyPanel} testID="bounty-panel">
            {bounties.map((b) => (
              <BountyRow key={b.templateId} bounty={b} />
            ))}
          </View>
        )}
      </View>

      {/* TOP CENTER — Weapon switcher bar */}
      <View style={styles.centerPanel} pointerEvents="box-none">
        <View style={styles.weaponBar}>
          {state.ownedWeapons.map((id) => {
            const w = WEAPONS[id];
            const equipped = state.equippedWeapon === id;
            const color = WEAPON_COLOR[id] ?? "#EAEAEA";
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.weaponPill,
                  equipped && { borderColor: color, backgroundColor: `${color}22` },
                ]}
                onPress={() => onEquip(id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.weaponPillText, equipped && { color }]}>
                  {w.short}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* TOP RIGHT — Wave + RIG/Scavenge + Pause */}
      <View style={styles.rightPanel}>
        <TouchableOpacity
          style={styles.pauseBtn}
          onPress={onPause}
          activeOpacity={0.7}
          testID="pause-btn"
        >
          <Ionicons name="pause" size={16} color="#EAEAEA" />
        </TouchableOpacity>
        <View style={styles.waveBox} testID="wave-indicator">
          <Text style={styles.waveLabel}>[ W-{wave.toString().padStart(2, "0")} ]</Text>
          <Text style={styles.killsLabel}>{stats.kills} KIA</Text>
        </View>

        {/* RIG integrity — hidden in Scavenge (no RIG to defend) */}
        {!isScavenge && (
          <View style={styles.rigBox} testID="rig-integrity">
            <Ionicons name="nuclear" size={11} color={rigRatio > 0.3 ? "#00FFFF" : "#FF2A2A"} />
            <Text style={[styles.rigPct, { color: rigRatio > 0.3 ? "#00FFFF" : "#FF2A2A" }]}>
              {rigPct}%
            </Text>
            <Text style={styles.rigLabel}>RIG</Text>
          </View>
        )}

        {/* Scavenge: time remaining pill */}
        {isScavenge && (
          <View style={[styles.rigBox, { borderColor: timeLow ? "#FF2A2A" : "#333" }]} testID="scavenge-timer">
            <Ionicons name="timer-outline" size={11} color={timeLow ? "#FF2A2A" : "#7A7A7A"} />
            <Text style={[styles.rigPct, { color: timeLow ? "#FF2A2A" : "#EAEAEA" }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}
      </View>

      {/* Boss health bar — absolute positioned */}
      {boss && (
        <View style={styles.bossBarWrap} pointerEvents="none" testID="boss-health-bar">
          <View style={styles.bossBarHeader}>
            <MaterialCommunityIcons name="skull-crossbones" size={12} color="#F39C12" />
            <Text style={styles.bossBarLabel}>BOSS</Text>
          </View>
          <View style={styles.bossBarTrack}>
            <View style={[styles.bossBarFill, { width: `${bossRatio * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Scavenge quota bar — absolute positioned below wave info */}
      {isScavenge && state.scavengeQuota > 0 && (
        <View style={styles.scavengeBarWrap} pointerEvents="none" testID="scavenge-quota">
          <View style={styles.scavengeBarHeader}>
            <MaterialCommunityIcons name="nut" size={11} color="#39FF14" />
            <Text style={styles.scavengeBarLabel}>
              {state.scavengeCollected} / {state.scavengeQuota}
            </Text>
            <Text style={styles.scavengeBarSub}> QUOTA</Text>
            <Text style={styles.scavengeBarDivider}>·</Text>
            <MaterialCommunityIcons name="package-variant-closed" size={11} color="#F39C12" />
            <Text style={styles.scavengeBarCrateHint}>CRATES</Text>
          </View>
          <View style={styles.scavengeBarTrack}>
            <View
              style={[
                styles.scavengeBarFill,
                { width: `${quotaRatio * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Story objective HUD — absolute positioned bottom-center */}
      {state.gameMode === "story" && state.storyObjective && (
        <StoryObjectiveHUD
          obj={state.storyObjective}
          missionId={state.storyMissionId}
          scavengeCollected={state.scavengeCollected}
          playerPos={state.player.pos}
        />
      )}
    </View>
  );
}

type SOProps = {
  obj: StoryObjective;
  missionId: number | null;
  scavengeCollected: number;
  playerPos: { x: number; y: number };
};

function StoryObjectiveHUD({ obj, missionId, scavengeCollected, playerPos }: SOProps) {
  const mission = getMission(missionId ?? -1);
  let content: React.ReactNode = null;

  switch (obj.type) {
    case "escape": {
      const timeLow = obj.timeLeft < 20;
      const dx = obj.extractionPos.x - playerPos.x;
      const dy = obj.extractionPos.y - playerPos.y;
      const angle = Math.atan2(dy, dx);
      const arrows = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
      const arrowIdx = Math.round(((angle + Math.PI) / (2 * Math.PI)) * 8) % 8;
      const arrow = arrows[arrowIdx];
      content = (
        <View style={soStyles.row}>
          <MaterialCommunityIcons name="run-fast" size={13} color="#39FF14" />
          <Text style={[soStyles.label, { color: "#39FF14" }]}>EXTRACT {arrow}</Text>
          <Text style={[soStyles.timer, timeLow && soStyles.timerLow]}>
            {formatTime(obj.timeLeft)}
          </Text>
        </View>
      );
      break;
    }
    case "scavenge": {
      const quota = mission?.scavengeQuota ?? obj.quota;
      const ratio = quota > 0 ? Math.min(1, scavengeCollected / quota) : 0;
      const timeLow = obj.timeLeft < 20;
      content = (
        <View style={soStyles.col}>
          <View style={soStyles.row}>
            <MaterialCommunityIcons name="nut" size={13} color="#F39C12" />
            <Text style={soStyles.label}>{scavengeCollected} / {quota} SCRAP</Text>
            <Text style={[soStyles.timer, timeLow && soStyles.timerLow]}>
              {formatTime(obj.timeLeft)}
            </Text>
          </View>
          <View style={soStyles.track}>
            <View style={[soStyles.fill, { width: `${ratio * 100}%` as any, backgroundColor: "#F39C12" }]} />
          </View>
        </View>
      );
      break;
    }
    case "eliminate": {
      content = (
        <View style={soStyles.row}>
          <MaterialCommunityIcons name="skull-crossbones" size={13} color="#FF2A2A" />
          <Text style={[soStyles.label, { color: "#FF2A2A" }]}>
            ELIMINATE: {obj.bossName}
            {obj.bossSpawned && !obj.killed ? " ▸ IN PLAY" : !obj.bossSpawned ? " ▸ INCOMING" : ""}
          </Text>
        </View>
      );
      break;
    }
    case "hold": {
      const holdTotal = mission?.holdDurationSecs ?? 180;
      const ratio = holdTotal > 0 ? Math.max(0, 1 - obj.timeLeft / holdTotal) : 1;
      const timeLow = obj.timeLeft < 15;
      content = (
        <View style={soStyles.col}>
          <View style={soStyles.row}>
            <MaterialCommunityIcons name="shield-check" size={13} color="#00FFFF" />
            <Text style={[soStyles.label, { color: "#00FFFF" }]}>HOLD ZONE</Text>
            <Text style={[soStyles.timer, timeLow && soStyles.timerLow]}>
              {formatTime(obj.timeLeft)}
            </Text>
          </View>
          <View style={[soStyles.track, { borderColor: "#00FFFF" }]}>
            <View style={[soStyles.fill, { width: `${ratio * 100}%` as any, backgroundColor: "#00FFFF" }]} />
          </View>
        </View>
      );
      break;
    }
    case "escort": {
      const hpRatio = obj.npcMaxHp > 0 ? Math.max(0, obj.npcHp / obj.npcMaxHp) : 0;
      const hpColor = hpRatio > 0.5 ? "#27AE60" : hpRatio > 0.25 ? "#F39C12" : "#FF2A2A";
      const timeLow = obj.timeLeft < 20;
      content = (
        <View style={soStyles.col}>
          <View style={soStyles.row}>
            <MaterialCommunityIcons name="account-heart" size={13} color={hpColor} />
            <Text style={[soStyles.label, { color: hpColor }]}>
              ESCORT: {Math.ceil(obj.npcHp)} / {obj.npcMaxHp} HP
            </Text>
            <Text style={[soStyles.timer, timeLow && soStyles.timerLow]}>
              {formatTime(obj.timeLeft)}
            </Text>
          </View>
          <View style={[soStyles.track, { borderColor: hpColor }]}>
            <View style={[soStyles.fill, { width: `${hpRatio * 100}%` as any, backgroundColor: hpColor }]} />
          </View>
        </View>
      );
      break;
    }
    case "sabotage": {
      const total = obj.spawners.length;
      const done = obj.destroyed;
      // Find the spawner closest to player for progress bar
      let progressBar: React.ReactNode = null;
      const nearSpawner = [...obj.spawners]
        .filter((sp) => !sp.destroyed && sp.interactProgress > 0)
        .sort((a, b) => b.interactProgress - a.interactProgress)[0];
      if (nearSpawner) {
        progressBar = (
          <View style={[soStyles.track, { borderColor: "#FF8800" }]}>
            <View
              style={[
                soStyles.fill,
                { width: `${nearSpawner.interactProgress * 100}%` as any, backgroundColor: "#FF8800" },
              ]}
            />
          </View>
        );
      }
      content = (
        <View style={soStyles.col}>
          <View style={soStyles.row}>
            <MaterialCommunityIcons name="bomb" size={13} color="#FF8800" />
            <Text style={[soStyles.label, { color: "#FF8800" }]}>
              SPAWNERS: {done}/{total} DESTROYED
            </Text>
            {nearSpawner && (
              <Text style={[soStyles.label, { color: "#FF8800" }]}>· DISABLING…</Text>
            )}
          </View>
          {progressBar}
        </View>
      );
      break;
    }
    case "defend": {
      content = (
        <View style={soStyles.row}>
          <MaterialCommunityIcons name="radioactive" size={13} color="#D35400" />
          <Text style={[soStyles.label, { color: "#D35400" }]}>
            DEFEND RIG — SURVIVE TO WAVE {obj.targetWave}
          </Text>
        </View>
      );
      break;
    }
  }

  return (
    <View style={soStyles.wrap} pointerEvents="none">
      <View style={soStyles.pill}>{content}</View>
    </View>
  );
}

const soStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    backgroundColor: "rgba(8,8,8,0.88)",
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 220,
    maxWidth: 300,
    gap: 5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  col: {
    gap: 5,
  },
  label: {
    color: "#EAEAEA",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: "Courier",
    flex: 1,
  },
  timer: {
    color: "#EAEAEA",
    fontSize: 11,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  timerLow: {
    color: "#FF2A2A",
  },
  track: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "#333",
  },
  fill: {
    height: "100%",
  },
});

const bStyles = StyleSheet.create({
  row: {
    marginBottom: 5,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  icon: {
    color: "#39FF14",
    fontSize: 9,
    fontWeight: "900",
    width: 10,
  },
  name: {
    flex: 1,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: "Courier",
  },
  reward: {
    color: "#F39C12",
    fontSize: 9,
    fontWeight: "900",
    fontFamily: "Courier",
  },
  track: {
    height: 4,
    backgroundColor: "rgba(243,156,18,0.15)",
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 2,
  },
  fill: {
    height: "100%",
  },
  desc: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 0.5,
    fontFamily: "Courier",
  },
});

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    pointerEvents: "box-none" as any,
  },
  leftPanel: {
    gap: 5,
    maxWidth: 180,
  },
  centerPanel: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
    pointerEvents: "box-none" as any,
  },
  weaponBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(8,8,8,0.6)",
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  weaponPill: {
    borderWidth: 1,
    borderColor: "#444",
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: "transparent",
  },
  weaponPillText: {
    color: "#666",
    fontSize: 9,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  hpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(8,8,8,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#333",
  },
  hpLabel: {
    color: "#FF2A2A",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
    fontWeight: "900",
    width: 16,
  },
  hpSegs: {
    flexDirection: "row",
    gap: 2,
  },
  hpSeg: {
    width: 10,
    height: 12,
  },
  hpNum: {
    color: "#EAEAEA",
    fontSize: 11,
    fontFamily: "Courier",
    fontWeight: "800",
    minWidth: 26,
  },
  scrapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(8,8,8,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#333",
  },
  scrapText: {
    color: "#F39C12",
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "Courier",
  },
  scrapLabel: {
    color: "#7A7A7A",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  reloadText: {
    color: "#FF8800",
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: "Courier",
    fontWeight: "900",
    backgroundColor: "rgba(8,8,8,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#FF8800",
  },
  bountyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(8,8,8,0.6)",
    borderWidth: 1,
    borderColor: "#555",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bountyToggleText: {
    color: "#F39C12",
    fontSize: 9,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  bountyPanel: {
    backgroundColor: "rgba(8,8,8,0.88)",
    borderWidth: 1,
    borderColor: "#444",
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 175,
  },
  rightPanel: {
    alignItems: "flex-end",
    gap: 5,
  },
  pauseBtn: {
    backgroundColor: "rgba(8,8,8,0.7)",
    borderWidth: 1,
    borderColor: "#333",
    padding: 8,
  },
  waveBox: {
    backgroundColor: "rgba(8,8,8,0.6)",
    borderWidth: 1,
    borderColor: "#D35400",
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "flex-end",
  },
  waveLabel: {
    color: "#D35400",
    fontSize: 13,
    letterSpacing: 3,
    fontFamily: "Courier",
    fontWeight: "900",
  },
  killsLabel: {
    color: "#7A7A7A",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  rigBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(8,8,8,0.6)",
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rigPct: {
    fontSize: 13,
    fontFamily: "Courier",
    fontWeight: "900",
  },
  rigLabel: {
    color: "#7A7A7A",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  bossBarWrap: {
    position: "absolute",
    top: 4,
    left: "50%",
    marginLeft: -110,
    width: 220,
    alignItems: "center",
    gap: 3,
  },
  bossBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bossBarLabel: {
    color: "#F39C12",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  bossBarTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(243,156,18,0.15)",
    borderWidth: 1,
    borderColor: "#F39C12",
  },
  bossBarFill: {
    height: "100%",
    backgroundColor: "#F39C12",
  },
  scavengeBarWrap: {
    position: "absolute",
    top: 56,
    left: "50%",
    marginLeft: -120,
    width: 240,
    alignItems: "center",
    gap: 3,
  },
  scavengeBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scavengeBarLabel: {
    color: "#39FF14",
    fontSize: 11,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  scavengeBarSub: {
    color: "#7A7A7A",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  scavengeBarDivider: {
    color: "#444",
    fontSize: 9,
    fontFamily: "Courier",
  },
  scavengeBarCrateHint: {
    color: "#F39C12",
    fontSize: 8,
    letterSpacing: 1,
    fontFamily: "Courier",
    opacity: 0.8,
  },
  scavengeBarTrack: {
    width: "100%",
    height: 7,
    backgroundColor: "rgba(57,255,20,0.12)",
    borderWidth: 1,
    borderColor: "#39FF14",
  },
  scavengeBarFill: {
    height: "100%",
    backgroundColor: "#39FF14",
  },
});
