# LAST SCRAP — Game Overview

## Premise

You are "the Operator" — a lone scavenger-soldier in a post-apocalyptic wasteland overrun by a viral zombie outbreak. You defend the RIG, a reactor core that is your only source of power and survival, against endless waves of the infected. Every wave you survive, you earn Scrap — the wasteland's only currency — to upgrade your gear before the next wave comes. There's no scripted story or cutscenes; the tone is delivered entirely through terse, military/terminal-style flavor text.

- **Tagline:** "SURVIVE. SCRAP. REPEAT."
- **Genre framing:** "[ TACTICAL SURVIVAL ]"
- **Death text:** "OPERATOR DOWN — The last scrap was not enough." / "RIG OFFLINE"
- **Pause text:** "Reactor cooling. Take a breath, operator."
- One late-game uniform ("Zombie") implies the infection itself is something you can become: "You are the infection."

## Core Loop

1. Deploy into an arena, defend the RIG (fixed at the center of the map) while surviving waves of zombies.
2. Kill zombies with your weapon(s) to earn Scrap and clear the wave.
3. Between waves, spend Scrap at the Upgrade Terminal (stat upgrades, weapons, throwables, turret, abilities) or visit the Scrapyard (uniforms) to get stronger.
4. Repeat — waves get harder over time, with special Horde waves (every 5th) and Boss waves (every 7th).
5. Run ends when the Operator's HP or the RIG's HP hits zero. Progress (best wave/kills/scrap) persists across runs; some unlocks (weapons, uniforms) persist too, making it a roguelite-ish progression game rather than a single-life-only one.

## Gameplay Mechanics

**Controls:** Twin-stick style — a movement joystick (left) and a fire button (right) with auto-aim; the player automatically turns to face and shoot the nearest threat in range when standing still or holding fire.

**Player stats (upgradeable, 8 total):** HP (base 100), Attack, Move Speed, Armor (damage reduction, caps at 65%), Magnetizer (pickup radius), and others. Player has brief invulnerability frames after taking a hit so multiple attackers can't stack damage unfairly.

**World:** A single large arena (larger than the screen) with a camera that follows the player. The RIG sits fixed at the world's center as the objective to protect. Zombies spawn just off-camera and walk/run in toward the player and RIG.

**Weapons (9, unlocked progressively roughly every 5 waves):** Pistol (starter) → shotgun/SMG-tier weapons → Gatling Gun → Laser Rifle (piercing beam) → RPG (large-radius explosive). Also: throwables (grenades, mines), a deployable Auto-Turret, and special Abilities.

**Zombie types:**
- **Walker** — basic melee, slow, only type in waves 1-2 (onboarding).
- **Runner** — fast, low HP, appears from wave 2+.
- **Brute** — tanky melee bruiser, appears from wave 3+.
- **Spitter** — keeps distance, lobs ranged acid projectiles.
- **Screamer** — buffs nearby zombies with a cyan aura (support unit).
- **Bomber** — rushes the player and self-destructs.
- **Tank** — very high HP, slow, armored.
- **Boss** — every 7th wave; massive HP, telegraphed heavy slam attack, guaranteed big scrap payout. Tuned to be tough but beatable with careful kiting.

**Wave system:** Difficulty scales smoothly with a soft-capped curve (fast ramp early, decelerating at very high waves) across zombie HP/speed/damage and scrap rewards. Every 5th wave is a timed **Horde** (a survival gauntlet of nonstop spawns); every 7th wave is a **Boss** wave.

**Economy:** Zombies drop amber "Scrap" nuggets on death. Scrap buys stat upgrades, weapons/throwables/turret/abilities at the Upgrade Terminal, and uniforms at the Scrapyard. Boss/horde waves pay out more.

**Uniforms (6, cosmetic + stat-modifying "loadouts"):** Standard (baseline), Space Marine (+25% defense, slower), Army Basic (unlocks AR, faster), Apocalypse ("wasteland warlord" — 3x scrap, cheap grenades), Street (4x scrap, unlocks Gatling), Zombie (unlocked at wave 200 — zombies ignore you; "You are the infection").

**Mid-wave events/hazards:** Airdrops (must hold/secure a zone to open), environmental Hazards (damaging zones to avoid), Crates (instant free weapon upgrade).

## Screens / UI Surfaces

1. **Main Menu** — Title "LAST SCRAP", tagline, personal-best stats (wave/scrap/kills), active-uniform indicator pill, buttons: DEPLOY/CONTINUE, SCRAPYARD, SETTINGS.
2. **Game Screen (HUD)** — Arena view with camera-follow; HUD shows HP bar, Scrap count, Wave indicator (with boss/horde warnings), RIG integrity bar, current weapon; on-screen joystick + fire button + ability button.
3. **Upgrade Terminal** (between waves) — Tabs for: Upgrades (8 stats), Arsenal (buy weapons/throwables/turret/abilities), plus a free "Field Repair" HP restore button.
4. **Scrapyard** — Browse/purchase/equip uniforms, each with a name and short flavor description.
5. **Pause Overlay** — Resume, Scrapyard, Save Game, Abort Mission.
6. **Game Over Overlay** — Death reason (OPERATOR DOWN / RIG OFFLINE), run stats vs. personal bests, REBOOT SYSTEM (restart) or WATCH AD · REVIVE.

## Visual Aesthetic (current state — useful as a baseline or a "before" reference)

- **Mood:** Dark, industrial, military-terminal / tactical HUD. Think night-vision briefing screens, not cartoonish.
- **Palette:**
  - Background/void: `#080808`
  - Wasteland floor tile: `#141210`
  - Primary accent (orange, used for borders, buttons, highlights): `#D35400`
  - Primary text: `#EAEAEA`
  - Muted/secondary text: `#7A7A7A`
  - Tactical cyan (info/telegraph accents): `#00FFFF`
  - Toxic green (acid/hazard/scrap-adjacent FX): `#39FF14`
  - Blood red (damage/danger): `#FF2A2A`
  - Amber (scrap currency): `#F39C12`
  - EMP blue (special ability FX): `#4FC3F7`
- **Typography:** Courier (monospace, terminal feel) throughout, often bold/black weight with wide letter-spacing (tracked-out headlines) for a stenciled, military-stamp look.
- **UI motifs:** Sharp-cornered "corner bracket" frame decorations (like a HUD viewfinder), segmented/chunky health and progress bars, semi-transparent dark overlays (`rgba(8,8,8,0.88)`) for modals, flat rectangular buttons with thin colored borders rather than soft/rounded skeuomorphic buttons.

## What to ask Gemini for

Since you're handing this off for new UI/menu/graphics work, it's worth telling Gemini explicitly whether you want it to:
- **Refresh/polish** the existing terminal-military aesthetic (keep the palette/mood, improve polish, animation, layout), or
- **Reimagine** the visual direction entirely (different mood — e.g. more painterly/comic, more neon-cyberpunk, more gritty-realistic).

Either way, the mechanics/content above (weapons, zombies, uniforms, screens) are the actual scope Gemini should design assets and layouts for.
