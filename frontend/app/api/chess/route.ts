import { proxyBackendJson } from "@/lib/server/backend-api";
import { getOrCreateGuestId } from "@/lib/server/guest-session";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as {
    action: string;
    toUsername?: string;
    colorPreference?: "white" | "black" | "random";
    invitationId?: string;
    invitationResponseAction?: "accept" | "decline";
    playAs?: "white" | "black" | "random";
    botDifficulty?: "easy" | "medium" | "hard";
    matchId?: string;
    fromSquare?: string;
    toSquare?: string;
    promotion?: "q" | "r" | "b" | "n";
  };

  const guestId = await getOrCreateGuestId();

  return proxyBackendJson({
    method: "POST",
    path: "/api/games/chess",
    authMode: "optional",
    guestId,
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
    body: payload,
  });
}
