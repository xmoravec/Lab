export type HealthResponse = {
  appName: string;
  status: string;
  mongoConnected: boolean;
  mongoDatabase: string;
  timestampUtc: string;
};

export type DatabasePingResponse = {
  mongoConnected: boolean;
  error?: string | null;
};

export type HelloResponse = {
  message: string;
  normalizedName: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export async function fetchDbPing(): Promise<DatabasePingResponse> {
  return request<DatabasePingResponse>("/api/db/ping");
}

export async function postHello(name: string): Promise<HelloResponse> {
  return request<HelloResponse>("/api/hello", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
