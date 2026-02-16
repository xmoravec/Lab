import Link from "next/link";

import { GameCard } from "@/components/game-card";
import { SectionTitle } from "@/components/section-title";
import { fetchHomeContent } from "@/lib/content-api";

export default async function HomePage() {
  const home = await fetchHomeContent();
  const playableGames = home.featuredGames.filter((game) => game.status.toLowerCase() === "playable");
  const spotlightGame = playableGames[0] ?? home.featuredGames[0] ?? null;
  const upcomingGames = home.featuredGames.filter((game) => game.slug !== spotlightGame?.slug);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/85 p-8 md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Now Playing</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
          {home.heroTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-zinc-300">{home.heroSubtitle}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/games/wordle"
            className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/15 px-5 py-4 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
          >
            Play Wordle
          </Link>
          <Link
            href="/games"
            className="rounded-2xl border border-zinc-700 bg-zinc-950/70 px-5 py-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
          >
            Browse all games
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {home.highlights.map((highlight) => (
            <span
              key={highlight}
              className="rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs font-medium text-zinc-300"
            >
              {highlight}
            </span>
          ))}
        </div>
      </section>

      {spotlightGame ? (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <SectionTitle
              title="Spotlight"
              subtitle="Featured playable experience from the Lab."
            />
          </div>
          <GameCard game={spotlightGame} featured />
        </section>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <SectionTitle
            title="More Experiments"
            subtitle="Upcoming and in-progress ideas, ready to grow as the catalog expands."
          />
          <Link href="/games" className="text-sm font-medium text-fuchsia-300 hover:text-fuchsia-200">
            Open catalog
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {upcomingGames.length > 0 ? (
            upcomingGames.map((game) => <GameCard key={game.slug} game={game} compact />)
          ) : (
            <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 text-sm text-zinc-400">
              More games are being prepared. Wordle is live now while new experiments are in development.
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
