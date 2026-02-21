import { auth } from "@/auth";
import { cookies } from "next/headers";
import { getOrCreateGuestId } from "@/lib/server/guest-session";

const backendBaseUrl = process.env.API_INTERNAL_BASE_URL ?? "http://backend:8000";
const internalAuthSecret = process.env.BACKEND_INTERNAL_AUTH_SECRET ?? "lab-internal-dev-secret";
const ADMIN_MODE_COOKIE_NAME = "lab_admin_mode";
const BACKEND_PROXY_TIMEOUT_MS = 12_000;

if (
  process.env.NODE_ENV === "production" &&
  internalAuthSecret === "lab-internal-dev-secret"
) {
  throw new Error("BACKEND_INTERNAL_AUTH_SECRET must be set to a non-default value in production");
}

export type ProxyOptions = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  authMode?: "none" | "required" | "optional";
  guestId?: string;
  forwardedFor?: string;
  realIp?: string;
};

type ProxyFromRequestOptions = Omit<ProxyOptions, "forwardedFor" | "realIp" | "guestId"> & {
  request: Request;
  includeGuestId?: boolean;
};

function resolveForwardingHeaders(request: Request): Pick<ProxyOptions, "forwardedFor" | "realIp"> {
  return {
    forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
    realIp: request.headers.get("x-real-ip") ?? undefined,
  };
}

export async function proxyBackendJsonFromRequest(options: ProxyFromRequestOptions): Promise<Response> {
  const forwardingHeaders = resolveForwardingHeaders(options.request);
  const guestId = options.includeGuestId ? await getOrCreateGuestId() : undefined;

  return proxyBackendJson({
    method: options.method,
    path: options.path,
    body: options.body,
    authMode: options.authMode,
    forwardedFor: forwardingHeaders.forwardedFor,
    realIp: forwardingHeaders.realIp,
    guestId,
  });
}

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

  if (options.forwardedFor) {
    headers["x-forwarded-for"] = options.forwardedFor;
  }

  if (options.realIp) {
    headers["x-real-ip"] = options.realIp;
  }

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

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort();
  }, BACKEND_PROXY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${backendBaseUrl}${options.path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return Response.json({ detail: "Backend request timed out" }, { status: 504 });
    }
    return Response.json({ detail: "Failed to reach backend" }, { status: 502 });
  } finally {
    clearTimeout(timeoutHandle);
  }

  const rawBody = await response.text();
  const contentType = response.headers.get("content-type") ?? "application/json";

  return new Response(rawBody, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
