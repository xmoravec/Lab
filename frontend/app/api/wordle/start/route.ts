import { proxyBackendJsonFromRequest } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { difficulty: string; forceNew?: boolean };

  return proxyBackendJsonFromRequest({
    request,
    method: "POST",
    path: "/api/games/wordle/start",
    authMode: "optional",
    includeGuestId: true,
    body: {
      difficulty: payload.difficulty,
      forceNew: payload.forceNew ?? false,
    },
  });
}
