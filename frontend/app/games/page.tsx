import { GameCard } from "@/components/game-card";
import { SectionTitle } from "@/components/section-title";
import { fetchGamesCatalog } from "@/lib/content-api";

export default async function GamesPage() {
  const games = await fetchGamesCatalog();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <SectionTitle
        title="Games"
        subtitle="Catalog of playable and in-progress experiments from The Playground Lab."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {games.items.map((game) => (
          <div key={game.slug} id={game.slug}>
            <GameCard game={game} />
          </div>
        ))}
      </div>
    </main>
  );
}
