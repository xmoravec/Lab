import { proxyBackendJsonFromRequest } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { gameId: string };

  return proxyBackendJsonFromRequest({
    request,
    method: "POST",
    path: "/api/games/wordle/hint",
    authMode: "optional",
    includeGuestId: true,
    body: {
      gameId: payload.gameId,
    },
  });
}
