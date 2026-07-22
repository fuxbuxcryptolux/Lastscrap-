import { pgTable, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bossRushLeaderboardTable = pgTable(
  "boss_rush_leaderboard",
  {
    id: text("id").primaryKey(),
    playerName: text("player_name").notNull(),
    wave: integer("wave").notNull(),
    kills: integer("kills").notNull().default(0),
    scrap: integer("scrap").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("boss_rush_leaderboard_player_name_idx").on(t.playerName)]
);

export const insertBossRushLeaderboardSchema = createInsertSchema(bossRushLeaderboardTable).omit({
  createdAt: true,
});
export type InsertBossRushLeaderboard = z.infer<typeof insertBossRushLeaderboardSchema>;
export type BossRushLeaderboardEntry = typeof bossRushLeaderboardTable.$inferSelect;
