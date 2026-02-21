"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

import type { BackendRegisterResponse } from "@/lib/contracts/auth";
import { requestAppJson } from "@/lib/app-http-client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await requestAppJson<BackendRegisterResponse>("/api/account/register", {
        method: "POST",
        body: JSON.stringify({ email, username, password }),
      });

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!signInResult || signInResult.error) {
        window.location.href = "/account/sign-in";
        return;
      }

      window.location.href = "/games/wordle";
    } catch (signupError) {
      const message = signupError instanceof Error ? signupError.message : "Failed to create account";
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 pb-16 pt-12">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-100">Create account</h1>
        <p className="mt-2 text-sm text-zinc-400">Track personal game history and compete on shared leaderboards.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSignUp}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-fuchsia-500/40 transition focus:ring"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">Username</span>
            <input
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={24}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-fuchsia-500/40 transition focus:ring"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">Password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-fuchsia-500/40 transition focus:ring"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/account/sign-in" className="font-medium text-cyan-300 hover:text-cyan-200">
            Sign in
          </Link>
        </p>

        <p className="mt-3 text-xs text-zinc-500">
          By creating an account, you agree to the
          <Link href="/privacy" className="ml-1 font-medium text-cyan-300 hover:text-cyan-200">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
