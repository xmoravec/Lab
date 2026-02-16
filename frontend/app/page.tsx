import Link from "next/link";

import { GameCard } from "@/components/game-card";
import { SectionTitle } from "@/components/section-title";
import { fetchHomeContent } from "@/lib/content-api";

export default async function HomePage() {
  const home = await fetchHomeContent();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
        <p className="text-sm font-medium uppercase tracking-wider text-cyan-300">Phase 3 · Content Shell</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
          {home.heroTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-300">{home.heroSubtitle}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {home.highlights.map((highlight) => (
            <span
              key={highlight}
              className="rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300"
            >
              {highlight}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <SectionTitle
            title="Featured Games"
            subtitle="A rotating set of experiments. First up: Wordle prototype."
          />
          <Link href="/games" className="text-sm text-fuchsia-300 hover:text-fuchsia-200">
            Browse all games
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {home.featuredGames.map((game) => (
            <GameCard key={game.slug} game={game} compact />
          ))}
        </div>
      </section>
    </main>
  );
}
