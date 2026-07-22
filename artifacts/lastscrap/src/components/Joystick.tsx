import React, { useRef } from "react";
import { View, StyleSheet, PanResponder, Animated } from "react-native";

const OUTER_R = 60;
const INNER_R = 26;
const OUTER_D = OUTER_R * 2;
const INNER_D = INNER_R * 2;
const MAX_DIST = OUTER_R - INNER_R;

type Props = { onMove: (x: number, y: number) => void };

export default function Joystick({ onMove }: Props) {
  const thumbAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const updateFromDelta = (dx: number, dy: number) => {
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamp = Math.min(dist, MAX_DIST);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    thumbAnim.setValue({ x: nx * clamp, y: ny * clamp });
    onMoveRef.current(nx * (clamp / MAX_DIST), ny * (clamp / MAX_DIST));
  };

  const reset = () => {
    Animated.spring(thumbAnim, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      speed: 40,
      bounciness: 0,
    }).start();
    onMoveRef.current(0, 0);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        updateFromDelta(0, 0);
      },
      onPanResponderMove: (_e, gs) => {
        updateFromDelta(gs.dx, gs.dy);
      },
      onPanResponderRelease: reset,
      onPanResponderTerminate: reset,
    })
  ).current;

  return (
    <View
      testID="gameplay-joystick"
      style={styles.outer}
      {...pan.panHandlers}
    >
      <Animated.View
        style={[
          styles.inner,
          { transform: [{ translateX: thumbAnim.x }, { translateY: thumbAnim.y }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: OUTER_D, height: OUTER_D, borderRadius: OUTER_R,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(8,8,8,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  inner: {
    width: INNER_D, height: INNER_D, borderRadius: INNER_R,
    backgroundColor: "rgba(255,255,255,0.5)",
    position: "absolute",
  },
});
