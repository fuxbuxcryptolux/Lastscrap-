---
name: Contact-damage stacking fix (per-hit invuln lump damage)
description: Pattern for preventing multiple simultaneous melee attackers from stacking unbounded per-frame damage on the player in a real-time game.
---

Applying contact/melee damage every single frame (`damage * dt`) per attacking enemy is fine for one attacker, but the moment several enemies touch the player at once, per-frame damage from each stacks and can melt the player's HP in a fraction of a second — far faster than the intended single-attacker DPS.

**Why:** In Last Scrap, zombies applied `damage * dt` every frame on contact. With 2-3 zombies touching simultaneously (easy to happen once several converge on a stationary/cornered player), the effective DPS multiplied by attacker count, killing the player almost instantly even on the easiest wave — looked like a balance bug but was actually an uncapped-stacking bug.

**How to apply:** Give the player a brief invulnerability window (e.g. ~0.3-0.4s) after any contact hit, and deliver that hit as a lump (`damage * invulnWindow * dpsMultiplier`) rather than continuous per-frame damage. Set `player.invuln` before processing later attackers in the same frame's enemy loop — since the invuln check happens per-attacker within the same tick, this naturally caps damage to one hit per window regardless of how many enemies are simultaneously touching, while preserving the intended sustained DPS from a single attacker.
