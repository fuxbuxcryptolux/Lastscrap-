import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, bossRushLeaderboardTable } from "@workspace/db";
import {
  GetBossRushLeaderboardResponse,
  SubmitBossRushScoreBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const TOP_N = 10;

router.get("/leaderboard/boss-rush", async (req, res): Promise<void> => {
  // Fetch all rows ordered by best score; deduplicate per callsign in application
  // code so that any legacy duplicate rows in the DB don't pollute the list.
  const all = await db
    .select()
    .from(bossRushLeaderboardTable)
    .orderBy(desc(bossRushLeaderboardTable.wave), desc(bossRushLeaderboardTable.kills));

  // Keep the first (best) occurrence of each callsign
  const seen = new Set<string>();
  const deduped = all.filter((e) => {
    if (seen.has(e.playerName)) return false;
    seen.add(e.playerName);
    return true;
  });

  const entries = deduped.slice(0, TOP_N);

  res.json(
    GetBossRushLeaderboardResponse.parse(
      entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))
    )
  );
});

router.post("/leaderboard/boss-rush", async (req, res): Promise<void> => {
  const parsed = SubmitBossRushScoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { playerName, wave, kills, scrap } = parsed.data;

  // Atomic upsert: insert or — on callsign collision — update only when the new
  // score beats the existing best (higher wave, or same wave with more kills).
  // CASE expressions keep the existing values when the condition is false so
  // RETURNING always gives us the current state of the row.
  const upserted = await db
    .insert(bossRushLeaderboardTable)
    .values({ id: randomUUID(), playerName, wave, kills, scrap })
    .onConflictDoUpdate({
      target: bossRushLeaderboardTable.playerName,
      set: {
        wave: sql`CASE
          WHEN excluded.wave > ${bossRushLeaderboardTable.wave}
            OR (excluded.wave = ${bossRushLeaderboardTable.wave}
                AND excluded.kills > ${bossRushLeaderboardTable.kills})
          THEN excluded.wave
          ELSE ${bossRushLeaderboardTable.wave}
        END`,
        kills: sql`CASE
          WHEN excluded.wave > ${bossRushLeaderboardTable.wave}
            OR (excluded.wave = ${bossRushLeaderboardTable.wave}
                AND excluded.kills > ${bossRushLeaderboardTable.kills})
          THEN excluded.kills
          ELSE ${bossRushLeaderboardTable.kills}
        END`,
        scrap: sql`CASE
          WHEN excluded.wave > ${bossRushLeaderboardTable.wave}
            OR (excluded.wave = ${bossRushLeaderboardTable.wave}
                AND excluded.kills > ${bossRushLeaderboardTable.kills})
          THEN excluded.scrap
          ELSE ${bossRushLeaderboardTable.scrap}
        END`,
      },
    })
    .returning();

  const row = upserted[0];
  if (!row) {
    res.status(500).json({ error: "Upsert returned no row" });
    return;
  }

  // If the row's current best doesn't match the submitted score the existing
  // entry was superior — this submission doesn't improve the rank.
  const scoreImproved = row.wave === wave && row.kills === kills;
  if (!scoreImproved) {
    res.json({ ranked: false, rank: null });
    return;
  }

  // Re-fetch the top N (deduplicated) to determine final rank
  const all = await db
    .select()
    .from(bossRushLeaderboardTable)
    .orderBy(desc(bossRushLeaderboardTable.wave), desc(bossRushLeaderboardTable.kills));

  const seen = new Set<string>();
  const deduped = all.filter((e) => {
    if (seen.has(e.playerName)) return false;
    seen.add(e.playerName);
    return true;
  });

  const top = deduped.slice(0, TOP_N);
  const rank = top.findIndex((e) => e.playerName === playerName) + 1;

  req.log.info({ playerName, wave, rank }, "Boss Rush score submitted");

  res.json({ ranked: rank > 0, rank: rank > 0 ? rank : null });
});

export default router;
