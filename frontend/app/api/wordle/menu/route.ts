import { proxyBackendJsonFromRequest } from "@/lib/server/backend-api";

export async function GET(request: Request): Promise<Response> {
  return proxyBackendJsonFromRequest({
    request,
    method: "GET",
    path: "/api/games/wordle/menu",
    authMode: "optional",
    includeGuestId: true,
  });
}
