"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchDbPing,
  fetchHealth,
  postHello,
  type DatabasePingResponse,
  type HealthResponse,
} from "@/lib/api";

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [dbPing, setDbPing] = useState<DatabasePingResponse | null>(null);
  const [name, setName] = useState("Lab Builder");
  const [helloMessage, setHelloMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [healthData, dbData] = await Promise.all([fetchHealth(), fetchDbPing()]);
      setHealth(healthData);
      setDbPing(dbData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const statusLabel = useMemo(() => {
    if (loading) return "Loading...";
    if (error) return `Error: ${error}`;
    return "Connected";
  }, [loading, error]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">The Playground (Lab)</h1>
      <p className="mt-2 text-zinc-300">
        Phase 1/2 baseline: Next.js frontend + FastAPI backend + MongoDB.
      </p>

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-xl font-semibold">Stack Status</h2>
        <p className="mt-2 text-sm text-zinc-300">{statusLabel}</p>

        <div className="mt-4 space-y-2 text-sm">
          <p>Backend health: {health?.status ?? "-"}</p>
          <p>Mongo connected: {String(dbPing?.mongoConnected ?? health?.mongoConnected ?? false)}</p>
          <p>Mongo database: {health?.mongoDatabase ?? "-"}</p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300"
        >
          Refresh status
        </button>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-xl font-semibold">Pydantic Request Validation Demo</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Enter your name"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await postHello(name);
                setHelloMessage(result.message);
              } catch (requestError) {
                setHelloMessage(
                  requestError instanceof Error ? requestError.message : "Request failed",
                );
              }
            }}
            className="rounded bg-emerald-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-300"
          >
            Send
          </button>
        </div>

        <p className="mt-3 text-sm text-zinc-300">{helloMessage || "No request yet."}</p>
      </section>
    </main>
  );
}
