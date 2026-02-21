import { requestJson } from "@/lib/http-client";

type RevalidatedRequestInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

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
  const init: RevalidatedRequestInit = {
    cache: "force-cache",
    next: { revalidate: 60 },
  };
  return requestJson<HomeContentResponse>("/api/home", init);
}

export async function fetchGamesCatalog(): Promise<GamesCatalogResponse> {
  const init: RevalidatedRequestInit = {
    cache: "force-cache",
    next: { revalidate: 60 },
  };
  return requestJson<GamesCatalogResponse>("/api/games", init);
}

export async function fetchWordleLeaderboard(): Promise<GameLeaderboardResponse> {
  const init: RevalidatedRequestInit = {
    cache: "force-cache",
    next: { revalidate: 15 },
  };
  return requestJson<GameLeaderboardResponse>("/api/leaderboards/wordle", init);
}
