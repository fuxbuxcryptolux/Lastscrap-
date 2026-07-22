import React, { useRef } from "react";
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from "react-native";

type Props = {
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  overdrive: boolean;
  equippedWeapon?: string;
  laserCharge?: number;   // 0–1
  laserCharging?: boolean;
  onPress: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onReload: () => void;
};

const BTN_SIZE = 90;

export default function FireButton({
  ammo,
  maxAmmo,
  reloading,
  overdrive,
  equippedWeapon,
  laserCharge = 0,
  laserCharging = false,
  onPress,
  onHoldStart,
  onHoldEnd,
  onReload,
}: Props) {
  const holdRef = useRef(false);
  const pressedRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        pressedRef.current = true;
        holdRef.current = true;
        onPress();
        onHoldStart();
      },
      onPanResponderRelease: () => {
        pressedRef.current = false;
        if (holdRef.current) {
          holdRef.current = false;
          onHoldEnd();
        }
      },
      onPanResponderTerminate: () => {
        pressedRef.current = false;
        if (holdRef.current) {
          holdRef.current = false;
          onHoldEnd();
        }
      },
    })
  ).current;

  const isLaser = equippedWeapon === "laser" && !overdrive;
  const empty = ammo <= 0 && !overdrive;
  const ammoRatio = overdrive ? 1 : maxAmmo > 0 ? ammo / maxAmmo : 0;
  const canReload = !overdrive && !reloading && ammo < maxAmmo && !isLaser;

  const chargeRatio = laserCharge;
  const chargeFull = laserCharge >= 1;

  const borderColor = overdrive
    ? "#F1C40F"
    : isLaser && laserCharging
      ? chargeFull ? "#FF2A95" : `rgba(255,42,149,${0.4 + chargeRatio * 0.6})`
      : empty
        ? "#FF2A2A"
        : "#D35400";

  const fillColor = overdrive ? "#F1C40F" : isLaser ? "#FF2A95" : empty ? "#FF2A2A" : "#D35400";
  const labelColor = overdrive
    ? "#F1C40F"
    : isLaser && laserCharging
      ? "#FF2A95"
      : empty
        ? "#FF2A2A"
        : "#D35400";

  const fireLabel = overdrive
    ? "FIRE"
    : isLaser
      ? chargeFull
        ? "FIRE!"
        : laserCharging
          ? `${Math.round(laserCharge * 100)}%`
          : "CHARGE"
      : empty
        ? "EMPTY"
        : "FIRE";

  return (
    <View style={styles.wrapper}>
      {canReload && (
        <TouchableOpacity
          style={styles.reloadBtn}
          activeOpacity={0.7}
          onPress={onReload}
        >
          <Text style={styles.reloadText}>↺ RELOAD</Text>
        </TouchableOpacity>
      )}
      {reloading && !overdrive && (
        <View style={styles.reloadingTag}>
          <Text style={styles.reloadingText}>RELOADING…</Text>
        </View>
      )}
      {!reloading && !overdrive && (
        <View style={styles.holdHint}>
          <Text style={styles.holdHintText}>
            {isLaser ? "HOLD = CHARGE BLAST" : "HOLD = FULL AUTO"}
          </Text>
        </View>
      )}

      <View
        testID="fire-button"
        style={[
          styles.btn,
          { borderColor },
          empty && styles.btnEmpty,
          overdrive && styles.btnOverdrive,
          isLaser && laserCharging && styles.btnLaser,
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={[styles.fireLabel, { color: labelColor }]}>
          {fireLabel}
        </Text>

        {/* Charge / ammo fill bar */}
        <View style={styles.ammoBarBg}>
          <View
            style={[
              styles.ammoBarFill,
              {
                width: isLaser
                  ? `${chargeRatio * 100}%` as any
                  : `${ammoRatio * 100}%` as any,
                backgroundColor: fillColor,
              },
            ]}
          />
        </View>

        <Text style={styles.ammoText} testID="ammo-count">
          {overdrive ? "∞" : isLaser ? `${ammo}/${maxAmmo}` : `${ammo}/${maxAmmo}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "flex-end",
    gap: 6,
  },
  reloadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#D35400",
    backgroundColor: "rgba(20,18,16,0.85)",
  },
  reloadText: {
    color: "#D35400",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  reloadingTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#555",
    backgroundColor: "rgba(20,18,16,0.85)",
  },
  reloadingText: {
    color: "#7A7A7A",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  holdHint: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(20,18,16,0.85)",
    borderWidth: 1,
    borderColor: "#FF2A95",
  },
  holdHintText: {
    color: "#FF2A95",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    backgroundColor: "rgba(20,18,16,0.85)",
    borderWidth: 2,
    borderColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  btnEmpty: {
    borderColor: "#FF2A2A",
    opacity: 0.6,
  },
  btnOverdrive: {
    backgroundColor: "rgba(30,28,10,0.9)",
  },
  btnLaser: {
    backgroundColor: "rgba(20,10,18,0.92)",
  },
  fireLabel: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  ammoBarBg: {
    width: 64,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "#333",
  },
  ammoBarFill: {
    height: "100%",
  },
  ammoText: {
    color: "#7A7A7A",
    fontSize: 10,
    fontFamily: "Courier",
    letterSpacing: 1,
  },
});
