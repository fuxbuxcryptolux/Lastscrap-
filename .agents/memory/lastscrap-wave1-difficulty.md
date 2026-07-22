---
name: Last Scrap wave-1 difficulty requires active dodging
description: Why a bot/test holding fire without moving dies within ~10s even on wave 1, and how to test survival-sensitive changes safely.
---

Standing still at the player spawn point while holding fire (no joystick movement) reliably leads to player death within ~8-10 seconds, even on wave 1 with only base zombies. This is intentional/pre-existing game balance, not a bug — the game is designed around active movement/dodging, and zombies converge on a stationary player fast enough to overwhelm HP regardless of fire rate.

**Why:** Confirmed by diffing the contact-damage logic against the prior commit — unchanged, so a stationary bot dying fast is not a regression from unrelated work.

**How to apply:** When writing e2e test plans for this game, don't assume "hold fire and wait N seconds" implies survival — either include joystick movement in the plan, or test non-combat-dependent things (pause/resume, HUD render, menu nav) with a very short time window right after game start, before zombies can close the distance. When investigating "player died too fast" reports, diff the relevant damage logic against the previous commit before assuming a regression.
