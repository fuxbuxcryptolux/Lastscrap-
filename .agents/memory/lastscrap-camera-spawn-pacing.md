---
name: Camera/world expansion breaks spawn-distance pacing
description: When a top-down game moves from a single-screen arena to a larger world with a camera, enemy spawn margins tuned for the old arena become far too close to the player.
---

When a game's world is expanded beyond the viewport and a camera is added to follow the player, any "spawn just off-screen" logic that used a small fixed margin (tuned for the old fixed-size, no-camera arena) will spawn enemies almost on top of the player instead of at a safe distance — because "off-screen" now means "off the camera viewport", which is much smaller than the old full arena.

**Why:** In Last Scrap, a 40px margin was fine when the arena was exactly one screen and zombies spawned at the arena's corners/edges (far from a centered player). After introducing camera-follow + a world 2.6x larger than the viewport, that same 40px margin put spawns just barely past the visible screen edge, giving the player almost no reaction time and causing near-instant, un-survivable deaths even in the very first (easiest) wave — a regression that was easy to misdiagnose as a damage/HP balance bug instead of a spawn-distance bug.

**How to apply:** Whenever adding camera-follow or expanding a game world, re-derive any "spawn margin" / "off-screen distance" constants from the viewport size (e.g. `Math.max(minPx, viewportWidth * fraction)`), not a hardcoded pixel value from before the change. When debugging "player dies instantly / unfairly" after a world-scale or camera change, check spawn-distance-from-player *before* auditing HP/damage formulas — a too-small spawn margin can look identical to a damage-balance bug in a fast-clear playtest.
