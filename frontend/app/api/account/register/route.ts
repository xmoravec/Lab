import { proxyBackendJsonFromRequest } from "@/lib/server/backend-api";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as {
    email: string;
    username: string;
    password: string;
  };

  return proxyBackendJsonFromRequest({
    request,
    method: "POST",
    path: "/api/auth/register",
    authMode: "none",
    body: payload,
  });
}
