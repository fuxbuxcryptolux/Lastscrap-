import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import Arena from "@/src/components/Arena";
import HUD from "@/src/components/HUD";
import Joystick from "@/src/components/Joystick";
import FireButton from "@/src/components/FireButton";
import AbilityButton from "@/src/components/AbilityButton";
import DeployBar from "@/src/components/DeployBar";
import UpgradeShop from "@/src/components/UpgradeShop";
import ScrapyardShop, { loadEquippedUniform } from "@/src/components/ScrapyardShop";
import {
  GameOverOverlay,
  PauseOverlay,
  WaveBanner,
  HordeWarning,
  HordeCountdown,
  BossWarning,
} from "@/src/components/Overlays";
import {
  GameState,
  createState,
  deployThrowable,
  deployTurret,
  startWave,
  tick,
  useAbility,
  extractSave,
  applySave,
  startReload,
  equipWeapon,
  applyUniformToState,
  setupStoryMission,
  tickBountyProgress,
} from "@/src/game/engine";
import type { ThrowableType, WeaponId } from "@/src/game/weapons";
import type { UniformId } from "@/src/game/uniforms";
import type { GameMode } from "@/src/game/types";
import {
  tickWaveClearBounties,
  failActiveBounties,
  BOUNTY_POOL,
} from "@/src/game/bounties";
import { storage } from "@/src/utils/storage";
import { BEST_KEY, BEST_KEY_BOSS, BEST_KEY_SCAVENGE, SAVE_KEY } from "@/src/game/storage";
import { initAdMob, maybeShowInterstitial, preloadRewardedAd } from "@/src/utils/admob";
import { initSound, preloadAllSfx, sfx } from "@/src/utils/sound";
import { getMission } from "@/src/game/missions";
import { saveCampaignProgress, loadCampaignProgress } from "@/src/components/StoryModeSelect";
import { submitBossRushScore } from "@/src/utils/leaderboard";
import { TextInput } from "react-native";

type Best = { wave: number; scrap: number; kills: number };

function bestKeyForMode(mode: GameMode): string {
  if (mode === "boss-rush") return BEST_KEY_BOSS;
  if (mode === "scavenge") return BEST_KEY_SCAVENGE;
  return BEST_KEY;
}

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ newGame?: string; gameMode?: string; missionId?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stateRef = useRef<GameState | null>(null);
  const [, setRenderTick] = useState(0);
  const [waveBannerVisible, setWaveBannerVisible] = useState(false);
  const [scrapyardOpen, setScrapyardOpen] = useState(false);
  const [missionComplete, setMissionComplete] = useState(false);
  const missionSavedRef = useRef(false);
  const [bountyFlash, setBountyFlash] = useState<{ name: string; reward: number } | null>(null);
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const bestRef = useRef<Best>({ wave: 0, scrap: 0, kills: 0 });
  const gameOverSavedRef = useRef(false);
  const bountyFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeAnim = useRef(new Animated.Value(0)).current;
  const bountyFlashAnim = useRef(new Animated.Value(0)).current;
  const wallDebugEnabledRef = useRef(false);

  const [bossScoreState, setBossScoreState] = useState<
    | { phase: "idle" }
    | { phase: "enter-name"; wave: number; kills: number; scrap: number }
    | { phase: "submitting"; wave: number; kills: number; scrap: number; name: string }
    | { phase: "done"; ranked: boolean; rank: number | null }
  >({ phase: "idle" });
  const [bossPlayerName, setBossPlayerName] = useState("");
  const bossScoreSubmittedRef = useRef(false);
  const PLAYER_NAME_KEY = "lastscrap_player_name";

  const arenaSize = useMemo(() => ({ width, height }), [width, height]);

  const forceTick = useCallback(() => setRenderTick((t) => (t + 1) % 1000000), []);

  const flashSaved = useCallback(() => {
    savedFadeAnim.setValue(1);
    Animated.sequence([
      Animated.delay(1200),
      Animated.timing(savedFadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [savedFadeAnim]);

  useEffect(() => {
    const isNewGame = params.newGame === "1";
    const modeParam = (params.gameMode ?? "rig-defense") as GameMode;

    initSound().then(() => preloadAllSfx()).catch(() => {});
    initAdMob().then(() => preloadRewardedAd()).catch(() => {});
    storage.getItem<string>(PLAYER_NAME_KEY, "").then((n) => {
      if (n && typeof n === "string" && n.length > 0) setBossPlayerName(n);
    }).catch(() => {});

    (async () => {
      const uniformId = await loadEquippedUniform();

      let resolvedMode: GameMode = modeParam;

      if (!isNewGame) {
        // Try to load save — mode comes from save data via applySave
        const saveRaw = await storage.getItem<string>(SAVE_KEY, "");
        if (saveRaw && typeof saveRaw === "string" && saveRaw.length > 0) {
          try {
            const save = JSON.parse(saveRaw);
            resolvedMode = save.gameMode ?? "rig-defense";

            // Story saves without a valid storyMissionId cannot be restored —
            // clear and fall through to a fresh start.
            if (resolvedMode === "story" && save.storyMissionId == null) {
              await storage.setItem(SAVE_KEY, "");
              resolvedMode = "rig-defense";
              throw new Error("story save missing missionId");
            }

            // Load best for the save's mode
            const bestRaw = await storage.getItem<string>(bestKeyForMode(resolvedMode), "");
            if (bestRaw && typeof bestRaw === "string" && bestRaw.length > 0) {
              try { bestRef.current = { ...bestRef.current, ...JSON.parse(bestRaw) }; } catch {}
            }

            const s = createState(arenaSize.width, arenaSize.height, uniformId, resolvedMode);
            stateRef.current = s;
            applySave(s, save);
            setRenderTick((t) => (t + 1) % 1000000);
            return;
          } catch {}
        }
      }

      // Load best for chosen mode
      const bestRaw = await storage.getItem<string>(bestKeyForMode(resolvedMode), "");
      if (bestRaw && typeof bestRaw === "string" && bestRaw.length > 0) {
        try { bestRef.current = { ...bestRef.current, ...JSON.parse(bestRaw) }; } catch {}
      }

      if (isNewGame) {
        await storage.setItem(SAVE_KEY, "");
      }

      const s = createState(arenaSize.width, arenaSize.height, uniformId, resolvedMode);
      stateRef.current = s;

      if (resolvedMode === "story" && params.missionId) {
        const mid = parseInt(params.missionId, 10);
        if (!isNaN(mid)) {
          setupStoryMission(s, mid);
        }
      } else {
        // Apply any scrap banked from completed story missions as a persistent bonus.
        try {
          const camp = await loadCampaignProgress();
          if (camp.scrapBank > 0) {
            s.scrap += camp.scrapBank;
            s.stats.totalScrap += camp.scrapBank;
          }
        } catch {}
      }

      startWave(s);
      showBanner();
      if (resolvedMode === "story") {
        sfx.missionStart();
      } else {
        sfx.waveStart();
      }
      setRenderTick((t) => (t + 1) % 1000000);
    })();

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    s.viewport.width = arenaSize.width;
    s.viewport.height = arenaSize.height;
  }, [arenaSize]);

  // Game loop
  useEffect(() => {
    const loop = (now: number) => {
      const s = stateRef.current;
      if (!s) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (lastFrameRef.current === 0) lastFrameRef.current = now;
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      if (!wallDebugEnabledRef.current) {
        try {
          tick(s, dt);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Game tick error:", err);
        }
      }

      for (const ev of s.sfxQueue) {
        if (ev.startsWith("shoot_")) { sfx.shoot(ev.slice(6)); }
        else if (ev === "zombie_hit")   { sfx.zombieHit(); }
        else if (ev === "zombie_die")   { sfx.zombieDie(); }
        else if (ev === "player_hurt")  { sfx.playerHurt(); }
        else if (ev === "rig_hit")      { sfx.rigHit(); }
        else if (ev === "scrap_pickup") { sfx.scrapPickup(); }
        else if (ev === "explosion")    { sfx.explosion(); }
        else if (ev === "reload")       { sfx.reload(); }
        else if (ev === "horde_warning") { sfx.hordeWarning(); }
        else if (ev === "zombie_groan_1" || ev === "zombie_groan_2") { sfx.zombieGroan(); }
        else if (ev === "emp_pulse")    { sfx.emp(); }
        else if (ev === "ui_deploy")    { sfx.deploy(); }
        else if (ev === "ui_upgrade")   { sfx.upgrade(); }
        else if (ev === "ui_wave_start") { sfx.waveStart(); }
      }

      // Collect all newly completed bounties this frame (mid-wave completions
      // already have scrap awarded in tickBountyProgress; wave-end bounties are
      // handled below and awarded there)
      const frameCompletions: { name: string; reward: number }[] = [];
      for (const b of s.activeBounties) {
        if (b.justCompleted) {
          b.justCompleted = false;
          frameCompletions.push({ name: b.name, reward: b.reward });
        }
      }

      if (s.status === "waveclear") {
        // Check wave-event bounties (no_damage_wave, fast_wave_clear)
        tickWaveClearBounties(s.activeBounties, s.bountyTracking, s.wave);
        // Award wave-end bounties immediately so reward isn't lost
        for (const b of s.activeBounties) {
          if (b.state === "completed" && !b.rewardAwarded) {
            b.rewardAwarded = true;
            s.scrap += b.reward;
            s.stats.totalScrap += b.reward;
            frameCompletions.push({ name: b.name, reward: b.reward });
          }
        }
        s.status = "shop";
        saveBestIfNeeded(s);
        sfx.waveClear();
        maybeShowInterstitial(s.stats.wavesCleared);
      }
      // Show flash toast for any bounty completed this frame
      if (frameCompletions.length > 0) {
        const latest = frameCompletions[frameCompletions.length - 1];
        if (bountyFlashTimerRef.current) clearTimeout(bountyFlashTimerRef.current);
        bountyFlashAnim.setValue(1);
        setBountyFlash({ name: latest.name, reward: latest.reward });
        bountyFlashTimerRef.current = setTimeout(() => {
          Animated.timing(bountyFlashAnim, {
            toValue: 0, duration: 500, useNativeDriver: true,
          }).start(() => setBountyFlash(null));
        }, 2000);
      }

      if (s.status === "gameover" && !gameOverSavedRef.current) {
        gameOverSavedRef.current = true;
        failActiveBounties(s.activeBounties);
        saveBestIfNeeded(s);
        storage.setItem(SAVE_KEY, "");
        sfx.playerDie();

        if (s.gameMode === "boss-rush" && !bossScoreSubmittedRef.current && s.stats.wavesCleared > 0) {
          bossScoreSubmittedRef.current = true;
          setBossScoreState({
            phase: "enter-name",
            wave: s.stats.wavesCleared,
            kills: s.stats.kills,
            scrap: s.stats.totalScrap,
          });
        }
      }

      if (s.status === "missioncomplete" && !missionSavedRef.current) {
        missionSavedRef.current = true;
        sfx.missionComplete();
        const mid = s.storyMissionId;
        if (mid != null) {
          const mission = getMission(mid);
          if (mission) {
            // Award the mission reward scrap permanently
            s.scrap += mission.reward.scrap;
            s.stats.totalScrap += mission.reward.scrap;
            saveCampaignProgress(mid, mission.reward, {
              kills: s.stats.kills,
              scrap: s.stats.totalScrap,
              wavesCleared: s.stats.wavesCleared,
            }).catch(() => {});
          }
        }
        setMissionComplete(true);
      }
      setRenderTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = 0;
    };
  }, []);

  const saveBestIfNeeded = useCallback(async (s: GameState) => {
    // Story mode has its own per-mission persistence; never write to mode best keys.
    if (s.gameMode === "story") return;
    const b = bestRef.current;
    const next = {
      wave: Math.max(b.wave, s.stats.wavesCleared),
      scrap: Math.max(b.scrap, s.stats.totalScrap),
      kills: Math.max(b.kills, s.stats.kills),
    };
    if (next.wave !== b.wave || next.scrap !== b.scrap || next.kills !== b.kills) {
      bestRef.current = next;
      const key = bestKeyForMode(s.gameMode);
      await storage.setItem(key, JSON.stringify(next));
    }
  }, []);

  const showBanner = () => {
    setWaveBannerVisible(true);
    setTimeout(() => setWaveBannerVisible(false), 1100);
  };

  const onJoystickMove = useCallback((x: number, y: number) => {
    const s = stateRef.current;
    if (!s) return;
    s.input.x = x;
    s.input.y = y;
  }, []);

  const onFireTap = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    s.fireQueued = true;
  }, []);
  const onHoldStart = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    s.fireHeld = true;
  }, []);
  const onHoldEnd = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    s.fireHeld = false;
  }, []);

  const onReload = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (startReload(s)) forceTick();
  }, [forceTick]);

  const onThrow = useCallback((t: ThrowableType) => {
    const s = stateRef.current;
    if (!s) return;
    if (deployThrowable(s, t)) forceTick();
  }, [forceTick]);

  const onTurret = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (deployTurret(s)) forceTick();
  }, [forceTick]);

  const onUseAbility = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (useAbility(s)) forceTick();
  }, [forceTick]);

  const onEquipWeapon = useCallback((id: WeaponId) => {
    const s = stateRef.current;
    if (!s || s.status !== "playing") return;
    if (equipWeapon(s, id)) forceTick();
  }, [forceTick]);

  const handlePause = () => {
    const s = stateRef.current;
    if (!s) return;
    if (s.status === "playing") s.status = "paused";
    forceTick();
  };
  const handleResume = () => {
    const s = stateRef.current;
    if (!s) return;
    if (s.status === "paused") s.status = "playing";
    setScrapyardOpen(false);
    forceTick();
  };
  const handleAbort = () => {
    setScrapyardOpen(false);
    router.replace("/");
  };
  const handleScrapyardFromPause = () => {
    setScrapyardOpen(true);
  };
  const handleCloseScrapyard = () => {
    setScrapyardOpen(false);
  };
  const handleUniformEquip = useCallback((id: UniformId) => {
    const s = stateRef.current;
    if (!s) return;
    applyUniformToState(s, id);
    forceTick();
  }, [forceTick]);
  const handleDeploy = () => {
    const s = stateRef.current;
    if (!s) return;
    startWave(s);
    showBanner();
    sfx.deploy();
    sfx.waveStart();
    forceTick();
  };
  const handleSave = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.status === "gameover") return;
    // Story missions use campaign storage; SAVE_KEY is non-story only.
    if (s.gameMode === "story") return;
    storage.setItem(SAVE_KEY, JSON.stringify(extractSave(s)));
    flashSaved();
  }, [flashSaved]);

  const handleRevive = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    s.player.hp = Math.max(1, Math.floor(s.player.maxHp * 0.5));
    s.player.invuln = 2.5;
    s.flash.screen = 0;
    const px = s.player.pos.x, py = s.player.pos.y;
    s.zombies = s.zombies.filter((z) => {
      const dx = z.pos.x - px, dy = z.pos.y - py;
      return Math.sqrt(dx * dx + dy * dy) > 160;
    });
    s.status = "playing";
    gameOverSavedRef.current = false;
    sfx.revive();
    preloadRewardedAd().catch(() => {});
    forceTick();
  }, [forceTick]);

  const handleRestart = () => {
    const currentMode = stateRef.current?.gameMode ?? "rig-defense";
    const currentMissionId = stateRef.current?.storyMissionId ?? null;
    const s = createState(arenaSize.width, arenaSize.height, undefined, currentMode);
    stateRef.current = s;
    gameOverSavedRef.current = false;
    missionSavedRef.current = false;
    bossScoreSubmittedRef.current = false;
    setBossScoreState({ phase: "idle" });
    setMissionComplete(false);
    if (currentMode === "story" && currentMissionId != null) {
      setupStoryMission(s, currentMissionId);
    }
    storage.setItem(SAVE_KEY, "");
    startWave(s);
    showBanner();
    if (currentMode === "story") {
      sfx.missionStart();
    } else {
      sfx.waveStart();
    }
    forceTick();
  };

  const handleBossScoreSubmit = useCallback(async (name: string, wave: number, kills: number, scrap: number) => {
    const trimmed = name.trim().slice(0, 24) || "PILOT";
    await storage.setItem(PLAYER_NAME_KEY, trimmed).catch(() => {});
    setBossPlayerName(trimmed);
    setBossScoreState({ phase: "submitting", wave, kills, scrap, name: trimmed });
    const result = await submitBossRushScore(trimmed, wave, kills, scrap);
    setBossScoreState({
      phase: "done",
      ranked: result?.ranked ?? false,
      rank: result?.rank ?? null,
    });
  }, []);

  const handleNextMission = () => {
    const s = stateRef.current;
    if (!s) return;
    const nextId = (s.storyMissionId ?? 0) + 1;
    missionSavedRef.current = false;
    setMissionComplete(false);
    router.replace({
      pathname: "/game",
      params: { newGame: "1", gameMode: "story", missionId: String(nextId) },
    } as any);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    (window as any).__testHooks = {
      isReady: () => !!stateRef.current,
      getStatus: () => stateRef.current?.status ?? null,
      getBounties: () =>
        (stateRef.current?.activeBounties ?? []).map((b) => ({
          templateId: b.templateId,
          name: b.name,
          state: b.state,
          progress: b.progress,
          target: b.target,
        })),
      triggerKills: (count: number) => {
        const st = stateRef.current;
        if (!st) return false;
        st.stats.kills = count;
        tickBountyProgress(st);
        forceTick();
        return true;
      },
      ensureBounty: (templateId: string) => {
        const st = stateRef.current;
        if (!st) return false;
        if (st.activeBounties.find((b) => b.templateId === templateId)) return true;
        const template = BOUNTY_POOL.find((t) => t.id === templateId);
        if (!template) return false;
        st.activeBounties.push({
          templateId: template.id,
          name: template.name,
          description: template.description,
          progress: 0,
          target: template.target,
          reward: template.reward,
          state: "active",
          completedWave: null,
          justCompleted: false,
          rewardAwarded: false,
        });
        forceTick();
        return true;
      },
      clearWaveUndamaged: () => {
        const st = stateRef.current;
        if (!st) return false;
        st.bountyTracking.tookDamageThisWave = false;
        st.spawnQueue = 0;
        st.zombies = [];
        st.isHorde = false;
        st.hordeWarning = 0;
        st.hordeTimer = 0;
        st.bossWarning = 0;
        st.bossSpawned = true;
        st.status = "waveclear";
        forceTick();
        return true;
      },
      jumpToShop: () => {
        const st = stateRef.current;
        if (!st) return false;
        st.spawnQueue = 0;
        st.zombies = [];
        st.status = "shop";
        forceTick();
        return true;
      },
      triggerBossRushGameOver: (wave = 3, kills = 15, scrap = 500) => {
        const st = stateRef.current;
        if (!st) return false;
        st.gameMode = "boss-rush" as GameMode;
        st.stats.wavesCleared = wave;
        st.stats.kills = kills;
        st.stats.totalScrap = scrap;
        st.spawnQueue = 0;
        st.zombies = [];
        st.status = "gameover";
        // Skip the RAF-based detection and set score panel state directly
        gameOverSavedRef.current = true;
        bossScoreSubmittedRef.current = true;
        setBossScoreState({ phase: "enter-name", wave, kills, scrap });
        forceTick();
        return true;
      },
    };
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__testHooks;
      }
    };
  }, [forceTick]);

  const s = stateRef.current;
  const screenFlashOpacity = s ? Math.min(0.5, s.flash.screen) : 0;

  return (
    <View style={styles.root} testID="game-screen">
      {s && <Arena state={s} onDebugChange={(v) => { wallDebugEnabledRef.current = v; }} />}

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {s && <HUD state={s} onPause={handlePause} onEquip={onEquipWeapon} />}
        {s && s.status === "playing" && (
          <DeployBar state={s} onThrow={onThrow} onTurret={onTurret} />
        )}

        {s && s.status === "playing" && (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              bottom: insets.bottom + 24,
              left: 0, right: 0,
              alignItems: "center",
            }}
          >
            <AbilityButton state={s} onUse={onUseAbility} />
          </View>
        )}

        {s && (
          <View
            pointerEvents="box-none"
            style={[styles.fireWrap, { bottom: insets.bottom + 24, right: 24 }]}
          >
            <FireButton
              ammo={Math.floor(s.player.ammo)}
              maxAmmo={s.player.maxAmmo}
              reloading={s.player.reloading}
              overdrive={s.player.overdrive > 0}
              equippedWeapon={s.equippedWeapon}
              laserCharge={s.player.laserCharge}
              laserCharging={s.player.laserCharging}
              onPress={onFireTap}
              onHoldStart={onHoldStart}
              onHoldEnd={onHoldEnd}
              onReload={onReload}
            />
          </View>
        )}

        <View
          pointerEvents="box-none"
          style={[styles.joystickWrap, { bottom: insets.bottom + 24, left: 24 }]}
        >
          <Joystick onMove={onJoystickMove} />
        </View>

        {waveBannerVisible && s && <WaveBanner wave={s.wave} />}

        {bountyFlash && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "30%",
              left: 0,
              right: 0,
              alignItems: "center",
              opacity: bountyFlashAnim,
            }}
          >
            <View style={{
              backgroundColor: "rgba(8,8,8,0.92)",
              borderWidth: 2,
              borderColor: "#F39C12",
              paddingHorizontal: 20,
              paddingVertical: 12,
              alignItems: "center",
              gap: 4,
            }}>
              <Text style={{ color: "#F39C12", fontSize: 10, letterSpacing: 3, fontFamily: "Courier", fontWeight: "900" }}>
                ✓ BOUNTY COMPLETE
              </Text>
              <Text style={{ color: "#EAEAEA", fontSize: 14, letterSpacing: 2, fontFamily: "Courier", fontWeight: "900" }}>
                {bountyFlash.name}
              </Text>
              <Text style={{ color: "#39FF14", fontSize: 12, letterSpacing: 1, fontFamily: "Courier", fontWeight: "800" }}>
                +{bountyFlash.reward} SCRAP
              </Text>
            </View>
          </Animated.View>
        )}

        {s?.status === "playing" && s.isHorde && s.hordeWarning > 0 && (
          <HordeWarning />
        )}
        {s?.status === "playing" &&
          s.isHorde &&
          s.hordeWarning <= 0 &&
          s.hordeTimer > 0 && <HordeCountdown seconds={s.hordeTimer} />}

        {s?.status === "playing" && s.bossWarning > 0 && <BossWarning />}

        {s?.status === "paused" && !scrapyardOpen && (
          <PauseOverlay
            onResume={handleResume}
            onSave={handleSave}
            onAbort={handleAbort}
            onScrapyard={handleScrapyardFromPause}
          />
        )}

        {s?.status === "paused" && scrapyardOpen && (
          <ScrapyardShop
            bestWave={s.stats.wavesCleared}
            onClose={handleCloseScrapyard}
            onEquip={handleUniformEquip}
          />
        )}

        {s?.status === "shop" && (
          <UpgradeShop
            state={s}
            forceTick={forceTick}
            onDeploy={handleDeploy}
            onSave={handleSave}
          />
        )}

        <Animated.View
          pointerEvents="none"
          style={[styles.savedBadge, { opacity: savedFadeAnim }]}
        >
          <Text style={styles.savedText}>✦ PROGRESS SAVED</Text>
        </Animated.View>

        {s?.status === "gameover" && (
          <GameOverOverlay
            state={s}
            best={bestRef.current}
            gameMode={s.gameMode}
            onRestart={handleRestart}
            onMenu={handleAbort}
            onRevive={handleRevive}
          />
        )}

        {s?.status === "gameover" && s.gameMode === "boss-rush" && bossScoreState.phase !== "idle" && (
          <View style={bossStyles.scorePanel} pointerEvents="box-none">
            <View style={bossStyles.scoreBox} pointerEvents="auto">
              {bossScoreState.phase === "enter-name" && (
                <>
                  <Text style={bossStyles.scoreTag}>[ BOSS RUSH LEADERBOARD ]</Text>
                  <Text style={bossStyles.scoreTitle}>SUBMIT SCORE</Text>
                  <Text style={bossStyles.scoreWave}>WAVE {bossScoreState.wave}</Text>
                  <TextInput
                    style={bossStyles.nameInput}
                    value={bossPlayerName}
                    onChangeText={setBossPlayerName}
                    placeholder="ENTER CALLSIGN"
                    placeholderTextColor="#444"
                    maxLength={24}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={() =>
                      handleBossScoreSubmit(
                        bossPlayerName,
                        bossScoreState.wave,
                        bossScoreState.kills,
                        bossScoreState.scrap,
                      )
                    }
                  />
                  <View style={bossStyles.btnRow}>
                    <TouchableOpacity
                      style={bossStyles.skipBtn}
                      onPress={() => setBossScoreState({ phase: "idle" })}
                      activeOpacity={0.8}
                    >
                      <Text style={bossStyles.skipBtnTxt}>SKIP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={bossStyles.submitBtn}
                      onPress={() =>
                        handleBossScoreSubmit(
                          bossPlayerName,
                          bossScoreState.wave,
                          bossScoreState.kills,
                          bossScoreState.scrap,
                        )
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={bossStyles.submitBtnTxt}>SUBMIT ▸</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {bossScoreState.phase === "submitting" && (
                <>
                  <Text style={bossStyles.scoreTag}>[ BOSS RUSH LEADERBOARD ]</Text>
                  <Text style={bossStyles.scoreTitle}>TRANSMITTING...</Text>
                  <Text style={bossStyles.scoreWave}>WAVE {bossScoreState.wave}</Text>
                </>
              )}
              {bossScoreState.phase === "done" && (
                <>
                  <Text style={bossStyles.scoreTag}>[ BOSS RUSH LEADERBOARD ]</Text>
                  {bossScoreState.ranked && bossScoreState.rank != null ? (
                    <>
                      <Text style={[bossStyles.scoreTitle, { color: "#F39C12" }]}>
                        RANKED #{bossScoreState.rank}
                      </Text>
                      <Text style={bossStyles.scoreSub}>You made the top 10. Well done.</Text>
                    </>
                  ) : (
                    <>
                      <Text style={bossStyles.scoreTitle}>SCORE LOGGED</Text>
                      <Text style={bossStyles.scoreSub}>Not in the top 10 this time.</Text>
                    </>
                  )}
                  <TouchableOpacity
                    style={bossStyles.submitBtn}
                    onPress={() => setBossScoreState({ phase: "idle" })}
                    activeOpacity={0.8}
                  >
                    <Text style={bossStyles.submitBtnTxt}>CONTINUE</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {missionComplete && s && (
          <MissionCompleteOverlay
            state={s}
            onNext={handleNextMission}
            onReplay={handleRestart}
            onMenu={handleAbort}
          />
        )}
      </SafeAreaView>

      {screenFlashOpacity > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.damageFlash,
            { opacity: screenFlashOpacity },
          ]}
        />
      )}
    </View>
  );
}

type MissionCompleteProps = {
  state: GameState;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
};

function MissionCompleteOverlay({ state, onNext, onReplay, onMenu }: MissionCompleteProps) {
  const mission = getMission(state.storyMissionId ?? -1);
  const isLastMission = (state.storyMissionId ?? 0) >= 6;
  const reward = mission?.reward ?? { scrap: 0, label: "" };

  return (
    <View style={mcStyles.root}>
      <View style={mcStyles.panel}>
        <View style={[mcStyles.corner, { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[mcStyles.corner, { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 }]} />
        <View style={[mcStyles.corner, { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[mcStyles.corner, { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 }]} />

        <Text style={mcStyles.tag}>[ MISSION COMPLETE ]</Text>
        <Text style={mcStyles.title}>
          {isLastMission ? "CAMPAIGN COMPLETE" : mission?.title ?? "MISSION"}
        </Text>
        {mission && (
          <Text style={mcStyles.codename}>{mission.codename}</Text>
        )}

        <View style={mcStyles.divider} />

        <View style={mcStyles.statsRow}>
          <StatItem label="KILLS" value={String(state.stats.kills)} color="#FF2A2A" />
          <StatItem label="SCRAP" value={String(state.stats.totalScrap)} color="#F39C12" />
          <StatItem label="WAVES" value={String(state.stats.wavesCleared)} color="#00FFFF" />
        </View>

        <View style={mcStyles.rewardBox}>
          <Text style={mcStyles.rewardLabel}>[ MISSION REWARD ]</Text>
          <Text style={mcStyles.rewardValue}>+{reward.scrap} SCRAP · {reward.label}</Text>
        </View>

        <View style={mcStyles.btnRow}>
          <TouchableOpacity style={mcStyles.menuBtn} onPress={onMenu} activeOpacity={0.8}>
            <Text style={mcStyles.menuBtnTxt}>MENU</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mcStyles.replayBtn} onPress={onReplay} activeOpacity={0.8}>
            <Text style={mcStyles.replayBtnTxt}>REPLAY</Text>
          </TouchableOpacity>
          {!isLastMission && (
            <TouchableOpacity style={mcStyles.nextBtn} onPress={onNext} activeOpacity={0.8}>
              <Text style={mcStyles.nextBtnTxt}>NEXT ▸</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ alignItems: "center", gap: 3 }}>
      <Text style={[mcStyles.statValue, { color }]}>{value}</Text>
      <Text style={mcStyles.statLabel}>{label}</Text>
    </View>
  );
}

const mcStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,4,6,0.90)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  panel: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0A0A0A",
    borderWidth: 2,
    borderColor: "#39FF14",
    padding: 28,
    gap: 16,
    alignItems: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 16,
    height: 16,
    borderColor: "#39FF14",
  },
  tag: {
    color: "#39FF14",
    fontSize: 9,
    letterSpacing: 4,
    fontFamily: "Courier",
    fontWeight: "900",
  },
  title: {
    color: "#EAEAEA",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
  },
  codename: {
    color: "#39FF14",
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: "Courier",
    marginTop: -8,
  },
  divider: {
    borderTopWidth: 1,
    borderColor: "#222",
    width: "100%",
  },
  statsRow: {
    flexDirection: "row",
    gap: 32,
    justifyContent: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    fontFamily: "Courier",
  },
  statLabel: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  rewardBox: {
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  rewardLabel: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  rewardValue: {
    color: "#F39C12",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: "Courier",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    width: "100%",
  },
  menuBtn: {
    borderWidth: 1,
    borderColor: "#444",
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: "center",
  },
  menuBtnTxt: {
    color: "#7A7A7A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  replayBtn: {
    borderWidth: 1,
    borderColor: "#D35400",
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: "center",
  },
  replayBtnTxt: {
    color: "#D35400",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  nextBtn: {
    backgroundColor: "#39FF14",
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: "center",
  },
  nextBtnTxt: {
    color: "#080808",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
});

const bossStyles = StyleSheet.create({
  scorePanel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  scoreBox: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0C0900",
    borderWidth: 1,
    borderColor: "#F39C12",
    padding: 18,
    gap: 10,
    alignItems: "center",
  },
  scoreTag: {
    color: "#F39C12",
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  scoreTitle: {
    color: "#EAEAEA",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  scoreWave: {
    color: "#F39C12",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  scoreSub: {
    color: "#7A7A7A",
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: "Courier",
  },
  nameInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#F39C12",
    backgroundColor: "#080808",
    color: "#EAEAEA",
    fontFamily: "Courier",
    fontSize: 14,
    letterSpacing: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 11,
    alignItems: "center",
  },
  skipBtnTxt: {
    color: "#555",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  submitBtn: {
    flex: 2,
    backgroundColor: "#F39C12",
    paddingVertical: 11,
    alignItems: "center",
  },
  submitBtnTxt: {
    color: "#080808",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
    ...(Platform.OS === "web" ? {
      userSelect: "none",
      WebkitUserSelect: "none",
      WebkitTouchCallout: "none",
    } as any : {}),
  },
  joystickWrap: { position: "absolute" },
  fireWrap: { position: "absolute", flexDirection: "row", alignItems: "flex-end" },
  damageFlash: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "#FF2A2A",
    borderWidth: 8,
  },
  savedBadge: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none" as any,
  },
  savedText: {
    color: "#27AE60",
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: "Courier",
    fontWeight: "700",
    backgroundColor: "rgba(8,8,8,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#27AE60",
  },
});
