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

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_BASE_URL ?? "http://backend:8000";
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchHomeContent(): Promise<HomeContentResponse> {
  return request<HomeContentResponse>("/api/home");
}

export async function fetchGamesCatalog(): Promise<GamesCatalogResponse> {
  return request<GamesCatalogResponse>("/api/games");
}
