import { parseApiError } from "@/lib/api-error";
import { ApiRequestError } from "@/lib/http-client";

export async function requestAppJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("App API network request failed", {
      path,
      method,
      error,
    });
    throw error;
  }

  if (!response.ok) {
    let responseBody: string | undefined;

    try {
      responseBody = await response.text();
    } catch {
      // Keep default message when body cannot be read.
    }

    const message = parseApiError(response.status, responseBody);

    throw new ApiRequestError({
      message,
      status: response.status,
      path,
      method,
      requestUrl: path,
      responseBody,
    });
  }

  return (await response.json()) as T;
}
