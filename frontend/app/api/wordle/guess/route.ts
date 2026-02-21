import { proxyBackendJson } from "@/lib/server/backend-api";
import { getOrCreateGuestId } from "@/lib/server/guest-session";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { gameId: string; guess: string };
  const guestId = await getOrCreateGuestId();

  return proxyBackendJson({
    method: "POST",
    path: "/api/games/wordle/guess",
    authMode: "optional",
    guestId,
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
    body: {
      gameId: payload.gameId,
      guess: payload.guess,
    },
  });
}
