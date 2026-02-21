import { proxyBackendJson } from "@/lib/server/backend-api";
import { getOrCreateGuestId } from "@/lib/server/guest-session";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { difficulty: string; forceNew?: boolean };
  const guestId = await getOrCreateGuestId();

  return proxyBackendJson({
    method: "POST",
    path: "/api/games/wordle/start",
    authMode: "optional",
    guestId,
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
    body: {
      difficulty: payload.difficulty,
      forceNew: payload.forceNew ?? false,
    },
  });
}
