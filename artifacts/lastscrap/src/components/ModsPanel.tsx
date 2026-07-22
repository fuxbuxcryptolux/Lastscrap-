import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GameState, buyAndSlotMod, getSlottedMods, removeSlottedMod } from "../game/engine";
import { WEAPONS, WEAPON_ORDER, WeaponId, Weapon } from "../game/weapons";
import { MOD_ORDER, MODS, MOD_SLOTS, ModId, computeModBundle } from "../game/mods";

type Props = {
  state: GameState;
  forceTick: () => void;
};

type StatChange = { label: string; current: string; next: string; better: boolean | null };

function getStatChanges(
  weapon: Weapon,
  currentSlots: (ModId | null)[],
  selectedSlot: number,
  candidateModId: ModId,
): StatChange[] {
  const mod = MODS[candidateModId];
  if (
    mod.fireRateMul === 1 &&
    mod.reloadRateMul === 1 &&
    mod.magBonus === 0 &&
    mod.projectileSpeedMul === 1 &&
    mod.piercePlus === 0
  ) {
    return [];
  }

  const slotsWithout = currentSlots.map((id, i) => (i === selectedSlot ? null : id));
  const slotsWith = currentSlots.map((id, i) => (i === selectedSlot ? candidateModId : id));

  const before = computeModBundle(slotsWithout);
  const after = computeModBundle(slotsWith);

  const results: StatChange[] = [];

  if (mod.fireRateMul !== 1) {
    const baseInterval = weapon.autoInterval > 0 ? weapon.autoInterval : weapon.tapInterval;
    const cur = baseInterval * before.fireRateMul;
    const nxt = baseInterval * after.fireRateMul;
    results.push({
      label: "Fire interval",
      current: cur.toFixed(3) + "s",
      next: nxt.toFixed(3) + "s",
      better: nxt < cur,
    });
  }

  if (mod.reloadRateMul !== 1) {
    const cur = weapon.reloadRate * before.reloadRateMul;
    const nxt = weapon.reloadRate * after.reloadRateMul;
    results.push({
      label: "Reload rate",
      current: cur.toFixed(1) + "/s",
      next: nxt.toFixed(1) + "/s",
      better: nxt > cur,
    });
  }

  if (mod.magBonus !== 0) {
    const cur = weapon.magSize + before.magBonus;
    const nxt = weapon.magSize + after.magBonus;
    results.push({
      label: "Mag size",
      current: String(cur),
      next: String(nxt),
      better: nxt > cur,
    });
  }

  if (mod.projectileSpeedMul !== 1) {
    const cur = Math.round(weapon.projectileSpeed * before.projectileSpeedMul);
    const nxt = Math.round(weapon.projectileSpeed * after.projectileSpeedMul);
    results.push({
      label: "Proj speed",
      current: String(cur),
      next: String(nxt),
      better: nxt > cur,
    });
  }

  if (mod.piercePlus !== 0) {
    const cur = weapon.pierce + before.piercePlus;
    const nxt = weapon.pierce + after.piercePlus;
    results.push({
      label: "Pierce",
      current: String(cur),
      next: String(nxt),
      better: nxt > cur,
    });
  }

  return results;
}

export default function ModsPanel({ state, forceTick }: Props) {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>(state.equippedWeapon);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const ownedWeapons = WEAPON_ORDER.filter(id => state.ownedWeapons.includes(id));
  const slots = getSlottedMods(state, selectedWeapon);
  const hasAmmoMod = slots.some(id => id !== null && MODS[id].family === "ammo");

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SELECT WEAPON</Text>
        <View style={styles.weaponRow}>
          {ownedWeapons.map(id => {
            const w = WEAPONS[id];
            const active = selectedWeapon === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.weaponChip, active && styles.weaponChipActive]}
                activeOpacity={0.7}
                onPress={() => { setSelectedWeapon(id); setSelectedSlot(null); }}
              >
                <MaterialCommunityIcons name="pistol" size={14} color={active ? "#F39C12" : "#666"} />
                <Text style={[styles.weaponChipText, active && styles.weaponChipTextActive]}>
                  {w.name}
                </Text>
                {state.equippedWeapon === id && (
                  <Text style={styles.equippedDot}>●</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MOD SLOTS · {WEAPONS[selectedWeapon].name.toUpperCase()}</Text>
        <View style={styles.slotsRow}>
          {Array.from({ length: MOD_SLOTS }).map((_, i) => {
            const modId = slots[i];
            const mod = modId ? MODS[modId] : null;
            const isSelected = selectedSlot === i;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.slot, isSelected && styles.slotSelected, mod && { borderColor: mod.color + "88" }]}
                activeOpacity={0.7}
                onPress={() => setSelectedSlot(isSelected ? null : i)}
              >
                {mod ? (
                  <>
                    <View style={[styles.slotDot, { backgroundColor: mod.color }]} />
                    <Text style={[styles.slotLabel, { color: mod.color }]}>{mod.shortLabel}</Text>
                    <Text style={styles.slotFamily}>{mod.family.toUpperCase()}</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="plus" size={16} color={isSelected ? "#F39C12" : "#444"} />
                    <Text style={[styles.slotEmpty, isSelected && { color: "#F39C12" }]}>EMPTY</Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedSlot !== null && slots[selectedSlot] !== null && (
          <TouchableOpacity
            style={styles.removeBtn}
            activeOpacity={0.7}
            onPress={() => {
              removeSlottedMod(state, selectedWeapon, selectedSlot);
              setSelectedSlot(null);
              forceTick();
            }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={12} color="#FF2A2A" />
            <Text style={styles.removeBtnText}>REMOVE MOD FROM SLOT {selectedSlot + 1}</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedSlot !== null && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            SLOT {selectedSlot + 1} — CHOOSE MOD{" "}
            <Text style={styles.sectionHint}>(ammo: {hasAmmoMod ? "1/1" : "0/1"})</Text>
          </Text>
          {MOD_ORDER.map(modId => {
            const mod = MODS[modId];
            const canAfford = state.scrap >= mod.cost;
            const currentSlotMod = slots[selectedSlot];
            const alreadyHere = currentSlotMod === modId;
            const copiesElsewhere = slots.filter((id, i) => i !== selectedSlot && id === modId).length;
            const stackCapped = copiesElsewhere >= mod.stackCap;
            const disabled = !canAfford || stackCapped || alreadyHere;

            const weapon = WEAPONS[selectedWeapon];
            const statChanges = getStatChanges(weapon, slots, selectedSlot, modId);

            return (
              <TouchableOpacity
                key={modId}
                style={[styles.modCard, disabled && styles.modCardDisabled, alreadyHere && styles.modCardActive]}
                activeOpacity={0.7}
                disabled={disabled}
                onPress={() => {
                  if (buyAndSlotMod(state, selectedWeapon, selectedSlot, modId)) {
                    setSelectedSlot(null);
                    forceTick();
                  }
                }}
              >
                <View style={[styles.modFamily, { backgroundColor: mod.color + "22", borderColor: mod.color + "55" }]}>
                  <Text style={[styles.modFamilyText, { color: mod.color }]}>
                    {mod.family === "ammo" ? "AMMO" : "STAT"}
                  </Text>
                </View>
                <View style={styles.modBody}>
                  <View style={styles.modTop}>
                    <Text style={[styles.modLabel, { color: mod.color }]}>{mod.label}</Text>
                    {alreadyHere && <Text style={styles.modEquipped}>IN SLOT</Text>}
                    {stackCapped && !alreadyHere && <Text style={styles.modBlocked}>MAX ×{mod.stackCap}</Text>}
                  </View>
                  <Text style={styles.modDesc}>{mod.description}</Text>
                  {statChanges.length > 0 && (
                    <View style={styles.previewRows}>
                      {statChanges.map(sc => (
                        <View key={sc.label} style={styles.previewRow}>
                          <Text style={styles.previewLabel}>{sc.label}:</Text>
                          <Text style={styles.previewCurrent}>{sc.current}</Text>
                          <Text style={styles.previewArrow}>→</Text>
                          <Text style={[
                            styles.previewNext,
                            sc.better === true && styles.previewBetter,
                            sc.better === false && styles.previewWorse,
                          ]}>
                            {sc.next}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={[styles.modCost, !canAfford && styles.modCostDisabled]}>
                  <MaterialCommunityIcons name="nut" size={11} color={canAfford ? "#F39C12" : "#555"} />
                  <Text style={[styles.modCostText, !canAfford && styles.modCostTextDisabled]}>
                    {mod.cost}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {selectedSlot === null && (
        <View style={styles.hintBox}>
          <MaterialCommunityIcons name="information-outline" size={13} color="#555" />
          <Text style={styles.hintText}>
            Tap a slot to install a mod. Stat mods stack across slots. Only one ammo-type per weapon.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 10,
    marginHorizontal: 4,
  },
  sectionLabel: {
    color: "#555",
    fontSize: 9,
    fontWeight: "800",
    fontFamily: "Courier",
    letterSpacing: 2,
    marginBottom: 6,
    marginLeft: 2,
  },
  sectionHint: {
    color: "#444",
    fontSize: 9,
    fontFamily: "Courier",
  },
  weaponRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  weaponChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0D0D0D",
  },
  weaponChipActive: {
    borderColor: "#F39C1255",
    backgroundColor: "rgba(243,156,18,0.07)",
  },
  weaponChipText: {
    color: "#555",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  weaponChipTextActive: {
    color: "#F39C12",
  },
  equippedDot: {
    color: "#39FF14",
    fontSize: 8,
  },
  slotsRow: {
    flexDirection: "row",
    gap: 8,
  },
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0D0D0D",
    gap: 4,
    minHeight: 60,
  },
  slotSelected: {
    borderColor: "#F39C1255",
    backgroundColor: "rgba(243,156,18,0.05)",
  },
  slotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slotLabel: {
    fontSize: 9,
    fontWeight: "800",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  slotFamily: {
    color: "#444",
    fontSize: 7,
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  slotEmpty: {
    color: "#444",
    fontSize: 8,
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#330000",
    backgroundColor: "rgba(255,42,42,0.05)",
    alignSelf: "flex-start",
  },
  removeBtnText: {
    color: "#FF2A2A",
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  modCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    backgroundColor: "#0A0A0A",
  },
  modCardDisabled: {
    opacity: 0.45,
  },
  modCardActive: {
    borderColor: "#F39C1255",
    backgroundColor: "rgba(243,156,18,0.05)",
  },
  modFamily: {
    width: 38,
    alignItems: "center",
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 2,
    marginTop: 1,
  },
  modFamilyText: {
    fontSize: 7,
    fontWeight: "800",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  modBody: {
    flex: 1,
  },
  modTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  modLabel: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
  modEquipped: {
    color: "#F39C12",
    fontSize: 8,
    fontFamily: "Courier",
    fontWeight: "700",
  },
  modBlocked: {
    color: "#FF2A2A",
    fontSize: 8,
    fontFamily: "Courier",
    fontWeight: "700",
  },
  modDesc: {
    color: "#555",
    fontSize: 9,
    fontFamily: "Courier",
    letterSpacing: 0.5,
  },
  previewRows: {
    marginTop: 5,
    gap: 2,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewLabel: {
    color: "#444",
    fontSize: 8,
    fontFamily: "Courier",
    letterSpacing: 0.5,
    minWidth: 68,
  },
  previewCurrent: {
    color: "#555",
    fontSize: 8,
    fontFamily: "Courier",
    fontWeight: "700",
  },
  previewArrow: {
    color: "#333",
    fontSize: 8,
    fontFamily: "Courier",
  },
  previewNext: {
    fontSize: 8,
    fontFamily: "Courier",
    fontWeight: "800",
    color: "#888",
  },
  previewBetter: {
    color: "#39FF14",
  },
  previewWorse: {
    color: "#FF2A2A",
  },
  modCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#7D4E00",
    backgroundColor: "rgba(243,156,18,0.07)",
    marginTop: 1,
  },
  modCostDisabled: {
    borderColor: "#2A2A2A",
    backgroundColor: "transparent",
  },
  modCostText: {
    color: "#F39C12",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Courier",
  },
  modCostTextDisabled: {
    color: "#444",
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: 4,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    backgroundColor: "#080808",
  },
  hintText: {
    flex: 1,
    color: "#444",
    fontSize: 9,
    fontFamily: "Courier",
    letterSpacing: 0.5,
    lineHeight: 14,
  },
});
