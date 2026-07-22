# LAST SCRAP — Engineering Audit

Scope: `artifacts/lastscrap` (the Expo/React Native game). Based on a full read of
`src/game/*.ts` (engine, weapons, mods, missions, bounties, uniforms, types), the
UI layer (`app/game.tsx`, `src/components/*.tsx`), the vitest/Playwright test
suites, and the design reference (`lastscrap-game-overview.md`). All claims below
are cited `file:line` and were spot-verified against the live source, not taken
on faith from a single pass.

The backend (`artifacts/api-server`) was reviewed only where the game calls into
it (Stripe checkout/entitlements, Boss Rush leaderboard) — both are fully
implemented, not stubs.

---

## 1. Current state of game mechanics

### Core loop & modes
Four `GameMode`s exist in code: **rig-defense** (defend a fixed RIG through
escalating waves, horde every 5th wave, boss every 7th), **boss-rush** (every
wave is a solo boss fight), **scavenge** (timed scrap-quota run, no RIG), and
**story** (7 scripted single-player missions with distinct win conditions). Only
the first three are reachable from the UI — see §2.1, this is the single biggest
gap in the audit.

Difficulty scales through two shared soft-cap curve functions
(`waveCurve`/`waveAdd`, `engine.ts:757-763`) applied per-kind with different
rate constants, so HP/speed/damage/spawn-count all grow fast early and
decelerate past ~wave 65. Spawn-count formulas are mode-specific
(`engine.ts:765-914`).

### Combat
Player damage = `weapon.damage × attackUpgrade × overdriveMul × laserUniformMul
(laser only) × hordeUniformMul (horde only) × crateBoostMul` (`engine.ts:1219`).
Weapon mods (`mods.ts`) never touch damage — only fire rate, reload, mag size,
pierce, and ammo status effects (fire/cryo/poison/laser-pierce). Incoming
contact damage uses a single shared formula
(`effDamage × CONTACT_INVULN(0.35) × CONTACT_DPS_MUL(1.3) × (1 − min(0.85,
armor))`, applied identically at `engine.ts:2390/2527/2560`) with a 0.35s
per-hit invulnerability window — this is the fix for the historical
multi-attacker damage-stacking bug and is applied consistently everywhere
(see `.agents/memory/lastscrap-contact-invuln.md`).

### Zombies
9 `ZombieKind`s are defined. **5 have unique AI**: spitter (kites + ranged acid),
screamer (aura-buffs nearby zombies +35% speed/+25% dmg, doesn't buff itself),
bomber (telegraph → self-detonate AoE), boss (telegraphed slam attack + guaranteed
bonus scrap drop). **4 behave identically to a generic zombie** (only stat
tuning differs): walker, runner, brute, tank, crawler (tank and crawler have
dedicated *spawners* with unique stat curves, but no unique *behavior* in the
tick loop — `engine.ts:2540` generic-movement block covers all of them).

### Progression & economy
8 upgrade stats (`UPGRADE_KEYS`, `types.ts:164-173`), 9 weapons unlocked by wave
milestone, 3 throwables, 1 upgradeable turret (levels 1-6, 4 stats), 5 abilities
(one equipped at a time), 8 weapon mods (3 slots/weapon), 6 uniforms (5 paid via
Stripe + 1 wave-200 unlock), and a 3-slot rotating bounty system. All of these
are fully wired end-to-end from data → engine → shop UI (verified — every
`*_ORDER` / `*_KEYS` constant is iterated by its corresponding shop panel with
no orphans in either direction, §3 UI audit).

### Story mode
All 7 `MissionObjectiveType`s (escape/scavenge/eliminate/hold/escort/sabotage/
defend) are fully implemented in the engine (`setupStoryMission`,
`tickStoryObjective`, wave-clear branch) and in HUD display — but the mission-
select screen that would let a player start one is never mounted (§2.1).

### Persistence & backend
Local storage covers best-run stats (per-mode keys), mid-run save/resume, sound
settings, and campaign progress. The Stripe checkout/entitlement flow and the
Boss Rush leaderboard (`artifacts/api-server/src/routes/{stripe,leaderboard}.ts`)
are both real, complete implementations (DB-backed, webhook fulfillment,
dedup/upsert logic) — not placeholders. AdMob rewarded/interstitial ads are
wired with a real Android unit ID but a **placeholder iOS interstitial ID**
(`src/utils/admob.ts:21`, literally `.../1234567890`).

### Test coverage
Unit tests (vitest) cover mode transitions, bounty completion semantics, and
all 7 story objective types in good depth (`src/game/__tests__/*.test.ts`,
~1,500 lines). 3 Playwright e2e specs exercise the bounty HUD/shop and Boss
Rush score panel via a `window.__testHooks` dev-only bridge (`app/game.tsx:530`).
I was not able to execute `npm test` / `playwright test` in this sandboxed
environment (shell command execution was blocked), so pass/fail status is
unverified — that should be the first thing a follow-up session confirms.

---

## 2. Inconsistencies & gaps found

Ordered roughly by player-facing impact.

### 2.1 — Story Mode is completely unreachable (dead campaign content)
`StoryModeSelect.tsx` (572 lines, default export) is never imported by any
screen — `app/game.tsx:59` imports only its two helper functions
(`saveCampaignProgress`/`loadCampaignProgress`). `ModeSelect.tsx:178-208` (the
only mode picker actually wired into `app/index.tsx`) offers just 3 cards: RIG
DEFENSE / BOSS RUSH / SCAVENGE — no "Story"/"Campaign" entry. `app/_layout.tsx`
registers only `index` and `game` as stack screens, so no route exists to host
the mission-select screen either. Net effect: the entire 7-mission campaign
(`missions.ts`), its complete engine support (`setupStoryMission`,
`tickStoryObjective`), and the 572-line mission-select/briefing UI are
unreachable without hand-crafting a deep link — no button in the app leads
there. This is a fully-built feature sitting dead behind a missing entry point.

### 2.2 — `street` uniform's 2nd turret can't be deployed or seen
`uniformBonuses("street")` grants `maxTurrets: 2` (`uniforms.ts:192`) and
`deployTurret()` correctly enforces the per-uniform cap
(`engine.ts:1379`). But `DeployBar.tsx:14` hardcodes
`const placed = state.turrets.length >= 1`, hiding the DEPLOY button after the
first turret, and the turret status card only ever reads `state.turrets[0]`
(`DeployBar.tsx:64-70`). A Street-uniform player who paid for the 2-turret perk
can never place or monitor the second turret through the UI.

### 2.3 — Charged laser shot skips the Space Marine laser-damage bonus
`fireOne` applies `ub.laserDamageMul` for tap-fire laser shots
(`engine.ts:1216`), but `fireLaserCharged` — the laser's primary charged-shot
path — computes damage without it (`engine.ts:1277`). Space Marine's "+40%
laser rifle damage" perk (`uniforms.ts:44`) silently doesn't apply to charged
shots, the weapon's main use case.

### 2.4 — Debug wall-editor is live in production, freezes the game loop
`Arena.tsx:110-118`:
```ts
// Set to false again once wall placement is finalized — this intentionally
// overrides __DEV__ so the tool also works on the deployed/production URL.
const SHOW_WALL_DEBUG = true;
```
This renders a "WALLS" button in the corner of every game screen, in
production, for every player. Opening it drags a full collision-rect editor
over the arena and **pauses the entire tick loop** while active
(`app/game.tsx:227-234`, gated by `onDebugChange`). Looks like a shipped-by-
accident dev tool.

### 2.5 — Two uniform-bonus fields are defined but never read
`UniformBonuses.magnetizerActive` (meant to force-enable the magnetizer for
Space Marine, `uniforms.ts:162`) and `UniformBonuses.gatlingReloadBonus`
(`uniforms.ts:133`, never even set by any uniform branch) have **zero**
references anywhere in `engine.ts`. Space Marine's advertised "Magnetizer
active from wave 1" perk (`uniforms.ts:43`) is not actually implemented —
magnetizer range is driven purely by turret upgrade level
(`turretMagnetizerRange`, wired at `engine.ts:1394`), which has nothing to do
with the uniform.

### 2.6 — Bounty reward-payout logic is implemented three separate times
`bounties.ts:awardCompletedBounties` is exported and has full unit-test
coverage but is **never called** from either `engine.ts` or `app/game.tsx`.
Instead, `engine.ts:tickBountyProgress` (~1742) inlines its own copy of
"pay reward once, guarded by `rewardAwarded`", and `app/game.tsx:268-274`
inlines a *third*, independent copy for the two wave-clear-only bounty types
(GHOST PROTOCOL / SPEED CLEAR, resolved via `tickWaveClearBounties`, which
**is** correctly called from `app/game.tsx:266` — not dead, just called from
the UI driver rather than the engine). Three parallel implementations of the
same "award once" rule is a real drift risk: a future change to one won't
propagate to the other two.

### 2.7 — Comment says walker-only through wave 2; code says wave 1 only
`engine.ts:1069-1070`: *"Waves 1-2 are a walker-only onboarding ramp — no
runners/brutes/specials yet"* — but the runner spawn gate is `wave >= 2`
(`engine.ts:1081`), so runners already appear on wave 2. Onboarding is one wave
shorter than the comment (and presumably the design intent) states.

### 2.8 — Boss Rush boss HP isn't compensated for its 7× denser boss cadence
`spawnBoss`/`spawnFinaleBoss` scale HP off raw `s.wave` (`engine.ts:1015`+),
the same curve rig-defense uses where bosses appear every 7th wave
(`BOSS_INTERVAL = 7`). In Boss Rush every wave *is* a boss and `s.wave`
increments by 1 per fight, so "boss #5" in Boss Rush (wave 5) is dramatically
weaker than "boss #5" in rig-defense (wave 35). Loot is separately doubled for
Boss Rush (`bossRushMul`, `engine.ts:2762`) but combat difficulty is not
mode-aware, which likely makes Boss Rush's difficulty curve feel wrong
relative to its reward curve.

### 2.9 — Grenades/mines never damage the player or RIG (only bombers do)
`explode()`'s player/RIG-damage branch is gated behind `opts.hurtsObjectives`
(`engine.ts:1156`), which only `detonateBomber` passes
(`engine.ts:1650`). Player-thrown grenades and mines call `explode()` with no
4th argument at all, so their blasts can never hurt the player or the RIG —
only zombies/turrets. This is plausibly intentional (no accidental
self-damage from your own ordnance), but it's implicit in an unused optional
parameter rather than a documented rule, and is easy to break by accident in
a future edit. Worth an explicit comment or a named constant either way.

### 2.10 — Leftover Expo scaffold route is still present and unregistered
`app/(tabs)/_layout.tsx` and `app/(tabs)/index.tsx` (placeholder "Replit Agent
is building..." screen) still exist in the tree. `app/_layout.tsx:66-74`
registers only `index` and `game` in its `<Stack>`, so this route group is
orphaned. Per `.agents/memory/lastscrap-expo-tabs.md`, this exact scaffold
folder has previously caused Metro to crash silently because Expo Router's
file-based routing picks up route groups even when unreferenced by the root
layout — worth confirming this isn't intermittently breaking dev/prod builds,
and deleting the folder if it serves no purpose.

### 2.11 — `HOLD_ZONE_PENALTY_PER_SEC` dead constant contradicts actual behavior
`engine.ts:1865` defines `HOLD_ZONE_PENALTY_PER_SEC = 3.5` ("seconds drained per
second outside zone") but it's never referenced again. The real hold-objective
logic simply **pauses** the timer when the player leaves the zone
(`engine.ts:1911-1924`, explicit comment: "no refill penalty"). Looks like an
earlier punitive design was replaced but the tuning constant was never removed
— low risk, but confusing for anyone tuning Story Mode's HOLD mission later.

### 2.12 — Minor: 4 of 9 weapons play the pistol's fire sound
`sfx.shoot(weapon)` (`sound.ts:311-314`) falls back to `shoot_pistol` for any
weapon id not in the sound manifest. The manifest has `shoot_{pistol,shotgun,
smg,ar,laser}` but no `shoot_{lrg,gatling,launcher,rpg}` — so the LRG, Gatling,
Launcher, and RPG (4 of the game's 9 weapons, including its two heaviest) all
play the pistol's snap instead of a distinct report.

### 2.13 — Minor: unused image assets suggest wired-but-abandoned art
`chest_0/1/2.png`, `map.png`, `map2.png`, `map_wide.png`, and `hero_new.jpg`
are never `require()`'d anywhere. Crate pickups (mid-wave event crates and
scavenge crates) are drawn as procedural `View` boxes instead
(`Arena.tsx:761-765`, `793-807`) even though 3 chest sprite variants exist and
`ScrapCrate`/`GameEvent` both carry a `variant: number` field seemingly meant
for them. `arena.png` is eagerly preloaded at boot (`app/_layout.tsx:24`) but
never displayed (the real floor texture is `maze.png`/`rigdef_map.png`).

### 2.14 — Minor: no in-run access to audio settings
`SettingsPanel` (SFX volume/mute) is reachable only from the main menu gear
icon. `PauseOverlay` (RESUME / SCRAPYARD / SAVE GAME / ABORT) has no settings
entry, so a player can't mute or adjust volume once a run has started.

### 2.15 — Minor cleanup: redundant `pointerEvents` style props
The historical "must be a JSX prop, not a style property" pointer-events fix
(`.agents/memory/rn-web-pointerevents.md`) is correctly applied everywhere it
matters, but 3 spots still carry the old, functionally-redundant style-property
form alongside the correct prop: `HUD.tsx:542`, `HUD.tsx:552`,
`app/game.tsx:1202`. Harmless today, but a trap if someone later removes the
JSX prop assuming the style covers it.

---

## 3. Prioritized recommended next tasks

**P0 — ship-blocking / high player-visible impact**
1. **Wire up Story Mode** (§2.1): add a "STORY" / "CAMPAIGN" card to
   `ModeSelect.tsx`, register a route (or reuse `/game`) that mounts
   `StoryModeSelect`, and smoke-test all 7 missions end-to-end. This is the
   single largest chunk of already-built, currently-inaccessible content in
   the codebase.
2. **Remove or gate the production wall-debug tool** (§2.4): wrap
   `SHOW_WALL_DEBUG` in `__DEV__` (or delete it if wall placement is finalized)
   so players can't freeze/inspect the game loop in production.
3. **Run the existing test suites and fix whatever's red** — `npm test` and
   `npm run test:e2e` could not be executed in this session; that should be
   the very next step before trusting any of the above analysis as "confirmed
   working."

**P1 — real gameplay/economy bugs**
4. Fix the Street uniform's second-turret deploy/status UI (§2.2).
5. Apply `ub.laserDamageMul` in `fireLaserCharged` (§2.3) — one-line fix,
   currently silently undercutting a paid uniform's advertised perk.
6. Either implement `magnetizerActive` for Space Marine or remove the
   perk claim from `uniforms.ts:43` and the field from `UniformBonuses`
   (§2.5) — currently sold copy doesn't match behavior.
7. Make Boss Rush boss HP scaling mode-aware (§2.8) so its difficulty curve
   matches its already-doubled reward curve.
8. Consolidate bounty-reward-award logic to one implementation (§2.6) —
   pick `awardCompletedBounties` as the single source of truth and call it
   from both `tickBountyProgress` and the wave-clear block in `game.tsx`.

**P2 — polish / correctness / cleanup**
9. Add the missing 4 weapon fire sounds (or intentionally document the
   pistol-sound fallback as acceptable) (§2.12).
10. Wire the unused chest sprites into crate rendering, or delete the assets
    (§2.13); drop the dead `arena.png` preload.
11. Add an audio-settings entry point to the in-run pause menu (§2.14).
12. Delete or fix the orphaned `app/(tabs)` scaffold route (§2.10) — confirm
    it isn't an intermittent Metro-crash risk per prior incident notes.
13. Remove the dead `HOLD_ZONE_PENALTY_PER_SEC` constant and the redundant
    `pointerEvents` style props (§2.11, §2.15) — cheap, low-risk cleanup.
14. Fix the stale onboarding comment at `engine.ts:1069` (§2.7) or shorten
    the walker-only window to match it, whichever reflects actual intent.
15. Replace the placeholder iOS AdMob interstitial unit ID
    (`admob.ts:21`) before an iOS release.
16. Update `lastscrap-game-overview.md` — it predates Boss Rush, Scavenge,
    Story mode, the mods system, and the bounty system entirely, and is
    the closest thing this repo has to a design spec. It's actively
    misleading to anyone using it as a current reference.
