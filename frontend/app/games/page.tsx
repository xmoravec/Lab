import { GameCard } from "@/components/game-card";
import { SectionTitle } from "@/components/section-title";
import { fetchGamesCatalog } from "@/lib/content-api";

export default async function GamesPage() {
  const games = await fetchGamesCatalog();
  const playableGames = games.items.filter((game) => game.status.toLowerCase() === "playable");
  const upcomingGames = games.items.filter((game) => game.status.toLowerCase() !== "playable");

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/85 p-7 md:p-8">
        <SectionTitle
          title="Games"
          subtitle="Playable and upcoming browser game experiments from The Playground Lab."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{games.items.length}</p>
          </article>
          <article className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">Playable</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-100">{playableGames.length}</p>
          </article>
          <article className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-amber-300">In Progress</p>
            <p className="mt-1 text-2xl font-semibold text-amber-100">{upcomingGames.length}</p>
          </article>
        </div>
      </section>

      {playableGames.length > 0 ? (
        <section className="mt-8">
          <SectionTitle title="Play Now" subtitle="Jump directly into currently playable games." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {playableGames.map((game) => (
              <div key={game.slug} id={game.slug}>
                <GameCard game={game} featured />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <SectionTitle
          title="Catalog"
          subtitle="The full list, including concepts and work-in-progress projects."
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {games.items.map((game) => (
            <div key={game.slug} id={game.slug}>
              <GameCard game={game} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
