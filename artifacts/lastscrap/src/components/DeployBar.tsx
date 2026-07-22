import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GameState } from "../game/engine";
import { THROWABLE_ORDER, THROWABLES } from "../game/weapons";

type Props = {
  state: GameState;
  onThrow: (type: "grenade" | "sticky" | "mine") => void;
  onTurret: () => void;
};

export default function DeployBar({ state, onThrow, onTurret }: Props) {
  const placed = state.turrets.length >= 1;
  const onCd = state.turretRedeployCd > 0;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.bar} pointerEvents="box-none">
        {THROWABLE_ORDER.map((id) => {
          const count = state.throwables[id];
          if (count <= 0) return null;
          const def = THROWABLES[id];
          return (
            <TouchableOpacity
              key={id}
              testID={`deploy-${id}`}
              style={styles.slot}
              activeOpacity={0.7}
              onPress={() => onThrow(id)}
            >
              <MaterialCommunityIcons
                name={(id === "mine" ? "land-mines" : "grenade") as any}
                size={20}
                color="#FF8800"
              />
              <Text style={styles.short}>{def.short}</Text>
              <Text style={styles.count}>×{count}</Text>
            </TouchableOpacity>
          );
        })}

        {state.turretOwned && !placed && !onCd && (
          <TouchableOpacity
            testID="deploy-turret"
            style={styles.slot}
            activeOpacity={0.7}
            onPress={onTurret}
          >
            <MaterialCommunityIcons name="cctv" size={20} color="#00FFFF" />
            <Text style={styles.short}>TRT</Text>
            <Text style={styles.count}>DEPLOY</Text>
          </TouchableOpacity>
        )}

        {state.turretOwned && onCd && (
          <View style={[styles.slot, styles.slotDisabled]}>
            <MaterialCommunityIcons name="cctv" size={20} color="#00FFFF" />
            <Text style={styles.short}>TRT</Text>
            <Text style={styles.count}>{Math.ceil(state.turretRedeployCd)}s</Text>
          </View>
        )}

        {placed && (
          <View style={[styles.slot, styles.slotInfo]}>
            <MaterialCommunityIcons name="cctv" size={14} color="#00FFFF" />
            <View>
              <Text style={styles.placedLabel}>ACTIVE</Text>
              <Text style={styles.placedHp}>
                {Math.ceil(state.turrets[0].hp)}/{state.turrets[0].maxHp} HP
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 80,
    right: 16,
    alignItems: "flex-end",
  },
  bar: {
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
  slot: {
    backgroundColor: "rgba(20,18,16,0.85)",
    borderWidth: 1,
    borderColor: "#D35400",
    paddingVertical: 5,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 78,
    justifyContent: "flex-end",
  },
  slotDisabled: { opacity: 0.45 },
  slotInfo: {
    flexDirection: "row",
    borderColor: "#00FFFF",
    minWidth: 78,
    gap: 6,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  short: {
    color: "#EAEAEA",
    fontSize: 10,
    fontFamily: "Courier",
    letterSpacing: 1,
    fontWeight: "800",
  },
  count: {
    color: "#F39C12",
    fontSize: 10,
    fontFamily: "Courier",
    fontWeight: "900",
    letterSpacing: 1,
  },
  placedLabel: { color: "#00FFFF", fontSize: 8, letterSpacing: 2, fontWeight: "800" },
  placedHp: { color: "#EAEAEA", fontSize: 9, fontFamily: "Courier", fontWeight: "700" },
});
