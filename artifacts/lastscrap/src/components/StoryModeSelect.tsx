import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { storage } from "@/src/utils/storage";
import { STORY_KEY } from "@/src/game/storage";
import { MISSIONS, Mission } from "@/src/game/missions";

export type MissionBest = {
  kills: number;
  scrap: number;
  wavesCleared: number;
};

export type CampaignProgress = {
  unlockedMission: number;
  completedMissions: number[];
  bonuses: { missionId: number; label: string }[];
  missionBests: Record<number, MissionBest>;
  scrapBank: number; // accumulated scrap rewards from completed missions
};

export async function loadCampaignProgress(): Promise<CampaignProgress> {
  const raw = await storage.getItem<string>(STORY_KEY, "");
  if (raw && typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw) as CampaignProgress;
      if (!parsed.missionBests) parsed.missionBests = {};
      if (parsed.scrapBank == null) parsed.scrapBank = 0;
      return parsed;
    } catch {}
  }
  return { unlockedMission: 0, completedMissions: [], bonuses: [], missionBests: {}, scrapBank: 0 };
}

export async function saveCampaignProgress(
  missionId: number,
  reward: { scrap: number; label: string },
  best: MissionBest,
): Promise<void> {
  const progress = await loadCampaignProgress();
  if (!progress.completedMissions.includes(missionId)) {
    progress.completedMissions.push(missionId);
    progress.bonuses.push({ missionId, label: reward.label });
    // Permanently bank the scrap reward — applied to future non-story runs
    progress.scrapBank = (progress.scrapBank ?? 0) + reward.scrap;
  }
  // Update per-mission best
  const prev = progress.missionBests[missionId];
  progress.missionBests[missionId] = {
    kills: Math.max(best.kills, prev?.kills ?? 0),
    scrap: Math.max(best.scrap, prev?.scrap ?? 0),
    wavesCleared: Math.max(best.wavesCleared, prev?.wavesCleared ?? 0),
  };
  const nextUnlocked = Math.max(progress.unlockedMission, missionId + 1);
  progress.unlockedMission = Math.min(nextUnlocked, MISSIONS.length - 1);
  await storage.setItem(STORY_KEY, JSON.stringify(progress));
}

const OBJECTIVE_ICON: Record<string, string> = {
  escape: "run-fast",
  scavenge: "nut",
  eliminate: "skull-crossbones",
  hold: "shield-check",
  escort: "account-heart",
  sabotage: "bomb",
  defend: "radioactive",
};

const OBJECTIVE_COLOR: Record<string, string> = {
  escape: "#39FF14",
  scavenge: "#F39C12",
  eliminate: "#FF2A2A",
  hold: "#00FFFF",
  escort: "#27AE60",
  sabotage: "#FF8800",
  defend: "#D35400",
};

type Props = {
  onDeploy: (missionId: number) => void;
  onBack: () => void;
};

export default function StoryModeSelect({ onDeploy, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [progress, setProgress] = useState<CampaignProgress>({
    unlockedMission: 0,
    completedMissions: [],
    bonuses: [],
    missionBests: {},
    scrapBank: 0,
  });
  const [selected, setSelected] = useState<Mission | null>(null);

  useEffect(() => {
    loadCampaignProgress().then(setProgress);
  }, []);

  const handleMissionTap = (mission: Mission) => {
    if (mission.id > progress.unlockedMission) return;
    setSelected(mission);
  };

  const handleDeploy = () => {
    if (!selected) return;
    onDeploy(selected.id);
  };

  const color = selected
    ? OBJECTIVE_COLOR[selected.objectiveType]
    : "#D35400";

  if (selected) {
    const isCompleted = progress.completedMissions.includes(selected.id);
    return (
      <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad }]}>
        <CornerBolts />
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelected(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color="#7A7A7A" />
            <Text style={styles.backText}>MISSIONS</Text>
          </TouchableOpacity>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeTxt}>✓ COMPLETED</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.briefingContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.briefingHeader}>
            <View style={[styles.briefingIconWrap, { borderColor: color + "55" }]}>
              <MaterialCommunityIcons
                name={OBJECTIVE_ICON[selected.objectiveType] as any}
                size={32}
                color={color}
              />
            </View>
            <View style={styles.briefingHeaderText}>
              <Text style={[styles.briefingCodename, { color: color }]}>
                {selected.codename}
              </Text>
              <Text style={styles.briefingMissionNum}>
                [ MISSION {selected.id + 1} / {MISSIONS.length} ]
              </Text>
              <Text style={[styles.briefingTitle, { color }]}>
                {selected.title}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.flavorLabel}>[ INTEL ]</Text>
          <Text style={styles.flavorText}>{selected.flavorText}</Text>

          <View style={styles.objBox}>
            <Text style={[styles.objLabel, { color }]}>[ OBJECTIVE ]</Text>
            <Text style={styles.objText}>{selected.objectiveSummary}</Text>
          </View>

          <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>[ MISSION REWARD ]</Text>
            <View style={styles.rewardRow}>
              <MaterialCommunityIcons name="nut" size={14} color="#F39C12" />
              <Text style={styles.rewardValue}>+{selected.reward.scrap} SCRAP</Text>
              <Text style={styles.rewardSub}>{selected.reward.label}</Text>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.deployBtn, { backgroundColor: color }]}
          onPress={handleDeploy}
          activeOpacity={0.8}
        >
          <View style={[styles.boltCorner, { top: 4, left: 4, backgroundColor: "rgba(0,0,0,0.3)" }]} />
          <View style={[styles.boltCorner, { top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.3)" }]} />
          <View style={[styles.boltCorner, { bottom: 4, left: 4, backgroundColor: "rgba(0,0,0,0.3)" }]} />
          <View style={[styles.boltCorner, { bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.3)" }]} />
          <Ionicons name="play" size={16} color="#080808" />
          <Text style={styles.deployBtnText}>
            {isCompleted ? "REPLAY MISSION" : "DEPLOY"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad }]}>
      <CornerBolts />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={16} color="#7A7A7A" />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heading}>
        <Text style={styles.headingTag}>[ CAMPAIGN ]</Text>
        <Text style={styles.headingTitle}>STORY MODE</Text>
        <Text style={styles.headingSub}>
          {progress.completedMissions.length} / {MISSIONS.length} MISSIONS COMPLETE
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {MISSIONS.map((m) => {
          const unlocked = m.id <= progress.unlockedMission;
          const completed = progress.completedMissions.includes(m.id);
          const accent = OBJECTIVE_COLOR[m.objectiveType];
          return (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.missionRow,
                unlocked
                  ? { borderColor: accent + "40" }
                  : styles.missionRowLocked,
              ]}
              onPress={() => handleMissionTap(m)}
              activeOpacity={unlocked ? 0.75 : 1}
            >
              <View
                style={[
                  styles.missionNum,
                  { backgroundColor: unlocked ? accent + "22" : "rgba(30,30,30,0.6)" },
                ]}
              >
                {unlocked ? (
                  <MaterialCommunityIcons
                    name={OBJECTIVE_ICON[m.objectiveType] as any}
                    size={16}
                    color={accent}
                  />
                ) : (
                  <Ionicons name="lock-closed" size={14} color="#444" />
                )}
              </View>

              <View style={styles.missionInfo}>
                <Text
                  style={[
                    styles.missionTitle,
                    { color: unlocked ? "#EAEAEA" : "#444" },
                  ]}
                >
                  {unlocked ? m.title : "[ CLASSIFIED ]"}
                </Text>
                <Text
                  style={[
                    styles.missionCodename,
                    { color: unlocked ? accent : "#333" },
                  ]}
                >
                  {unlocked ? m.codename : "████████████"}
                </Text>
              </View>

              <View style={styles.missionStatus}>
                {completed && (
                  <View style={styles.completedPill}>
                    <Text style={styles.completedPillTxt}>✓</Text>
                  </View>
                )}
                {unlocked && !completed && (
                  <Ionicons name="chevron-forward" size={14} color="#555" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CornerBolts() {
  return (
    <>
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
    paddingHorizontal: 24,
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#D35400",
  },
  cornerTL: { top: 16, left: 16, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 16, right: 16, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 2, borderRightWidth: 2 },
  topBar: {
    paddingTop: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  backText: {
    color: "#7A7A7A",
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  completedBadge: {
    borderWidth: 1,
    borderColor: "#39FF14",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedBadgeTxt: {
    color: "#39FF14",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  heading: {
    alignItems: "center",
    marginBottom: 20,
  },
  headingTag: {
    color: "#D35400",
    fontSize: 9,
    letterSpacing: 4,
    fontFamily: "Courier",
    marginBottom: 8,
  },
  headingTitle: {
    color: "#EAEAEA",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 6,
  },
  headingSub: {
    color: "#555",
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "Courier",
    marginTop: 6,
  },
  scrollArea: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 16 },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    padding: 14,
    backgroundColor: "rgba(12,10,8,0.9)",
  },
  missionRowLocked: {
    borderColor: "#222",
  },
  missionNum: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  missionInfo: {
    flex: 1,
    gap: 3,
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  missionCodename: {
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  missionStatus: {
    alignItems: "center",
    justifyContent: "center",
  },
  completedPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(57,255,20,0.2)",
    borderWidth: 1,
    borderColor: "#39FF14",
    alignItems: "center",
    justifyContent: "center",
  },
  completedPillTxt: {
    color: "#39FF14",
    fontSize: 10,
    fontWeight: "900",
  },
  briefingContent: {
    gap: 16,
    paddingBottom: 16,
  },
  briefingHeader: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  briefingIconWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexShrink: 0,
  },
  briefingHeaderText: {
    flex: 1,
    gap: 2,
  },
  briefingCodename: {
    fontSize: 9,
    letterSpacing: 3,
    fontFamily: "Courier",
    fontWeight: "900",
  },
  briefingMissionNum: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 2,
    fontFamily: "Courier",
    marginTop: 2,
  },
  briefingTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: 2,
  },
  divider: {
    borderTopWidth: 1,
    borderColor: "#222",
  },
  flavorLabel: {
    color: "#D35400",
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
    marginBottom: 4,
  },
  flavorText: {
    color: "#9A9A9A",
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: "Courier",
    lineHeight: 18,
  },
  objBox: {
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "rgba(20,18,16,0.8)",
    padding: 14,
    gap: 6,
  },
  objLabel: {
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
    fontWeight: "900",
  },
  objText: {
    color: "#EAEAEA",
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: "Courier",
    lineHeight: 18,
  },
  rewardBox: {
    borderTopWidth: 1,
    borderColor: "#222",
    paddingTop: 12,
    gap: 6,
  },
  rewardLabel: {
    color: "#555",
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rewardValue: {
    color: "#F39C12",
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  rewardSub: {
    color: "#555",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  deployBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    position: "relative",
    marginTop: 12,
  },
  boltCorner: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  deployBtnText: {
    color: "#080808",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
});
