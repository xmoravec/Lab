import { ApiRequestError } from "@/lib/http-client";

type ApiErrorBody = {
  detail?: string;
  message?: string;
};

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
    let message = `Request failed: ${response.status}`;
    let responseBody: string | undefined;

    try {
      responseBody = await response.text();
      if (responseBody) {
        try {
          const errorPayload = JSON.parse(responseBody) as ApiErrorBody;
          if (errorPayload.detail) {
            message = errorPayload.detail;
          } else if (errorPayload.message) {
            message = errorPayload.message;
          } else {
            message = `${message} - ${responseBody}`;
          }
        } catch {
          message = `${message} - ${responseBody}`;
        }
      }
    } catch {
      // Keep default message when body cannot be read.
    }

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
