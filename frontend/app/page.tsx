import Image from "next/image";
import Link from "next/link";

import { auth } from "@/auth";
import { GameCard } from "@/components/game-card";
import { SpotlightVerticalSlideshow, type SpotlightSlide } from "@/components/spotlight-vertical-slideshow";
import { SectionTitle } from "@/components/section-title";
import { fetchHomeContent, fetchWordleLeaderboard } from "@/lib/content-api";

export default async function HomePage() {
  const session = await auth();
  const home = await fetchHomeContent();
  const leaderboard = await fetchWordleLeaderboard();
  const playableGames = home.featuredGames.filter((game) => game.status.toLowerCase() === "playable");
  const chessPlayable = playableGames.find((game) => game.slug === "chess") ?? null;
  const spotlightGame = chessPlayable ?? playableGames[0] ?? home.featuredGames[0] ?? null;
  const upcomingGames = home.featuredGames.filter((game) => game.slug !== spotlightGame?.slug);
  const leaderboardLeader = leaderboard.entries[0] ?? null;
  const screenshotByGameSlug: Record<string, string> = {
    chess: "/assets/screenshots/chess.png",
    wordle: "/assets/screenshots/wordle.png",
  };
  const spotlightSlides: SpotlightSlide[] = [
    ...playableGames
      .filter((game) => Boolean(screenshotByGameSlug[game.slug]))
      .map((game) => ({
        id: `game-${game.slug}`,
        kind: "game" as const,
        title: game.name,
        summary: game.summary,
        href:
          game.slug === "wordle"
            ? "/games/wordle"
            : game.slug === "chess"
              ? "/games/chess"
              : `/games#${game.slug}`,
        screenshotPath: screenshotByGameSlug[game.slug],
        statusLabel: "Playable",
      })),
    {
      id: "tool-wordle-solver",
      kind: "tool",
      title: "Wordle Solver",
      summary: "Apply clue rows and get ranked candidate suggestions with fast narrowing.",
      href: "/tools/wordle_solver",
      screenshotPath: "/assets/screenshots/wordle_solver.png",
      statusLabel: "Tool · Live",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/85 p-8 md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Now Playing</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
          {home.heroTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-zinc-300">{home.heroSubtitle}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/games/chess"
            className="rounded-2xl border border-amber-400/50 bg-amber-500/20 px-5 py-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30"
          >
            Play Chess
          </Link>
          <Link
            href="/games/wordle"
            className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/15 px-5 py-4 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
          >
            Play Wordle
          </Link>
          {session?.user?.id ? (
            <Link
              href="/leaderboards"
              className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              View leaderboards
            </Link>
          ) : (
            <Link
              href="/account/sign-up"
              className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Create account
            </Link>
          )}
          <Link
            href="/games"
            className="rounded-2xl border border-zinc-700 bg-zinc-950/70 px-5 py-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
          >
            Browse all games
          </Link>
          <Link
            href="/tools"
            className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            Open Tools (Wordle Solver)
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
              subtitle="Featured games and tools in a simple horizontal carousel."
            />
          </div>
          <SpotlightVerticalSlideshow slides={spotlightSlides} />
        </section>
      ) : null}

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Player Identity</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-100">
            {session?.user?.id ? `Welcome back, @${session.user.username}` : "Sign in for personalized progress"}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Keep personal Wordle history, continue active rounds, and climb shared rankings.
          </p>
          <div className="mt-4">
            <Link
              href={session?.user?.id ? "/games/wordle" : "/account/sign-in"}
              className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
            >
              {session?.user?.id ? "Continue Wordle" : "Sign in"}
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-300">Leaderboard Pulse</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-100">Wordle ELO is live</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {leaderboardLeader
              ? `Current #1 is @${leaderboardLeader.username} with ${leaderboardLeader.eloScore} ELO.`
              : "No entries yet. Be the first ranked player."}
          </p>
          <div className="mt-4">
            <Link
              href="/leaderboards"
              className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            >
              Open leaderboards
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">New Tool</p>
          <h2 className="mt-2 text-xl font-semibold text-cyan-50">Wordle Solver Lab</h2>
          <p className="mt-2 text-sm text-cyan-100/85">
            Paste your guess feedback grid and get ranked next-word suggestions with candidate narrowing.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-cyan-300/30 bg-zinc-950/40">
            <div className="relative aspect-video w-full">
              <Image
                src="/assets/screenshots/wordle_solver.png"
                alt="Wordle Solver screenshot"
                fill
                sizes="(min-width: 768px) 420px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/tools"
              className="rounded-lg border border-cyan-300/60 bg-cyan-300/20 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/30"
            >
              Try the solver
            </Link>
          </div>
        </article>
      </section>

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
