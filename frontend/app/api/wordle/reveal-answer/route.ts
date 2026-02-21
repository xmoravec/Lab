import { proxyBackendJson } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { gameId: string };

  return proxyBackendJson({
    method: "POST",
    path: "/api/games/wordle/reveal-answer",
    authMode: "required",
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
    body: {
      gameId: payload.gameId,
    },
  });
}
