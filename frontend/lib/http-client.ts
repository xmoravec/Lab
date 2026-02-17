import { parseApiError } from "@/lib/api-error";

function resolvePublicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

export class ApiRequestError extends Error {
  status: number;
  path: string;
  method: string;
  requestUrl: string;
  responseBody?: string;

  constructor(params: {
    message: string;
    status: number;
    path: string;
    method: string;
    requestUrl: string;
    responseBody?: string;
  }) {
    super(params.message);
    this.name = "ApiRequestError";
    this.status = params.status;
    this.path = params.path;
    this.method = params.method;
    this.requestUrl = params.requestUrl;
    this.responseBody = params.responseBody;
  }

  get isExpectedClientRejection(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_BASE_URL ?? "http://backend:8000";
  }

  return resolvePublicApiBaseUrl();
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const requestUrl = `${resolveApiBaseUrl()}${path}`;
  const method = init?.method ?? "GET";
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("API network request failed", {
      path,
      method,
      requestUrl,
      error,
    });
    throw error;
  }

  if (!response.ok) {
    let responseBody: string | undefined;

    try {
      responseBody = await response.text();
    } catch {
      // Keep default message when response body cannot be read.
    }

    const message = parseApiError(response.status, responseBody);

    const apiError = new ApiRequestError({
      message,
      status: response.status,
      path,
      method,
      requestUrl,
      responseBody,
    });

    const logDetails = {
      path,
      method,
      requestUrl,
      status: response.status,
      message,
      responseBody,
    };

    if (apiError.isExpectedClientRejection) {
      console.warn("API request rejected", logDetails);
    } else {
      console.error("API request failed", logDetails);
    }

    throw apiError;
  }

  return (await response.json()) as T;
}
