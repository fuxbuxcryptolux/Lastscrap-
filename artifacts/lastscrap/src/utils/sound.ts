/**
 * Last Scrap — Sound System
 *
 * Web:    AudioContext (fetch → decodeAudioData → BufferSource) for SFX;
 *         HTMLAudioElement for looping music.
 * Native: expo-av.
 */

import { Platform } from "react-native";
import { storage } from "./storage";

// ─── SOUND FILE MANIFEST ──────────────────────────────────────────────────────
const SOUND_FILES = {
  shoot_pistol:   require("../../assets/sounds/shoot_pistol.wav"),
  shoot_shotgun:  require("../../assets/sounds/shoot_shotgun.wav"),
  shoot_smg:      require("../../assets/sounds/shoot_smg.wav"),
  shoot_ar:       require("../../assets/sounds/shoot_ar.wav"),
  shoot_laser:    require("../../assets/sounds/shoot_laser.wav"),
  reload:         require("../../assets/sounds/reload.wav"),
  empty_click:    require("../../assets/sounds/empty_click.wav"),
  explosion:      require("../../assets/sounds/explosion.wav"),
  flashbang:      require("../../assets/sounds/flashbang.wav"),
  emp_pulse:      require("../../assets/sounds/emp_pulse.wav"),
  dash:           require("../../assets/sounds/dash.wav"),
  overdrive_on:   require("../../assets/sounds/overdrive_on.wav"),
  zombie_hit:     require("../../assets/sounds/zombie_hit.wav"),
  zombie_die:     require("../../assets/sounds/zombie_die.wav"),
  zombie_groan_1: require("../../assets/sounds/zombie_groan_1.wav"),
  zombie_groan_2: require("../../assets/sounds/zombie_groan_2.wav"),
  player_hurt:    require("../../assets/sounds/player_hurt.wav"),
  player_die:     require("../../assets/sounds/player_die.wav"),
  revive:         require("../../assets/sounds/revive.wav"),
  rig_hit:        require("../../assets/sounds/rig_hit.wav"),
  rig_critical:   require("../../assets/sounds/rig_critical.wav"),
  rig_destroyed:  require("../../assets/sounds/rig_destroyed.wav"),
  ui_click:       require("../../assets/sounds/ui_click.wav"),
  ui_upgrade:     require("../../assets/sounds/ui_upgrade.wav"),
  ui_deploy:      require("../../assets/sounds/ui_deploy.wav"),
  ui_wave_start:  require("../../assets/sounds/ui_wave_start.wav"),
  ui_wave_clear:  require("../../assets/sounds/ui_wave_clear.wav"),
  horde_warning:  require("../../assets/sounds/horde_warning.wav"),
  scrap_pickup:   require("../../assets/sounds/scrap_pickup.wav"),
} as const;

export type SoundKey = keyof typeof SOUND_FILES;

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
// v5: music removed entirely — SFX-only settings now
const SETTINGS_KEY = "lastscrap_sound_settings_v5";

export type SoundSettings = {
  sfxVolume: number;
  sfxMuted: boolean;
};

const DEFAULT_SETTINGS: SoundSettings = {
  sfxVolume: 0.8,
  sfxMuted: false,
};

let settings: SoundSettings = { ...DEFAULT_SETTINGS };

async function saveSettings(): Promise<void> {
  await storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── ASSET URL (web) ──────────────────────────────────────────────────────────
// Metro asset query endpoint — confirmed 200 for wav + m4a.
function getAssetUrl(key: SoundKey): string {
  // require() returns a string URL when bundled; fall back to Metro endpoint
  const mod = SOUND_FILES[key];
  if (typeof mod === "string") return mod;
  if (mod && typeof (mod as { uri?: string }).uri === "string") return (mod as { uri: string }).uri;
  return `/assets?unstable_path=./assets/sounds/${key}.wav&platform=web`;
}

// ─── WEB: HTMLAudioElement SFX pool ──────────────────────────────────────────
// Uses document.createElement("audio") — same path as music, confirmed working.
// (globalThis / global in Metro's web bundle is the RN shim, NOT window, so
//  globalThis.Audio and globalThis.AudioContext are both undefined.)

type WebPool = { els: HTMLAudioElement[]; cursor: number };
const webPools = new Map<SoundKey, WebPool>();

function makeAudio(url: string): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  try {
    const el = document.createElement("audio");
    el.src = url;
    el.preload = "auto";
    return el;
  } catch { return null; }
}

async function playSfxWebAsync(key: SoundKey, vol: number): Promise<void> {
  if (settings.sfxMuted) return;

  // Fast path: existing pool
  const pool = webPools.get(key);
  if (pool && pool.els.length > 0) {
    const el = pool.els[pool.cursor % pool.els.length];
    pool.cursor++;
    try {
      el.volume = Math.max(0, Math.min(1, vol));
      el.currentTime = 0;
      const p = el.play();
      if (p) p.catch(() => {});
    } catch {}
    return;
  }

  // Slow path: build pool on first play
  const url = getAssetUrl(key);
  const frequent: SoundKey[] = [
    "shoot_pistol","shoot_smg","shoot_ar","zombie_hit","zombie_die","scrap_pickup",
  ];
  const size = frequent.includes(key) ? 3 : 1;
  const els: HTMLAudioElement[] = [];
  for (let i = 0; i < size; i++) {
    const el = makeAudio(url);
    if (el) els.push(el);
  }
  if (!els.length) return;
  webPools.set(key, { els, cursor: 1 });
  const el = els[0];
  try {
    el.volume = Math.max(0, Math.min(1, vol));
    el.currentTime = 0;
    const p = el.play();
    if (p) p.catch(() => {});
  } catch {}
}

// ─── NATIVE: expo-av ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ExpoAudio: any = null;
type NativePool = { sounds: unknown[]; cursor: number };
const nativePools = new Map<SoundKey, NativePool>();

function loadAvLib(): boolean {
  if (ExpoAudio) return true;
  try { ExpoAudio = require("expo-av").Audio; return true; } catch { return false; }
}

async function preloadNativeKey(key: SoundKey, poolSize: number): Promise<void> {
  if (!loadAvLib()) return;
  try {
    const sounds: unknown[] = [];
    for (let i = 0; i < poolSize; i++) {
      const { sound } = await ExpoAudio.Sound.createAsync(
        SOUND_FILES[key], { shouldPlay: false, volume: settings.sfxVolume }
      );
      sounds.push(sound);
    }
    nativePools.set(key, { sounds, cursor: 0 });
  } catch { /* skip */ }
}

function playSfxNative(key: SoundKey, vol: number): void {
  if (settings.sfxMuted) return;
  const pool = nativePools.get(key);
  if (!pool || !pool.sounds.length) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = pool.sounds[pool.cursor % pool.sounds.length] as any;
  pool.cursor++;
  s.setVolumeAsync(vol).catch(() => {});
  s.replayAsync().catch(() => {});
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
let initialized = false;

export async function initSound(): Promise<void> {
  try {
    const saved = await storage.getItem<string>(SETTINGS_KEY, "");
    if (saved && typeof saved === "string" && saved.length > 0) {
      const p = JSON.parse(saved);
      if (typeof p.sfxVolume === "number")   settings.sfxVolume = p.sfxVolume;
      if (typeof p.sfxMuted === "boolean")   settings.sfxMuted = p.sfxMuted;
    }
  } catch { /* use defaults */ }

  if (!initialized && Platform.OS !== "web" && loadAvLib()) {
    try {
      await ExpoAudio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch { /* non-fatal */ }
  }
  initialized = true;
}

export async function preloadAllSfx(): Promise<void> {
  const sfxKeys = Object.keys(SOUND_FILES) as SoundKey[];
  const frequent: SoundKey[] = [
    "shoot_pistol","shoot_smg","shoot_ar","zombie_hit","zombie_die","scrap_pickup",
  ];

  if (Platform.OS === "web") {
    // Pre-warm: build one audio element per key so first play has no delay.
    for (const key of sfxKeys) {
      if (webPools.has(key)) continue;
      const url = getAssetUrl(key);
      const el = makeAudio(url);
      if (el) webPools.set(key, { els: [el], cursor: 0 });
    }
  } else {
    await Promise.allSettled(
      sfxKeys.map((k) => preloadNativeKey(k, frequent.includes(k) ? 3 : 1))
    );
  }
}

export function playSfx(key: SoundKey, volumeOverride?: number): void {
  const vol = Math.max(0, Math.min(1, volumeOverride ?? settings.sfxVolume));
  if (Platform.OS === "web") {
    void playSfxWebAsync(key, vol);
  } else {
    playSfxNative(key, vol);
  }
}

// ─── PROCEDURAL TONES (web only) ─────────────────────────────────────────────
// AudioContext is accessible via the literal `window` identifier on Metro web;
// globalThis / global both resolve to the RN shim and have no AudioContext.
let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof document === "undefined") return null; // non-web platform
  try {
    if (_audioCtx && _audioCtx.state !== "closed") return _audioCtx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor() as AudioContext;
    return _audioCtx;
  } catch { return null; }
}

type ToneNote = { freq: number; start: number; dur: number; vol?: number; type?: OscillatorType };

function playToneSequence(notes: ToneNote[], masterVol: number): void {
  if (settings.sfxMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const base = ctx.currentTime;
  for (const note of notes) {
    try {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const t0 = base + note.start;
      const t1 = t0 + note.dur;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, (note.vol ?? 0.8) * masterVol * settings.sfxVolume)),
        t0 + 0.012,
      );
      gain.gain.setValueAtTime(
        Math.max(0, Math.min(1, (note.vol ?? 0.8) * masterVol * settings.sfxVolume)),
        t1 - 0.04,
      );
      gain.gain.linearRampToValueAtTime(0, t1);
      const osc = ctx.createOscillator();
      osc.type = note.type ?? "triangle";
      osc.frequency.setValueAtTime(note.freq, t0);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    } catch { /* non-fatal */ }
  }
}

// Mission-start briefing jingle — ascending military arpeggio (G major) on web;
// falls back to the existing wave-start SFX on native (no AudioContext available).
function playMissionStartTone(): void {
  if (Platform.OS !== "web") {
    playSfx("ui_wave_start");
    return;
  }
  playToneSequence([
    { freq: 392,  start: 0.00, dur: 0.10, vol: 0.6, type: "triangle" }, // G4
    { freq: 494,  start: 0.10, dur: 0.10, vol: 0.6, type: "triangle" }, // B4
    { freq: 587,  start: 0.20, dur: 0.10, vol: 0.6, type: "triangle" }, // D5
    { freq: 784,  start: 0.30, dur: 0.30, vol: 0.7, type: "triangle" }, // G5 (hold)
    { freq: 1175, start: 0.30, dur: 0.30, vol: 0.2, type: "sine"     }, // D6 harmonic
  ], 0.55);
}

// Mission-complete fanfare — triumphant ascending C-major run with a final swell on web;
// falls back to the existing wave-clear SFX on native.
function playMissionCompleteTone(): void {
  if (Platform.OS !== "web") {
    playSfx("ui_wave_clear");
    return;
  }
  playToneSequence([
    { freq: 523,  start: 0.00, dur: 0.13, vol: 0.5, type: "triangle" }, // C5
    { freq: 659,  start: 0.13, dur: 0.13, vol: 0.55, type: "triangle" }, // E5
    { freq: 784,  start: 0.26, dur: 0.13, vol: 0.6, type: "triangle" }, // G5
    { freq: 1047, start: 0.39, dur: 0.55, vol: 0.75, type: "triangle" }, // C6 (held)
    { freq: 1319, start: 0.39, dur: 0.55, vol: 0.25, type: "sine"     }, // E6 harmonic
    { freq: 1568, start: 0.80, dur: 0.55, vol: 0.45, type: "triangle" }, // G6 finale
    { freq: 2093, start: 0.80, dur: 0.55, vol: 0.15, type: "sine"     }, // C7 harmonic
  ], 0.6);
}

// ─── SFX CONVENIENCE ─────────────────────────────────────────────────────────
export const sfx = {
  shoot:        (weapon: string) => {
    const k = `shoot_${weapon}` as SoundKey;
    playSfx(k in SOUND_FILES ? k : "shoot_pistol", 0.6);
  },
  explosion:    () => playSfx("explosion"),
  flashbang:    () => playSfx("flashbang"),
  emp:          () => playSfx("emp_pulse"),
  dash:         () => playSfx("dash", 0.7),
  overdrive:    () => playSfx("overdrive_on"),
  zombieHit:    () => playSfx("zombie_hit", 0.45),
  zombieDie:    () => playSfx("zombie_die", 0.6),
  zombieGroan:  () => playSfx(Math.random() > 0.5 ? "zombie_groan_1" : "zombie_groan_2", 0.28),
  playerHurt:   () => playSfx("player_hurt", 0.8),
  playerDie:    () => playSfx("player_die"),
  revive:       () => playSfx("revive"),
  rigHit:       () => playSfx("rig_hit", 0.7),
  rigCritical:  () => playSfx("rig_critical", 0.9),
  rigDestroyed: () => playSfx("rig_destroyed"),
  uiClick:      () => playSfx("ui_click", 0.5),
  upgrade:      () => playSfx("ui_upgrade"),
  deploy:       () => playSfx("ui_deploy"),
  waveStart:    () => playSfx("ui_wave_start"),
  waveClear:    () => playSfx("ui_wave_clear"),
  hordeWarning:    () => playSfx("horde_warning"),
  scrapPickup:     () => playSfx("scrap_pickup", 0.38),
  reload:          () => playSfx("reload", 0.5),
  emptyClick:      () => playSfx("empty_click", 0.4),
  missionStart:    () => playMissionStartTone(),
  missionComplete: () => playMissionCompleteTone(),
};

// ─── SETTINGS API ─────────────────────────────────────────────────────────────
export async function setSfxVolume(v: number): Promise<void> {
  settings.sfxVolume = Math.max(0, Math.min(1, v));
  await saveSettings();
}

export async function toggleSfxMute(): Promise<boolean> {
  settings.sfxMuted = !settings.sfxMuted;
  await saveSettings();
  return settings.sfxMuted;
}

export function getSoundSettings(): SoundSettings {
  return { ...settings };
}
