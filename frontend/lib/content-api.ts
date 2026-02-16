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

export async function fetchHomeContent(): Promise<HomeContentResponse> {
  return requestJson<HomeContentResponse>("/api/home");
}

export async function fetchGamesCatalog(): Promise<GamesCatalogResponse> {
  return requestJson<GamesCatalogResponse>("/api/games");
}
