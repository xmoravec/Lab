import { proxyBackendJson } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as {
    email: string;
    username: string;
    password: string;
  };

  return proxyBackendJson({
    method: "POST",
    path: "/api/auth/register",
    authMode: "none",
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
    body: payload,
  });
}
