import { proxyBackendJson } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as {
    action: string;
    toUsername?: string;
    colorPreference?: "white" | "black" | "random";
    invitationId?: string;
    invitationResponseAction?: "accept" | "decline";
    playAs?: "white" | "black" | "random";
    matchId?: string;
    fromSquare?: string;
    toSquare?: string;
    promotion?: "q" | "r" | "b" | "n";
  };

  return proxyBackendJson({
    method: "POST",
    path: "/api/games/chess",
    authMode: "required",
    body: payload,
  });
}
