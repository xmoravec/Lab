import { proxyBackendJson } from "@/lib/server/backend-api";
import { getOrCreateGuestId } from "@/lib/server/guest-session";

export async function GET(request: Request): Promise<Response> {
  const guestId = await getOrCreateGuestId();

  return proxyBackendJson({
    method: "GET",
    path: "/api/games/wordle/menu",
    authMode: "optional",
    guestId,
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
  });
}
