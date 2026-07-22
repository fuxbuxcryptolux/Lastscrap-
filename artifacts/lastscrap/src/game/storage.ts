// Persistent storage key for best-run stats.
// BEST_KEY is kept as the rig-defense key for backwards compatibility.
export const BEST_KEY = "lastscrap_best_v1";
export const BEST_KEY_BOSS = "lastscrap_best_boss_v1";
export const BEST_KEY_SCAVENGE = "lastscrap_best_scavenge_v1";

// Persistent storage key for mid-run save (cleared on game over).
export const SAVE_KEY = "lastscrap_save_v1";

// Persistent storage key for story campaign progress.
// Shape: { unlockedMission: number; completedMissions: number[]; bonuses: { missionId: number; label: string }[] }
export const STORY_KEY = "lastscrap_story_v1";
