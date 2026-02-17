"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCredentialsSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Invalid email or password.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/games/wordle";
  }

  async function handleGoogleSignIn() {
    setError(null);
    await signIn("google", { callbackUrl: "/games/wordle" });
  }

  return (
    <main className="mx-auto max-w-md px-6 pb-16 pt-12">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-100">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-400">Continue your personalized game history and leaderboard progress.</p>

        <form className="mt-6 space-y-4" onSubmit={handleCredentialsSignIn}>
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
            <span className="mb-2 block text-sm font-medium text-zinc-200">Password</span>
            <input
              type="password"
              autoComplete="current-password"
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
            className="w-full rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/15 px-4 py-2.5 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
          >
            Continue with Google
          </button>
        </div>

        <p className="mt-5 text-sm text-zinc-400">
          New here?{" "}
          <Link href="/account/sign-up" className="font-medium text-cyan-300 hover:text-cyan-200">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
