import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { storage } from "@/src/utils/storage";
import { BEST_KEY, BEST_KEY_BOSS, BEST_KEY_SCAVENGE } from "@/src/game/storage";
import type { GameMode } from "@/src/game/types";
import { fetchBossRushLeaderboard, type LeaderboardEntry } from "@/src/utils/leaderboard";
import { loadCampaignProgress } from "@/src/components/StoryModeSelect";
import { MISSIONS } from "@/src/game/missions";

type Best = { wave: number; scrap: number; kills: number };

type CardProps = {
  tag: string;
  title: string;
  description: string;
  bestLabel: string;
  bestValue: string;
  accentColor: string;
  icon: React.ReactNode;
  onPress: () => void;
};

function ModeCard({ tag, title, description, bestLabel, bestValue, accentColor, icon, onPress }: CardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: accentColor + "50" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>{icon}</View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTag, { color: accentColor }]}>{tag}</Text>
          <Text style={[styles.cardTitle, { color: accentColor }]}>{title}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc}>{description}</Text>
      <View style={[styles.cardFooter, { borderTopColor: accentColor + "25" }]}>
        <Text style={styles.cardBestLabel}>{bestLabel}</Text>
        <Text style={[styles.cardBestValue, { color: bestValue === "—" ? "#444" : "#EAEAEA" }]}>
          {bestValue}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function BossRushLeaderboardPanel() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fetchBossRushLeaderboard().then((data) => {
      if (!cancelled) {
        setEntries(data);
        setRefreshing(false);
      }
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleRefresh = () => {
    if (!refreshing) setRefreshKey((k) => k + 1);
  };

  return (
    <View style={lbStyles.panel}>
      <View style={lbStyles.header}>
        <Text style={lbStyles.headerText}>[ BOSS RUSH · GLOBAL TOP 10 ]</Text>
        <TouchableOpacity
          style={lbStyles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.6}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#F39C12" style={lbStyles.refreshSpinner} />
          ) : (
            <Ionicons name="refresh" size={13} color="#F39C12" />
          )}
        </TouchableOpacity>
      </View>

      {entries === null ? (
        <View style={lbStyles.loading}>
          <ActivityIndicator size="small" color="#F39C12" />
        </View>
      ) : entries.length === 0 ? (
        <View style={lbStyles.empty}>
          <Text style={lbStyles.emptyText}>NO ENTRIES YET — BE THE FIRST</Text>
        </View>
      ) : (
        <View style={lbStyles.rows}>
          {entries.map((entry, idx) => (
            <View key={entry.id} style={lbStyles.row}>
              <Text style={[lbStyles.rank, idx === 0 && lbStyles.rankGold]}>
                #{idx + 1}
              </Text>
              <Text style={lbStyles.name} numberOfLines={1}>{entry.playerName}</Text>
              <Text style={lbStyles.wave}>W{entry.wave}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type Props = {
  onSelect: (mode: GameMode) => void;
  onSelectStory: () => void;
  onBack: () => void;
};

export default function ModeSelect({ onSelect, onSelectStory, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [rigBest, setRigBest] = useState<Best | null>(null);
  const [bossBest, setBossBest] = useState<Best | null>(null);
  const [scavengeBest, setScavengeBest] = useState<Best | null>(null);
  const [storyCompleted, setStoryCompleted] = useState<number | null>(null);

  useEffect(() => {
    const parseBest = async (key: string): Promise<Best | null> => {
      const raw = await storage.getItem<string>(key, "");
      if (raw && typeof raw === "string" && raw.length > 0) {
        try { return JSON.parse(raw); } catch {}
      }
      return null;
    };
    Promise.all([
      parseBest(BEST_KEY),
      parseBest(BEST_KEY_BOSS),
      parseBest(BEST_KEY_SCAVENGE),
      loadCampaignProgress(),
    ]).then(([r, b, sc, campaign]) => {
      setRigBest(r);
      setBossBest(b);
      setScavengeBest(sc);
      setStoryCompleted(campaign.completedMissions.length);
    });
  }, []);

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={16} color="#7A7A7A" />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heading}>
        <Text style={styles.headingTag}>[ SELECT OPERATION MODE ]</Text>
        <Text style={styles.headingTitle}>DEPLOY</Text>
        <Text style={styles.headingSub}>Choose your mission parameters.</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.cards}
        showsVerticalScrollIndicator={false}
      >
        <ModeCard
          tag="[ CAMPAIGN ]"
          title="STORY MODE"
          description="7 scripted missions with unique objectives — escape, escort, sabotage, and more. Complete missions to bank permanent scrap bonuses."
          bestLabel="COMPLETED"
          bestValue={storyCompleted != null ? `${storyCompleted}/${MISSIONS.length}` : "—"}
          accentColor="#8E44AD"
          icon={<MaterialCommunityIcons name="map-marker-path" size={22} color="#8E44AD" />}
          onPress={onSelectStory}
        />
        <ModeCard
          tag="[ MODE · 01 ]"
          title="DEFEND THE RIG"
          description="Hold the reactor through endless waves. Survive as long as you can — the scrap economy and upgrade terminal are your lifeline."
          bestLabel="BEST WAVE"
          bestValue={rigBest ? String(rigBest.wave) : "—"}
          accentColor="#D35400"
          icon={<MaterialCommunityIcons name="radioactive" size={22} color="#D35400" />}
          onPress={() => onSelect("rig-defense")}
        />
        <ModeCard
          tag="[ MODE · 02 ]"
          title="BOSS RUSH"
          description="One boss per wave. No escorts. No hordes. Scrap rewards doubled — face the heaviest threats back to back and see how deep you can go."
          bestLabel="BEST WAVE"
          bestValue={bossBest ? String(bossBest.wave) : "—"}
          accentColor="#F39C12"
          icon={<MaterialCommunityIcons name="skull-crossbones" size={22} color="#F39C12" />}
          onPress={() => onSelect("boss-rush")}
        />
        <BossRushLeaderboardPanel />
        <ModeCard
          tag="[ MODE · 03 ]"
          title="SCAVENGE RUN"
          description="No reactor. No last stand. A scrap quota appears each wave — collect it before the clock hits zero. Zombies still hunt you."
          bestLabel="BEST SCRAP"
          bestValue={scavengeBest ? String(scavengeBest.scrap) : "—"}
          accentColor="#39FF14"
          icon={<MaterialCommunityIcons name="nut" size={22} color="#39FF14" />}
          onPress={() => onSelect("scavenge")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
    paddingHorizontal: 28,
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
  heading: {
    alignItems: "center",
    marginBottom: 24,
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
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 6,
  },
  headingSub: {
    color: "#7A7A7A",
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: "Courier",
    marginTop: 8,
  },
  scrollArea: {
    flex: 1,
  },
  cards: {
    gap: 14,
    paddingBottom: 16,
  },
  card: {
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "#333",
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTag: {
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cardDesc: {
    color: "#7A7A7A",
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: "Courier",
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  cardBestLabel: {
    color: "#555",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  cardBestValue: {
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
});

const lbStyles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: "#F39C1230",
    backgroundColor: "#0D0900",
    marginTop: -8,
    marginBottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F39C1225",
  },
  headerText: {
    color: "#F39C12",
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  refreshBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshSpinner: {
    transform: [{ scale: 0.7 }],
  },
  loading: {
    paddingVertical: 14,
    alignItems: "center",
  },
  empty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyText: {
    color: "#444",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  rows: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rank: {
    color: "#555",
    fontSize: 9,
    fontFamily: "Courier",
    width: 22,
  },
  rankGold: {
    color: "#F39C12",
    fontWeight: "900",
  },
  name: {
    flex: 1,
    color: "#AAAAAA",
    fontSize: 10,
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  wave: {
    color: "#F39C12",
    fontSize: 11,
    fontFamily: "Courier",
    fontWeight: "900",
    letterSpacing: 1,
  },
});
