import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { storage } from "@/src/utils/storage";
import { BEST_KEY, SAVE_KEY } from "@/src/game/storage";
import type { SaveData } from "@/src/game/engine";
import type { GameMode } from "@/src/game/types";
import { initSound } from "@/src/utils/sound";
import ScrapyardShop, { loadEquippedUniform } from "@/src/components/ScrapyardShop";
import SettingsPanel from "@/src/components/SettingsPanel";
import ModeSelect from "@/src/components/ModeSelect";
import { UNIFORMS, UniformId } from "@/src/game/uniforms";

const MENU_BG = require("../assets/images/menu-bg.png");

type Best = { wave: number; scrap: number; kills: number };

export default function MainMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [best, setBest] = useState<Best | null>(null);
  const [save, setSave] = useState<SaveData | null>(null);
  const [showScrapyard, setShowScrapyard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [equippedUniform, setEquippedUniform] = useState<UniformId>("standard");

  useEffect(() => {
    initSound().catch(() => {});
    (async () => {
      const bestRaw = await storage.getItem<string>(BEST_KEY, "");
      if (bestRaw && typeof bestRaw === "string" && bestRaw.length > 0) {
        try { setBest(JSON.parse(bestRaw)); } catch {}
      }
      const saveRaw = await storage.getItem<string>(SAVE_KEY, "");
      if (saveRaw && typeof saveRaw === "string" && saveRaw.length > 0) {
        try { setSave(JSON.parse(saveRaw)); } catch {}
      }
      const uniformId = await loadEquippedUniform();
      setEquippedUniform(uniformId);
    })();
  }, []);

  const refreshUniform = async () => {
    const uniformId = await loadEquippedUniform();
    setEquippedUniform(uniformId);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleContinue = () => router.replace("/game");

  const handleModeSelected = (mode: GameMode) => {
    setSave(null);
    router.replace({
      pathname: "/game",
      params: { newGame: "1", gameMode: mode },
    } as any);
  };
  const handleRigDefence = () => {
    router.replace({ pathname: "/game", params: { newGame: "1" } } as any);
  };
  const handleLoad = () => {
    if (save) {
      router.replace("/game");
    } else {
      Alert.alert("[ LOAD ]", "No save data found.", [{ text: "COPY THAT", style: "cancel" }]);
    }
  };
  const handleNewGame = () => setShowModeSelect(true);

  const uniformDef = UNIFORMS[equippedUniform];

  if (showScrapyard) {
    return (
      <ScrapyardShop
        bestWave={best?.wave ?? 0}
        onClose={() => { setShowScrapyard(false); refreshUniform(); }}
      />
    );
  }

  if (showModeSelect) {
    return (
      <ModeSelect
        onSelect={handleModeSelected}
        onBack={() => setShowModeSelect(false)}
      />
    );
  }

  return (
    <ImageBackground source={MENU_BG} style={styles.root} resizeMode="cover">
      {/* Dark overlay for readability */}
      <View style={styles.overlay} />

      <View style={[styles.ui, { paddingTop: topPad + 8, paddingBottom: botPad + 8 }]}>

        {/* ── TOP ROW: logo left / continue right ── */}
        <View style={styles.topRow}>
          <View style={styles.logoBlock}>
            <View style={styles.logoBorder}>
              <Text style={styles.logoMain}>LAST SCRAP</Text>
              <Text style={styles.logoSub}>COLLECT · BUILD · SURVIVE</Text>
            </View>
          </View>

          {save && save.gameMode !== "story" && (
            <TouchableOpacity
              testID="continue-btn"
              style={styles.continueBtn}
              activeOpacity={0.78}
              onPress={handleContinue}
            >
              <View style={[styles.boltCorner, { top: 4, left: 4, backgroundColor: "#9D3E00" }]} />
              <View style={[styles.boltCorner, { top: 4, right: 4, backgroundColor: "#9D3E00" }]} />
              <View style={[styles.boltCorner, { bottom: 4, left: 4, backgroundColor: "#9D3E00" }]} />
              <View style={[styles.boltCorner, { bottom: 4, right: 4, backgroundColor: "#9D3E00" }]} />
              <Text style={styles.continueTxt}>CONTINUE</Text>
              <Text style={styles.continueWave}>WAVE {save.wave + 1}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── MIDDLE ROW: stats left / main modes right ── */}
        <View style={styles.midRow}>
          <View style={styles.leftCol}>
            {best && (
              <View style={styles.statsBlock} testID="best-scores">
                <Text style={styles.statsLabel}>[ RECORD ]</Text>
                <View style={styles.statsRow}>
                  <StatPill icon="waves" value={`W${best.wave}`} />
                  <StatPill icon="nut" value={`${best.scrap}S`} />
                  <StatPill icon="skull" value={`${best.kills}K`} />
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[styles.uniformPill, { borderColor: uniformDef.color + "88" }]}
              activeOpacity={0.7}
              onPress={() => setShowScrapyard(true)}
            >
              <MaterialCommunityIcons name="tshirt-crew" size={12} color={uniformDef.color} />
              <Text style={[styles.uniformPillText, { color: uniformDef.color }]}>{uniformDef.name}</Text>
              <Text style={styles.uniformSub}>UNIFORM</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rightCol}>
            <BoltButton
              testID="start-game-btn"
              label="RIG DEFENCE"
              onPress={handleRigDefence}
              primary
            />
          </View>
        </View>

        {/* ── BOTTOM ROW: new game / load left / settings right ── */}
        <View style={styles.bottomRow}>
          <View style={styles.bottomLeft}>
            <BoltButton
              label="NEW GAME"
              onPress={handleNewGame}
            />
            <BoltButton
              label="LOAD"
              onPress={handleLoad}
            />
          </View>

          <View style={styles.bottomRight}>
            <TouchableOpacity
              testID="settings-btn"
              style={styles.gearBtn}
              activeOpacity={0.7}
              onPress={() => setShowSettings(true)}
            >
              <Ionicons name="settings-sharp" size={28} color="#D35400" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="scrapyard-btn"
              style={styles.gearBtn}
              activeOpacity={0.7}
              onPress={() => setShowScrapyard(true)}
            >
              <MaterialCommunityIcons name="store" size={26} color="#7A7A7A" />
            </TouchableOpacity>
          </View>
        </View>

      </View>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </ImageBackground>
  );
}

function BoltButton({
  label, onPress, primary, badge, testID,
}: {
  label: string; onPress: () => void; primary?: boolean; badge?: string; testID?: string;
}) {
  const boltColor = primary ? "#9D3E00" : "#D35400";
  const borderColor = primary ? "#FF6B1A" : "#D35400";
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.boltBtn, primary ? styles.boltBtnPrimary : styles.boltBtnSecondary]}
      activeOpacity={0.72}
      onPress={onPress}
    >
      <View style={[styles.boltCorner, { top: 4, left: 4, backgroundColor: boltColor }]} />
      <View style={[styles.boltCorner, { top: 4, right: 4, backgroundColor: boltColor }]} />
      <View style={[styles.boltCorner, { bottom: 4, left: 4, backgroundColor: boltColor }]} />
      <View style={[styles.boltCorner, { bottom: 4, right: 4, backgroundColor: boltColor }]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[styles.boltTxt, primary ? styles.boltTxtPrimary : { color: "#D35400" }]}>
          {label}
        </Text>
        {badge && (
          <View style={[styles.boltBadge, { backgroundColor: borderColor + "44" }]}>
            <Text style={[styles.boltBadgeTxt, { color: borderColor }]}>{badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function StatPill({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <MaterialCommunityIcons name={icon as any} size={12} color="#D35400" />
      <Text style={styles.statPillTxt}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,4,6,0.62)",
  },
  ui: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },

  /* TOP ROW */
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  logoBlock: {},
  logoBorder: {
    borderWidth: 2,
    borderColor: "#D35400",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(8,4,0,0.72)",
  },
  logoMain: {
    color: "#D35400",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 6,
    fontFamily: "Courier",
    lineHeight: 30,
  },
  logoSub: {
    color: "#EAEAEA",
    fontSize: 9,
    letterSpacing: 3,
    fontFamily: "Courier",
    marginTop: 4,
  },
  continueBtn: {
    backgroundColor: "#D35400",
    borderWidth: 2,
    borderColor: "#FF6B1A",
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    minWidth: 120,
  },
  continueTxt: {
    color: "#080808",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  continueWave: {
    color: "rgba(8,8,8,0.6)",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
    marginTop: 2,
  },

  /* MID ROW */
  midRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flex: 1,
    marginVertical: 24,
  },
  leftCol: {
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  rightCol: {
    gap: 10,
    alignItems: "flex-end",
  },
  statsBlock: {
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "rgba(8,8,8,0.7)",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statsLabel: {
    color: "#D35400",
    fontSize: 8,
    letterSpacing: 3,
    fontFamily: "Courier",
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statPillTxt: {
    color: "#EAEAEA",
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "Courier",
  },
  uniformPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "rgba(8,8,8,0.7)",
    alignSelf: "flex-start",
  },
  uniformPillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  uniformSub: {
    color: "#444",
    fontSize: 8,
    letterSpacing: 2,
    fontFamily: "Courier",
    marginLeft: 2,
  },

  /* BOLT-CORNER BUTTONS */
  boltBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    paddingVertical: 13,
    paddingHorizontal: 20,
    minWidth: 170,
    position: "relative",
  },
  boltBtnPrimary: {
    backgroundColor: "#D35400",
    borderColor: "#FF6B1A",
  },
  boltBtnSecondary: {
    backgroundColor: "rgba(6,4,2,0.90)",
    borderColor: "#D35400",
  },
  boltCorner: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  boltTxt: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  boltTxtPrimary: {
    color: "#0A0502",
  },
  boltBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  boltBadgeTxt: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: "Courier",
  },

  /* BOTTOM ROW */
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bottomLeft: {
    gap: 8,
  },
  bottomRight: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  gearBtn: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "rgba(8,8,8,0.7)",
  },
});
