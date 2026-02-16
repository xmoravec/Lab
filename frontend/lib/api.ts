import { requestJson } from "@/lib/http-client";

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

export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/api/health");
}

export async function fetchDbPing(): Promise<DatabasePingResponse> {
  return requestJson<DatabasePingResponse>("/api/db/ping");
}

export async function postHello(name: string): Promise<HelloResponse> {
  return requestJson<HelloResponse>("/api/hello", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
