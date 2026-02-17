import { proxyBackendJson } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { gameId: string };

  return proxyBackendJson({
    method: "POST",
    path: "/api/games/wordle/reveal-answer",
    authMode: "required",
    body: {
      gameId: payload.gameId,
    },
  });
}
