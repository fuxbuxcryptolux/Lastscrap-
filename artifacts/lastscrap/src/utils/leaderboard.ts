function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (domain) return `https://${domain}`;
  return "";
}

export type LeaderboardEntry = {
  id: string;
  playerName: string;
  wave: number;
  kills: number;
  scrap: number;
  createdAt: string;
};

export type SubmitResult = {
  ranked: boolean;
  rank: number | null;
};

export async function fetchBossRushLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const resp = await fetch(`${getApiBase()}/api/leaderboard/boss-rush`);
    if (!resp.ok) return [];
    return (await resp.json()) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export async function submitBossRushScore(
  playerName: string,
  wave: number,
  kills: number,
  scrap: number,
): Promise<SubmitResult | null> {
  try {
    const resp = await fetch(`${getApiBase()}/api/leaderboard/boss-rush`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName, wave, kills, scrap }),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as SubmitResult;
  } catch {
    return null;
  }
}
