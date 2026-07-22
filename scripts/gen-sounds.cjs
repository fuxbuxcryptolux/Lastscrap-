#!/usr/bin/env node
/**
 * Generates synthesized WAV SFX files for Last Scrap.
 * Run from workspace root: node scripts/gen-sounds.js
 */
const fs = require("fs");
const path = require("path");

const SR = 22050;
const OUT = path.join(__dirname, "..", "artifacts", "lastscrap", "assets", "sounds");

function wav(samples, amp = 28000) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(samples[i] * amp)));
    buf.writeInt16LE(v, 44 + i * 2);
  }
  return buf;
}

function gen(ms, fn) {
  const n = Math.ceil(SR * ms / 1000);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = fn(i / SR, i / n);
  return s;
}

const sin = (hz, t) => Math.sin(2 * Math.PI * hz * t);
const noise = () => Math.random() * 2 - 1;

function write(name, samples, amp) {
  fs.writeFileSync(path.join(OUT, name), wav(samples, amp));
  process.stdout.write("  " + name + "\n");
}

console.log("Generating Last Scrap SFX →", OUT);

// ── WEAPONS ──────────────────────────────────────────────────────────────────

write("shoot_pistol.wav", gen(110, (t, n) => {
  const e = Math.exp(-n * 28);
  return (sin(1400 - n * 500, t) * 0.55 + noise() * 0.5) * e;
}), 26000);

write("shoot_shotgun.wav", gen(200, (t, n) => {
  const e = Math.pow(1 - n, 2.2);
  return (sin(80 + n * 30, t) * 0.45 + noise() * 0.7) * e;
}), 28000);

write("shoot_smg.wav", gen(65, (t, n) => {
  return (sin(1700 - n * 300, t) * 0.45 + noise() * 0.55) * Math.exp(-n * 40);
}), 22000);

write("shoot_ar.wav", gen(100, (t, n) => {
  const e = Math.exp(-n * 25);
  return (sin(1200 - n * 350, t) * 0.5 + noise() * 0.5) * e;
}), 25000);

write("shoot_laser.wav", gen(150, (t, n) => {
  const freq = 400 + n * n * 3000;
  const e = Math.exp(-n * 12);
  return (sin(freq, t) + sin(freq * 2, t) * 0.2) * e;
}), 23000);

write("reload.wav", gen(340, (t, n) => {
  const c1 = Math.abs(n - 0.18) < 0.04 ? noise() * Math.exp(-Math.abs(n - 0.18) * 120) : 0;
  const c2 = Math.abs(n - 0.55) < 0.04 ? noise() * Math.exp(-Math.abs(n - 0.55) * 120) : 0;
  return c1 + c2;
}), 24000);

write("empty_click.wav", gen(55, (t, n) => {
  return noise() * Math.exp(-n * 50);
}), 18000);

// ── EXPLOSIONS / ABILITIES ────────────────────────────────────────────────────

write("explosion.wav", gen(520, (t, n) => {
  const e = Math.pow(1 - n, 1.4);
  return (sin(55 + n * 15, t) * 0.4 + noise() * 0.65 + (n < 0.15 ? noise() * 0.4 : 0)) * e;
}), 30000);

write("flashbang.wav", gen(600, (t, n) => {
  return sin(5800 + n * 1800, t) * Math.exp(-n * 3.5);
}), 22000);

write("emp_pulse.wav", gen(380, (t, n) => {
  const freq = 1300 * Math.pow(1 - n * 0.85, 2);
  const e = Math.exp(-n * 4);
  return (sin(freq, t) * 0.7 + sin(freq * 0.5, t) * 0.35) * e;
}), 24000);

write("dash.wav", gen(200, (t, n) => {
  const freq = 250 + n * 900;
  const e = Math.exp(-n * 10);
  return (noise() * 0.55 + sin(freq, t) * 0.45) * e;
}), 21000);

write("overdrive_on.wav", gen(400, (t, n) => {
  const freq = 280 + n * n * 1400;
  const e = Math.exp(-n * 4);
  return (sin(freq, t) + sin(freq * 2, t) * 0.3 + sin(freq * 3, t) * 0.12) * e;
}), 26000);

// ── ZOMBIES ───────────────────────────────────────────────────────────────────

write("zombie_hit.wav", gen(130, (t, n) => {
  const e = Math.exp(-n * 22);
  return (sin(110 + n * 60, t) * 0.45 + noise() * 0.65) * e;
}), 26000);

write("zombie_die.wav", gen(300, (t, n) => {
  const freq = 210 - n * 155;
  const e = Math.pow(1 - n, 1.8);
  const wob = Math.sin(t * 20) * 18;
  return (sin(freq + wob, t) * 0.65 + noise() * 0.35) * e;
}), 22000);

write("zombie_groan_1.wav", gen(520, (t, n) => {
  const e = Math.sin(n * Math.PI) * 0.9;
  const vib = Math.sin(t * 5.5) * 14;
  return (sin(105 + vib, t) * 0.8 + noise() * 0.08) * e;
}), 17000);

write("zombie_groan_2.wav", gen(480, (t, n) => {
  const e = Math.sin(n * Math.PI) * 0.85;
  const vib = Math.sin(t * 7.5) * 11;
  return (sin(125 + vib, t) * 0.7 + sin(62 + vib * 0.4, t) * 0.25 + noise() * 0.08) * e;
}), 17000);

// ── PLAYER ────────────────────────────────────────────────────────────────────

write("player_hurt.wav", gen(180, (t, n) => {
  const e = Math.exp(-n * 18);
  return (sin(260 + n * 80, t) * 0.35 + noise() * 0.72) * e;
}), 26000);

write("player_die.wav", gen(750, (t, n) => {
  const freq = 360 - n * 290;
  const e = Math.pow(1 - n, 1.1);
  const wob = Math.sin(t * 14) * 22;
  return (sin(freq + wob, t) * 0.55 + sin(freq * 0.5, t) * 0.3 + noise() * 0.18) * e;
}), 24000);

write("revive.wav", gen(520, (t, n) => {
  const freq = 280 + n * 750;
  const e = Math.sin(n * Math.PI * 0.8);
  return (sin(freq, t) + sin(freq * 2, t) * 0.22 + sin(freq * 3, t) * 0.08) * e;
}), 26000);

// ── RIG ───────────────────────────────────────────────────────────────────────

write("rig_hit.wav", gen(300, (t, n) => {
  const e = Math.exp(-n * 9);
  return (sin(360, t) * 0.45 + sin(720, t) * 0.25 + sin(1080, t) * 0.12 + noise() * 0.28) * e;
}), 28000);

write("rig_critical.wav", gen(450, (t, n) => {
  const pulse = Math.sin(t * 9 * Math.PI) > 0 ? 1 : 0.15;
  return sin(640, t) * pulse * 0.88;
}), 25000);

write("rig_destroyed.wav", gen(850, (t, n) => {
  const e = Math.pow(1 - n, 0.9);
  return (sin(42 + n * 10, t) * 0.45 + sin(115, t) * 0.2 * (1 - n) + noise() * 0.6 + (n < 0.25 ? noise() * 0.4 * (1 - n / 0.25) : 0)) * e;
}), 30000);

// ── UI ────────────────────────────────────────────────────────────────────────

write("ui_click.wav", gen(80, (t, n) => {
  return sin(1350, t) * Math.exp(-n * 28);
}), 17000);

write("ui_upgrade.wav", gen(380, (t, n) => {
  const e = Math.exp(-n * 5.5);
  return (sin(880, t) + sin(1320, t) * 0.45 + sin(1760, t) * 0.2) * e;
}), 22000);

write("ui_deploy.wav", gen(230, (t, n) => {
  const e = Math.exp(-n * 9);
  return (sin(640, t) + sin(960, t) * 0.4) * e;
}), 22000);

write("ui_wave_start.wav", gen(420, (t, n) => {
  const freq = 380 + Math.sin(n * Math.PI * 4) * 160;
  const e = Math.exp(-n * 2.5);
  return sin(freq, t) * e;
}), 24000);

write("ui_wave_clear.wav", gen(650, (t, n) => {
  const step = Math.floor(n * 3);
  const freqs = [660, 880, 1100];
  const localN = (n * 3) % 1;
  const e = Math.exp(-localN * 5.5);
  return sin(freqs[step], t) * e;
}), 22000);

write("horde_warning.wav", gen(650, (t, n) => {
  const pulse = Math.floor(n * 6) % 2 === 0;
  const e = Math.exp(-n * 1.5);
  return sin(pulse ? 480 : 720, t) * e * 0.9;
}), 24000);

write("scrap_pickup.wav", gen(110, (t, n) => {
  return (sin(2100, t) + sin(2800, t) * 0.4) * Math.exp(-n * 22);
}), 17000);

console.log("Done — " + 29 + " SFX written.");
