import { auth } from "@/auth";
import { cookies } from "next/headers";

const backendBaseUrl = process.env.API_INTERNAL_BASE_URL ?? "http://backend:8000";
const internalAuthSecret = process.env.BACKEND_INTERNAL_AUTH_SECRET ?? "lab-internal-dev-secret";
const ADMIN_MODE_COOKIE_NAME = "lab_admin_mode";

type ProxyOptions = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  authMode?: "none" | "required" | "optional";
  guestId?: string;
};

export async function proxyBackendJson(options: ProxyOptions): Promise<Response> {
  const session = await auth();
  const cookieStore = await cookies();
  const authMode = options.authMode ?? "none";
  const hasUserSession = Boolean(session?.user?.id && session.user.email && session.user.username);
  const adminModeEnabled =
    hasUserSession &&
    Boolean(session?.user?.isAdmin) &&
    cookieStore.get(ADMIN_MODE_COOKIE_NAME)?.value === "on";

  if (authMode === "required" && !hasUserSession) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authMode === "required" || authMode === "optional") {
    headers["x-internal-auth"] = internalAuthSecret;

    if (hasUserSession) {
      headers["x-user-id"] = session!.user.id;
      headers["x-user-name"] = session!.user.username;
      headers["x-user-email"] = session!.user.email!;
      if (adminModeEnabled) {
        headers["x-admin-mode"] = "on";
      }
    } else if (authMode === "optional" && options.guestId) {
      headers["x-guest-id"] = options.guestId;
    }
  }

  const response = await fetch(`${backendBaseUrl}${options.path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const rawBody = await response.text();
  const contentType = response.headers.get("content-type") ?? "application/json";

  return new Response(rawBody, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
