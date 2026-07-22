import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getSoundSettings,
  setSfxVolume,
  toggleSfxMute,
  type SoundSettings,
} from "../utils/sound";

// ─── CUSTOM VOLUME SLIDER ─────────────────────────────────────────────────────
function VolumeSlider({
  value,
  muted,
  onChange,
  color,
}: {
  value: number;
  muted: boolean;
  onChange: (v: number) => void;
  color: string;
}) {
  const [barWidth, setBarWidth] = useState(0);
  const effectiveValue = muted ? 0 : value;

  const handleTouch = useCallback(
    (e: any) => {
      if (barWidth === 0 || muted) return;
      const x = Math.max(0, Math.min(barWidth, e.nativeEvent.locationX));
      const v = Math.round((x / barWidth) * 10) / 10; // snap to 0.1 steps
      onChange(Math.max(0, Math.min(1, v)));
    },
    [barWidth, muted, onChange]
  );

  return (
    <View
      style={styles.sliderHitArea}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !muted}
      onMoveShouldSetResponder={() => !muted}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
    >
      {/* Track */}
      <View style={styles.sliderTrack}>
        <View
          style={[
            styles.sliderFill,
            {
              width: `${effectiveValue * 100}%`,
              backgroundColor: muted ? "#333" : color,
            },
          ]}
        />
      </View>
      {/* Thumb */}
      {barWidth > 0 && (
        <View
          style={[
            styles.sliderThumb,
            {
              left: barWidth * effectiveValue - 8,
              backgroundColor: muted ? "#444" : color,
            },
          ]}
        />
      )}
      {/* Step ticks */}
      {[0.25, 0.5, 0.75].map((tick) => (
        <View
          key={tick}
          style={[
            styles.sliderTick,
            barWidth > 0 ? { left: barWidth * tick - 0.5 } : { display: "none" },
          ]}
        />
      ))}
    </View>
  );
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────
type Props = { onClose: () => void };

export default function SettingsPanel({ onClose }: Props) {
  const [s, setS] = useState<SoundSettings>(getSoundSettings());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const close = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(onClose);
  }, [fadeAnim, onClose]);

  const handleSfxVolume = useCallback(async (v: number) => {
    await setSfxVolume(v);
    setS(getSoundSettings());
  }, []);

  const handleToggleSfx = useCallback(async () => {
    await toggleSfxMute();
    setS(getSoundSettings());
  }, []);

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Backdrop tap to close */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />

      <View style={styles.panel}>
        {/* Corner brackets */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="settings-sharp" size={14} color="#D35400" />
          <Text style={styles.title}>AUDIO SETTINGS</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={20} color="#7A7A7A" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── SFX ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="bullhorn"
              size={14}
              color={s.sfxMuted ? "#444" : "#4FC3F7"}
            />
            <Text style={[styles.sectionLabel, s.sfxMuted && styles.mutedLabel]}>
              SFX
            </Text>
            <Text style={[styles.pctLabel, s.sfxMuted && styles.mutedLabel]}>
              {s.sfxMuted ? "OFF" : pct(s.sfxVolume)}
            </Text>
            <TouchableOpacity
              onPress={handleToggleSfx}
              style={[styles.muteBtn, s.sfxMuted && styles.muteBtnActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={s.sfxMuted ? "volume-mute" : "volume-high"}
                size={14}
                color={s.sfxMuted ? "#FF2A2A" : "#4FC3F7"}
              />
              <Text style={[styles.muteBtnText, s.sfxMuted && { color: "#FF2A2A" }]}>
                {s.sfxMuted ? "MUTED" : "ON"}
              </Text>
            </TouchableOpacity>
          </View>
          <VolumeSlider
            value={s.sfxVolume}
            muted={s.sfxMuted}
            onChange={handleSfxVolume}
            color="#4FC3F7"
          />
        </View>

        <View style={styles.thinDivider} />

        {/* Hint */}
        <Text style={styles.hint}>drag slider or tap to set volume</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,8,0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  panel: {
    width: 320,
    backgroundColor: "#0E0E0E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  corner: { position: "absolute", width: 12, height: 12, borderColor: "#D35400" },
  cornerTL: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    flex: 1,
    color: "#EAEAEA",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  divider: { height: 1, backgroundColor: "#222", marginBottom: 20 },
  thinDivider: { height: 1, backgroundColor: "#181818", marginVertical: 16 },
  section: { gap: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionLabel: {
    flex: 1,
    color: "#EAEAEA",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    fontFamily: "Courier",
  },
  mutedLabel: { color: "#444" },
  pctLabel: {
    color: "#7A7A7A",
    fontSize: 10,
    fontFamily: "Courier",
    letterSpacing: 1,
    minWidth: 36,
    textAlign: "right",
  },
  muteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  muteBtnActive: { borderColor: "#FF2A2A33" },
  muteBtnText: {
    color: "#7A7A7A",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
  },
  muteBtnActiveText: { color: "#FF2A2A" },
  // Slider
  sliderHitArea: {
    height: 36,
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 2,
  },
  sliderTrack: {
    height: 3,
    backgroundColor: "#2A2A2A",
    borderRadius: 2,
    overflow: "hidden",
  },
  sliderFill: {
    height: "100%",
    borderRadius: 2,
  },
  sliderThumb: {
    position: "absolute",
    top: 10,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#0E0E0E",
  },
  sliderTick: {
    position: "absolute",
    top: 15,
    width: 1,
    height: 5,
    backgroundColor: "#333",
  },
  hint: {
    color: "#333",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "Courier",
    textAlign: "center",
    marginTop: 4,
  },
});
