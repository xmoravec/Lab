import { proxyBackendJson } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as {
    difficulty: "common" | "extended";
    clueRows: Array<{
      greenPattern: string;
      yellowLetters: string;
      grayLetters: string;
    }>;
    maxSuggestions?: number;
  };

  return proxyBackendJson({
    method: "POST",
    path: "/api/tools/wordle_solver/solve",
    authMode: "none",
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
    body: {
      difficulty: payload.difficulty,
      clueRows: payload.clueRows,
      maxSuggestions: payload.maxSuggestions,
    },
  });
}
