import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { UNIFORMS, UNIFORM_ORDER, UniformId } from "../game/uniforms";
import { storage } from "../utils/storage";
import { purchaseUniform, getEntitlements, watchForPurchaseReturn } from "../utils/stripe";

const OWNED_UNIFORMS_KEY = "lastscrap_owned_uniforms";
const EQUIPPED_UNIFORM_KEY = "lastscrap_equipped_uniform";

type Props = {
  onClose: () => void;
  bestWave?: number;
  onEquip?: (id: UniformId) => void;
};

function perkIcon(perk: string): string {
  if (perk.includes("damage") || perk.includes("dmg")) return "sword";
  if (perk.includes("move") || perk.includes("speed")) return "run-fast";
  if (perk.includes("ammo") || perk.includes("reload")) return "ammunition";
  if (perk.includes("cheaper") || perk.includes("%")) return "sale";
  if (perk.includes("scrap") || perk.includes("Scrap")) return "nut";
  if (perk.includes("grenade") || perk.includes("Grenade")) return "grenade";
  if (perk.includes("turret") || perk.includes("Turret")) return "cctv";
  if (perk.includes("pistol") || perk.includes("PISTOL")) return "pistol";
  if (perk.includes("Magnetizer") || perk.includes("magnet")) return "magnet";
  if (perk.includes("horde") || perk.includes("Horde")) return "skull-crossbones";
  if (perk.includes("defense") || perk.includes("Defense")) return "shield-half-full";
  if (perk.includes("Zombie") || perk.includes("zombie")) return "biohazard";
  return "check-bold";
}

export default function ScrapyardShop({ onClose, bestWave = 0, onEquip }: Props) {
  const [ownedUniforms, setOwnedUniforms] = useState<UniformId[]>(["standard"]);
  const [equippedUniform, setEquippedUniform] = useState<UniformId>("standard");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<UniformId | null>(null);

  const loadData = useCallback(async () => {
    const ownedRaw = await storage.getItem<string>(OWNED_UNIFORMS_KEY, "");
    const equippedRaw = await storage.getItem<string>(EQUIPPED_UNIFORM_KEY, "");

    let owned: UniformId[] = ["standard"];
    if (ownedRaw && typeof ownedRaw === "string" && ownedRaw.length > 0) {
      try {
        const parsed = JSON.parse(ownedRaw) as UniformId[];
        if (!parsed.includes("standard")) parsed.unshift("standard");
        owned = parsed;
      } catch {}
    }

    // Sync entitlements from server — merges any server-side unlocks
    try {
      const serverUniforms = await getEntitlements();
      for (const id of serverUniforms) {
        if (!owned.includes(id as UniformId)) owned.push(id as UniformId);
      }
    } catch {}

    setOwnedUniforms(owned);
    await storage.setItem(OWNED_UNIFORMS_KEY, JSON.stringify(owned));

    if (equippedRaw && typeof equippedRaw === "string" && equippedRaw.length > 0) {
      setEquippedUniform(equippedRaw as UniformId);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-check entitlements whenever app comes back to foreground (after Stripe redirect)
  useEffect(() => {
    const unsub = watchForPurchaseReturn(() => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  const saveOwned = async (owned: UniformId[]) => {
    await storage.setItem(OWNED_UNIFORMS_KEY, JSON.stringify(owned));
  };

  const saveEquipped = async (id: UniformId) => {
    await storage.setItem(EQUIPPED_UNIFORM_KEY, id);
  };

  const handleEquip = async (id: UniformId) => {
    setEquippedUniform(id);
    await saveEquipped(id);
    onEquip?.(id);
  };

  const handlePurchase = async (id: UniformId) => {
    const def = UNIFORMS[id];
    if (def.price === 0) return;
    if (purchasing) return;

    setPurchasing(id);
    try {
      const result = await purchaseUniform(id);
      if (!result.ok) {
        Alert.alert("Purchase failed", result.error ?? "Please try again.");
      }
      // After browser closes, watchForPurchaseReturn will fire loadData
    } catch {
      Alert.alert("Purchase failed", "Could not open checkout. Please try again.");
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.headerTag}>[ COSMETICS ]</Text>
          <Text style={styles.headerTitle}>SCRAPYARD</Text>
          <Text style={styles.headerSub}>OPERATOR UNIFORMS · $4.99 EACH</Text>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 8 }}>
          {UNIFORM_ORDER.map((id) => {
            const def = UNIFORMS[id];
            const owned = ownedUniforms.includes(id);
            const equipped = equippedUniform === id;
            const isZombie = id === "zombie";
            const waveRequired = def.unlockWave ?? 0;
            const zombieLocked = isZombie && bestWave < waveRequired;
            const free = def.price === 0;
            const isBuying = purchasing === id;

            return (
              <View
                key={id}
                style={[
                  styles.card,
                  equipped && { borderColor: def.color, borderWidth: 1.5 },
                ]}
              >
                <View style={[styles.cardAccent, { backgroundColor: def.color }]} />

                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardName, { color: def.color }]}>{def.name}</Text>
                    {equipped && (
                      <View style={[styles.badge, { backgroundColor: def.color + "33", borderColor: def.color }]}>
                        <Text style={[styles.badgeText, { color: def.color }]}>EQUIPPED</Text>
                      </View>
                    )}
                    {owned && !equipped && (
                      <View style={[styles.badge, { backgroundColor: "#1a1a1a", borderColor: "#444" }]}>
                        <Text style={[styles.badgeText, { color: "#666" }]}>OWNED</Text>
                      </View>
                    )}
                    {isZombie && !owned && (
                      <View style={[styles.badge, { backgroundColor: "#1a1a1a", borderColor: "#444" }]}>
                        <MaterialCommunityIcons name="lock" size={10} color="#555" />
                        <Text style={[styles.badgeText, { color: "#555" }]}>WAVE {waveRequired}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTagline}>{def.tagline}</Text>
                </View>

                <Text style={styles.cardDesc}>{def.description}</Text>

                <View style={styles.perkList}>
                  {def.perks.map((perk, i) => (
                    <View key={i} style={styles.perkRow}>
                      <MaterialCommunityIcons
                        name={perkIcon(perk) as any}
                        size={13}
                        color={def.color}
                        style={styles.perkIcon}
                      />
                      <Text style={styles.perkText}>{perk}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.cardFooter}>
                  {owned ? (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        equipped
                          ? { backgroundColor: def.color + "22", borderColor: def.color }
                          : { backgroundColor: "#1a1a1a", borderColor: "#444" },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => !equipped && handleEquip(id)}
                    >
                      {equipped ? (
                        <>
                          <Ionicons name="checkmark-circle" size={14} color={def.color} />
                          <Text style={[styles.actionBtnText, { color: def.color }]}>ACTIVE</Text>
                        </>
                      ) : (
                        <>
                          <MaterialCommunityIcons name="tshirt-crew" size={14} color="#888" />
                          <Text style={[styles.actionBtnText, { color: "#888" }]}>EQUIP</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : zombieLocked ? (
                    <View style={[styles.actionBtn, { backgroundColor: "#111", borderColor: "#333" }]}>
                      <MaterialCommunityIcons name="lock" size={14} color="#444" />
                      <Text style={[styles.actionBtnText, { color: "#444" }]}>
                        REACH WAVE {waveRequired}
                      </Text>
                    </View>
                  ) : free ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#1a1a1a", borderColor: "#444" }]}
                      activeOpacity={0.7}
                      onPress={async () => {
                        const next = [...ownedUniforms, id];
                        setOwnedUniforms(next);
                        await saveOwned(next);
                        await handleEquip(id);
                      }}
                    >
                      <Ionicons name="lock-open-outline" size={14} color="#888" />
                      <Text style={[styles.actionBtnText, { color: "#888" }]}>UNLOCK FREE</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: def.color + "22", borderColor: def.color },
                        isBuying && { opacity: 0.6 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handlePurchase(id)}
                      disabled={isBuying || purchasing !== null}
                    >
                      {isBuying ? (
                        <ActivityIndicator size="small" color={def.color} />
                      ) : (
                        <FontAwesome5 name="dollar-sign" size={12} color={def.color} />
                      )}
                      <Text style={[styles.actionBtnText, { color: def.color }]}>
                        {isBuying ? "OPENING..." : `BUY · $${(def.price / 100).toFixed(2)}`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8} onPress={onClose}>
          <Ionicons name="arrow-back" size={14} color="#080808" />
          <Text style={styles.closeBtnText}>BACK TO BASE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export async function loadEquippedUniform(): Promise<UniformId> {
  const raw = await storage.getItem<string>(EQUIPPED_UNIFORM_KEY, "");
  if (raw && typeof raw === "string" && raw.length > 0) {
    return raw as UniformId;
  }
  return "standard";
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#080808",
    zIndex: 100,
  },
  panel: {
    flex: 1,
    paddingTop: Platform.OS === "web" ? 24 : 48,
  },
  loadingText: {
    color: "#555",
    textAlign: "center",
    marginTop: 80,
    fontFamily: "Courier",
    letterSpacing: 4,
  },
  header: {
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    marginHorizontal: 16,
  },
  headerTag: {
    color: "#D35400",
    fontSize: 10,
    letterSpacing: 4,
    fontFamily: "Courier",
    marginBottom: 4,
  },
  headerTitle: {
    color: "#EAEAEA",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 8,
  },
  headerSub: {
    color: "#555",
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "Courier",
    marginTop: 4,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#1e1e1e",
    marginBottom: 12,
    padding: 14,
    position: "relative",
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardName: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 8,
    letterSpacing: 2,
    fontFamily: "Courier",
    fontWeight: "700",
  },
  cardTagline: {
    color: "#555",
    fontSize: 10,
    fontFamily: "Courier",
    letterSpacing: 1,
    marginTop: 3,
  },
  cardDesc: {
    color: "#888",
    fontSize: 11,
    fontFamily: "Courier",
    lineHeight: 17,
    marginBottom: 10,
  },
  perkList: {
    gap: 4,
    marginBottom: 12,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  perkIcon: {
    width: 16,
  },
  perkText: {
    color: "#BDBDBD",
    fontSize: 11,
    fontFamily: "Courier",
  },
  cardFooter: {
    alignItems: "flex-end",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D35400",
    marginHorizontal: 16,
    marginBottom: Platform.OS === "web" ? 16 : 32,
    paddingVertical: 14,
  },
  closeBtnText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 4,
  },
});
