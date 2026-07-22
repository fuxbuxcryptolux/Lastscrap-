import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { GameState } from "../game/engine";
import type { GameMode } from "../game/types";

export function PauseOverlay({
  onResume,
  onSave,
  onAbort,
  onScrapyard,
}: {
  onResume: () => void;
  onSave: () => void;
  onAbort: () => void;
  onScrapyard: () => void;
}) {
  return (
    <View style={styles.overlay} testID="pause-overlay">
      <View style={styles.panel}>
        <Text style={styles.tag}>[ SYSTEM ]</Text>
        <Text style={styles.title}>PAUSED</Text>
        <Text style={styles.sub}>Reactor cooling. Take a breath, operator.</Text>

        <TouchableOpacity
          testID="resume-btn"
          style={[styles.btn, styles.btnPrimary]}
          onPress={onResume}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={16} color="#080808" />
          <Text style={styles.btnPrimaryText}>RESUME</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="scrapyard-btn"
          style={[styles.btn, styles.btnScrapyard]}
          onPress={onScrapyard}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="tshirt-crew" size={16} color="#F39C12" />
          <Text style={styles.btnScrapyardText}>SCRAPYARD · UNIFORMS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="save-btn"
          style={[styles.btn, styles.btnSave]}
          onPress={onSave}
          activeOpacity={0.8}
        >
          <Ionicons name="save-outline" size={16} color="#27AE60" />
          <Text style={styles.btnSaveText}>SAVE GAME</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="abort-btn"
          style={[styles.btn, styles.btnGhost]}
          onPress={onAbort}
          activeOpacity={0.7}
        >
          <Ionicons name="close-sharp" size={16} color="#FF2A2A" />
          <Text style={styles.btnGhostText}>ABORT MISSION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function GameOverOverlay({
  state,
  best,
  gameMode,
  onRestart,
  onMenu,
  onRevive,
}: {
  state: GameState;
  best: { wave: number; scrap: number; kills: number };
  gameMode?: GameMode;
  onRestart: () => void;
  onMenu: () => void;
  onRevive?: () => void;
}) {
  const isScavenge = gameMode === "scavenge";
  const reason = state.player.hp <= 0
    ? "OPERATOR DOWN"
    : isScavenge
      ? "TIME EXPIRED"
      : "RIG OFFLINE";

  const [adReady, setAdReady] = useState(false);
  const [reviveUsed, setReviveUsed] = useState(false);

  useEffect(() => {
    if (!onRevive) return;
    let cancelled = false;
    import("../utils/admob").then(({ preloadRewardedAd }) => {
      preloadRewardedAd().then((ready) => {
        if (!cancelled) setAdReady(ready);
      });
    });
    return () => { cancelled = true; };
  }, [onRevive]);

  const handleReviveTap = () => {
    if (!onRevive || !adReady || reviveUsed) return;
    import("../utils/admob").then(({ showRewardedAd }) => {
      let rewarded = false;
      showRewardedAd(
        () => { rewarded = true; },
        () => {
          if (rewarded) {
            setReviveUsed(true);
            onRevive();
          }
        },
      );
    });
  };

  return (
    <View style={[styles.overlay, styles.gameOverTint]} testID="gameover-overlay">
      <View style={styles.panel}>
        <Text style={[styles.tag, { color: "#FF2A2A" }]}>[ FATAL ]</Text>
        <Text style={[styles.title, { color: "#FF2A2A" }]}>{reason}</Text>
        <Text style={styles.sub}>The last scrap was not enough.</Text>

        <View style={styles.statBlock}>
          {isScavenge ? (
            <>
              <Stat label="SCRAP COLLECTED" value={state.stats.totalScrap} best={best.scrap} icon />
              <Stat label="WAVES COMPLETED" value={state.stats.wavesCleared} best={best.wave} />
              <Stat label="ZOMBIES TERMINATED" value={state.stats.kills} best={best.kills} />
            </>
          ) : (
            <>
              <Stat label="WAVES SURVIVED" value={state.stats.wavesCleared} best={best.wave} />
              <Stat label="ZOMBIES TERMINATED" value={state.stats.kills} best={best.kills} />
              <Stat label="SCRAP RECOVERED" value={state.stats.totalScrap} best={best.scrap} icon />
            </>
          )}
        </View>

        {onRevive && !reviveUsed && (
          <TouchableOpacity
            testID="revive-btn"
            style={[styles.btn, styles.btnRevive, !adReady && styles.btnReviveDim]}
            onPress={handleReviveTap}
            activeOpacity={adReady ? 0.85 : 1}
            disabled={!adReady}
          >
            <MaterialCommunityIcons name="heart-pulse" size={16} color={adReady ? "#080808" : "#555"} />
            <Text style={[styles.btnReviveText, !adReady && { color: "#555" }]}>
              {adReady ? "WATCH AD · REVIVE" : "LOADING AD..."}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID="restart-btn"
          style={[styles.btn, styles.btnPrimary]}
          onPress={onRestart}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={16} color="#080808" />
          <Text style={styles.btnPrimaryText}>REBOOT SYSTEM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="menu-btn"
          style={[styles.btn, styles.btnGhost]}
          onPress={onMenu}
          activeOpacity={0.7}
        >
          <Ionicons name="home" size={16} color="#EAEAEA" />
          <Text style={[styles.btnGhostText, { color: "#EAEAEA" }]}>MAIN MENU</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  best,
  icon,
}: {
  label: string;
  value: number;
  best: number;
  icon?: boolean;
}) {
  const isBest = value >= best && value > 0;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRight}>
        {icon && <MaterialCommunityIcons name="nut" size={12} color="#F39C12" />}
        <Text style={styles.statValue}>{value}</Text>
        {isBest && <Text style={styles.bestTag}>BEST</Text>}
        {!isBest && best > 0 && <Text style={styles.bestSub}>· best {best}</Text>}
      </View>
    </View>
  );
}

export function WaveBanner({ wave }: { wave: number }) {
  return (
    <View pointerEvents="none" style={styles.waveBanner} testID="wave-banner">
      <Text style={styles.bannerTag}>[ INCOMING ]</Text>
      <Text style={styles.bannerWave}>WAVE {wave.toString().padStart(2, "0")}</Text>
    </View>
  );
}

export function BossWarning() {
  const flash = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.25, duration: 220, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash]);

  return (
    <Animated.View
      pointerEvents="none"
      testID="boss-warning"
      style={[styles.hordeWarning, styles.bossWarning, { opacity: flash }]}
    >
      <MaterialCommunityIcons name="skull-crossbones" size={28} color="#F39C12" />
      <Text style={[styles.hordeWarningText, styles.bossWarningText]}>BOSS INCOMING</Text>
      <MaterialCommunityIcons name="skull-crossbones" size={28} color="#F39C12" />
    </Animated.View>
  );
}

export function HordeWarning() {
  const flash = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.2, duration: 280, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash]);

  return (
    <Animated.View
      pointerEvents="none"
      testID="horde-warning"
      style={[styles.hordeWarning, { opacity: flash }]}
    >
      <MaterialCommunityIcons name="skull" size={26} color="#FF2A2A" />
      <Text style={styles.hordeWarningText}>INCOMING HORDE</Text>
      <MaterialCommunityIcons name="skull" size={26} color="#FF2A2A" />
    </Animated.View>
  );
}

export function HordeCountdown({ seconds }: { seconds: number }) {
  const secs = Math.ceil(seconds);
  const m = Math.floor(secs / 60);
  const sRem = secs % 60;
  const label = m > 0 ? `${m}:${sRem.toString().padStart(2, "0")}` : `${sRem}s`;
  return (
    <View pointerEvents="none" style={styles.hordeCountdown} testID="horde-countdown">
      <MaterialCommunityIcons name="timer-sand" size={14} color="#FF2A2A" />
      <Text style={styles.hordeCountdownLabel}>HORDE</Text>
      <Text style={styles.hordeCountdownValue}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,8,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  gameOverTint: {
    backgroundColor: "rgba(40,8,8,0.92)",
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(20,18,16,0.97)",
    borderWidth: 1,
    borderColor: "#D35400",
    padding: 22,
  },
  tag: {
    color: "#D35400",
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  title: {
    color: "#EAEAEA",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    marginTop: 2,
  },
  sub: {
    color: "#7A7A7A",
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  statBlock: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    paddingVertical: 10,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  statLabel: {
    color: "#7A7A7A",
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  statRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    color: "#EAEAEA",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Courier",
  },
  bestTag: {
    color: "#39FF14",
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "900",
    marginLeft: 6,
    backgroundColor: "rgba(57,255,20,0.15)",
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  bestSub: {
    color: "#555",
    fontSize: 10,
    fontFamily: "Courier",
    marginLeft: 4,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 8,
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: "#D35400",
  },
  btnPrimaryText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3,
  },
  btnScrapyard: {
    borderWidth: 1,
    borderColor: "#F39C12",
  },
  btnScrapyardText: {
    color: "#F39C12",
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "800",
  },
  btnSave: {
    borderWidth: 1,
    borderColor: "#27AE60",
  },
  btnSaveText: {
    color: "#27AE60",
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "800",
  },
  btnRevive: {
    backgroundColor: "#27AE60",
  },
  btnReviveDim: {
    backgroundColor: "rgba(39,174,96,0.25)",
    borderWidth: 1,
    borderColor: "#27AE60",
  },
  btnReviveText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: "#333",
  },
  btnGhostText: {
    color: "#FF2A2A",
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "800",
  },
  waveBanner: {
    position: "absolute",
    top: "30%",
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(20,18,16,0.85)",
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderWidth: 1,
    borderColor: "#D35400",
  },
  bannerTag: {
    color: "#D35400",
    fontSize: 10,
    letterSpacing: 4,
    fontFamily: "Courier",
  },
  bannerWave: {
    color: "#EAEAEA",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 4,
  },
  hordeWarning: {
    position: "absolute",
    top: "26%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(40,8,8,0.9)",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: "#FF2A2A",
  },
  hordeWarningText: {
    color: "#FF2A2A",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 4,
  },
  bossWarning: {
    borderColor: "#F39C12",
    top: "20%",
  },
  bossWarningText: {
    color: "#F39C12",
  },
  hordeCountdown: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(40,8,8,0.85)",
    borderWidth: 1,
    borderColor: "#FF2A2A",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  hordeCountdownLabel: {
    color: "#FF2A2A",
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: "Courier",
    fontWeight: "800",
  },
  hordeCountdownValue: {
    color: "#EAEAEA",
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
});
