/**
 * API-level tests for GET /api/leaderboard/boss-rush and
 * POST /api/leaderboard/boss-rush.
 *
 * @workspace/db and drizzle-orm are mocked so no real database is required.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ---------------------------------------------------------------------------
// Shared mock state — mutated in beforeEach / per-test setup.
// vi.hoisted() ensures these run before vi.mock() factories below.
// ---------------------------------------------------------------------------
const mockState = vi.hoisted(() => ({
  selectRows: [] as any[],
  insertRows: [] as any[],
}));

// Mock drizzle-orm helpers so the CASE sql`` expressions don't throw when
// called with our fake table column stubs.
vi.mock("drizzle-orm", () => ({
  desc: (col: unknown) => col,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

// Mock @workspace/db — replace the drizzle db object with chainable stubs.
vi.mock("@workspace/db", () => {
  return {
    db: {
      select: () => ({
        from: () => ({
          orderBy: () => Promise.resolve(mockState.selectRows),
        }),
      }),
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({
            returning: () => Promise.resolve(mockState.insertRows),
          }),
        }),
      }),
    },
    bossRushLeaderboardTable: {
      playerName: "playerName_col",
      wave: "wave_col",
      kills: "kills_col",
    },
  };
});

// ---------------------------------------------------------------------------
// Import the router AFTER mocks are set up.
// ---------------------------------------------------------------------------
import leaderboardRouter from "../leaderboard.js";

// Build a minimal Express app — just enough to exercise the router.
// We add a req.log stub because pino-http is not in scope here.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { info: () => {}, error: () => {}, warn: () => {} };
    next();
  });
  app.use("/api", leaderboardRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEntry(
  playerName: string,
  wave: number,
  kills: number,
  scrap = 100,
) {
  return {
    id: `id-${playerName}`,
    playerName,
    wave,
    kills,
    scrap,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/leaderboard/boss-rush", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    mockState.selectRows = [];
    mockState.insertRows = [];
  });

  it("returns an empty array when the board is empty", async () => {
    mockState.selectRows = [];

    const res = await request(app).get("/api/leaderboard/boss-rush");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns entries in descending wave then kills order", async () => {
    mockState.selectRows = [
      makeEntry("ALPHA", 5, 30),
      makeEntry("BETA", 3, 50),
      makeEntry("GAMMA", 3, 20),
    ];

    const res = await request(app).get("/api/leaderboard/boss-rush");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].playerName).toBe("ALPHA");
    expect(res.body[1].playerName).toBe("BETA");
    expect(res.body[2].playerName).toBe("GAMMA");
  });

  it("deduplicates entries keeping the first (best) occurrence per callsign", async () => {
    // Simulate two DB rows for the same player — the first (best) must win.
    mockState.selectRows = [
      makeEntry("PILOT", 7, 40),
      makeEntry("PILOT", 3, 10), // stale duplicate
      makeEntry("GHOST", 5, 20),
    ];

    const res = await request(app).get("/api/leaderboard/boss-rush");

    expect(res.status).toBe(200);
    const pilots = (res.body as any[]).filter(
      (e: any) => e.playerName === "PILOT",
    );
    expect(pilots).toHaveLength(1);
    expect(pilots[0].wave).toBe(7);
    expect(res.body).toHaveLength(2);
  });

  it("caps the response at 10 entries (full board)", async () => {
    mockState.selectRows = Array.from({ length: 15 }, (_, i) =>
      makeEntry(`PLAYER${i}`, 10 - i, i * 5),
    );

    const res = await request(app).get("/api/leaderboard/boss-rush");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
  });

  it("returns ISO-8601 createdAt strings", async () => {
    mockState.selectRows = [makeEntry("ACE", 2, 8)];

    const res = await request(app).get("/api/leaderboard/boss-rush");

    expect(res.status).toBe(200);
    expect(typeof res.body[0].createdAt).toBe("string");
    expect(() => new Date(res.body[0].createdAt)).not.toThrow();
  });
});

describe("POST /api/leaderboard/boss-rush", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    mockState.selectRows = [];
    mockState.insertRows = [];
  });

  it("returns 400 for a missing playerName", async () => {
    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ wave: 3, kills: 10, scrap: 50 });

    expect(res.status).toBe(400);
  });

  it("returns 400 for wave < 1", async () => {
    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ playerName: "PILOT", wave: 0, kills: 10, scrap: 50 });

    expect(res.status).toBe(400);
  });

  it("returns 400 for negative kills", async () => {
    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ playerName: "PILOT", wave: 3, kills: -1, scrap: 50 });

    expect(res.status).toBe(400);
  });

  it("happy path — new score is #1 on an otherwise empty board", async () => {
    const submitted = makeEntry("PILOT", 5, 30);
    mockState.insertRows = [submitted];
    // After insert the rank-check select returns the same single entry
    mockState.selectRows = [submitted];

    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ playerName: "PILOT", wave: 5, kills: 30, scrap: 100 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ranked: true, rank: 1 });
  });

  it("returns ranked:false when the existing record is superior", async () => {
    // The upsert kept the existing row (wave=7 beats wave=5)
    const existingBest = makeEntry("PILOT", 7, 40);
    mockState.insertRows = [existingBest];
    // selectRows not reached in this branch

    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ playerName: "PILOT", wave: 5, kills: 10, scrap: 50 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ranked: false, rank: null });
  });

  it("correctly ranks a new score at position 2 on a populated board", async () => {
    const board = [
      makeEntry("ACE", 10, 80),  // rank 1
      makeEntry("PILOT", 8, 60), // this submission → rank 2
      makeEntry("ROOK", 5, 30),  // rank 3
    ];
    mockState.insertRows = [makeEntry("PILOT", 8, 60)];
    mockState.selectRows = board;

    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ playerName: "PILOT", wave: 8, kills: 60, scrap: 200 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ranked: true, rank: 2 });
  });

  it("tie-breaking: same wave, more kills wins over fewer kills", async () => {
    // Submission: wave=5, kills=50 — beats ROOK (wave=5, kills=20)
    // The upsert returns the submitted (better) values
    const submitted = makeEntry("ROOK", 5, 50);
    mockState.insertRows = [submitted];
    const board = [
      makeEntry("ACE", 8, 60),
      makeEntry("ROOK", 5, 50), // improved
      makeEntry("GHOST", 3, 90),
    ];
    mockState.selectRows = board;

    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ playerName: "ROOK", wave: 5, kills: 50, scrap: 100 });

    expect(res.status).toBe(200);
    expect(res.body.ranked).toBe(true);
    expect(res.body.rank).toBe(2);
  });

  it("score outside top 10 is still logged but ranked:false", async () => {
    // Board has 10 better entries, submitted entry doesn't make it
    const board = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`PLAYER${i}`, 20 - i, (10 - i) * 5),
    );
    const submitted = makeEntry("NEWBIE", 1, 1);
    mockState.insertRows = [submitted];
    // selectRows returns all 11 entries; deduplicated top-10 won't include NEWBIE
    mockState.selectRows = [...board, submitted];

    const res = await request(app)
      .post("/api/leaderboard/boss-rush")
      .send({ playerName: "NEWBIE", wave: 1, kills: 1, scrap: 0 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ranked: false, rank: null });
  });
});
