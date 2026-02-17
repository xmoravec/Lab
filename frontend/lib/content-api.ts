import { requestJson } from "@/lib/http-client";

export type GameCard = {
  slug: string;
  name: string;
  summary: string;
  status: string;
  accent: string;
  estimatedSessionMinutes: number;
};

export type HomeContentResponse = {
  heroTitle: string;
  heroSubtitle: string;
  featuredGames: GameCard[];
  highlights: string[];
};

export type GamesCatalogResponse = {
  items: GameCard[];
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  averageAttempts: number;
  eloScore: number;
};

export type GameLeaderboardResponse = {
  gameSlug: string;
  generatedAt: string;
  entries: LeaderboardEntry[];
};

export async function fetchHomeContent(): Promise<HomeContentResponse> {
  return requestJson<HomeContentResponse>("/api/home");
}

export async function fetchGamesCatalog(): Promise<GamesCatalogResponse> {
  return requestJson<GamesCatalogResponse>("/api/games");
}

export async function fetchWordleLeaderboard(): Promise<GameLeaderboardResponse> {
  return requestJson<GameLeaderboardResponse>("/api/leaderboards/wordle");
}
