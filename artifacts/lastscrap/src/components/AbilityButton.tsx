import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GameState, abilityStats } from "../game/engine";
import { ABILITIES } from "../game/weapons";

type Props = {
  size?: number;
  state: GameState;
  onUse: () => void;
  testID?: string;
};

export default function AbilityButton({ size = 86, state, onUse, testID }: Props) {
  const id = state.equippedAbility;
  // Nothing equipped/unlocked yet — render a dim, disabled placeholder.
  if (!id || state.abilities[id].level <= 0) {
    return (
      <View testID={testID ?? "ability-button"} style={{ alignItems: "center" }}>
        <View style={styles.label}>
          <Text style={styles.labelText}>ABILITY</Text>
        </View>
        <View
          style={[
            styles.outer,
            styles.outerEmpty,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <MaterialCommunityIcons name="lock" size={size * 0.3} color="#555" />
        </View>
      </View>
    );
  }

  const def = ABILITIES[id];
  const ab = state.abilities[id];
  const st = abilityStats(id, ab.level);
  const cdPct = st.cooldown > 0 ? ab.cooldown / st.cooldown : 0;
  const ready = ab.cooldown <= 0;
  const disabled = !ready || state.status !== "playing";

  return (
    <View testID={testID ?? "ability-button"} style={{ alignItems: "center" }}>
      <View style={styles.label}>
        <Text style={[styles.labelText, { color: def.color }]}>{def.short}</Text>
        <Text style={styles.lvlText}>L{ab.level}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={onUse}
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ready ? def.color : "#444",
            backgroundColor: ready ? "rgba(20,18,16,0.5)" : "rgba(20,18,16,0.7)",
          },
        ]}
      >
        <MaterialCommunityIcons
          name={def.icon as any}
          size={size * 0.4}
          color={ready ? def.color : "#666"}
        />
        {/* Cooldown sweep overlay (simple vertical fill from bottom) */}
        {!ready && (
          <View
            pointerEvents="none"
            style={[
              styles.cooldownFill,
              { height: `${cdPct * 100}%`, borderRadius: size / 2 },
            ]}
          />
        )}
        {!ready && (
          <Text style={styles.cdText}>{Math.ceil(ab.cooldown)}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  labelText: {
    color: "#7A7A7A",
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "Courier",
    fontWeight: "800",
  },
  lvlText: {
    color: "#EAEAEA",
    fontSize: 9,
    fontFamily: "Courier",
    fontWeight: "900",
  },
  outer: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  outerEmpty: {
    borderColor: "#444",
    backgroundColor: "rgba(20,18,16,0.5)",
  },
  cooldownFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cdText: {
    position: "absolute",
    color: "#EAEAEA",
    fontSize: 20,
    fontWeight: "900",
    fontFamily: "Courier",
  },
});
