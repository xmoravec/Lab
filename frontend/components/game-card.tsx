import Link from "next/link";

import type { GameCard as GameCardModel } from "@/lib/content-api";

type GameCardProps = {
  game: GameCardModel;
  compact?: boolean;
};

export function GameCard({ game, compact = false }: GameCardProps) {
  const detailsHref = game.slug === "wordle" ? "/games/wordle" : `/games#${game.slug}`;

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={`h-2.5 w-14 rounded-full bg-linear-to-r ${game.accent}`} />
        <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
          {game.status}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-zinc-100">{game.name}</h3>
      <p className="mt-2 text-sm text-zinc-300">{game.summary}</p>

      <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
        <span>~{game.estimatedSessionMinutes} min</span>
        {!compact ? (
          <Link href={detailsHref} className="text-fuchsia-300 hover:text-fuchsia-200">
            View details
          </Link>
        ) : null}
      </div>
    </article>
  );
}
