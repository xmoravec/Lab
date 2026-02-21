import Image from "next/image";
import Link from "next/link";

import type { GameCard as GameCardModel } from "@/lib/content-api";

type GameCardProps = {
  game: GameCardModel;
  compact?: boolean;
  featured?: boolean;
  imagePriority?: boolean;
};

const GAME_SCREENSHOT_BY_SLUG: Record<string, string> = {
  chess: "/assets/screenshots/chess.png",
  wordle: "/assets/screenshots/wordle.png",
};

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "playable") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (normalized === "in-progress") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  return "border-zinc-700 bg-zinc-800/70 text-zinc-300";
}

function statusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "in-progress") {
    return "In Progress";
  }
  if (normalized === "coming-soon") {
    return "Coming Soon";
  }
  if (normalized === "playable") {
    return "Playable";
  }
  return status;
}

export function GameCard({ game, compact = false, featured = false, imagePriority = false }: GameCardProps) {
  const detailsHref =
    game.slug === "wordle"
      ? "/games/wordle"
      : game.slug === "chess"
        ? "/games/chess"
        : `/games#${game.slug}`;
  const playable = game.status.trim().toLowerCase() === "playable";
  const actionLabel = playable ? "Play now" : "View details";
  const screenshotPath = GAME_SCREENSHOT_BY_SLUG[game.slug] ?? null;

  return (
    <article
      className={`group rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-sm shadow-black/20 transition hover:border-zinc-700 hover:bg-zinc-900 ${
        featured ? "md:p-6" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={`h-2.5 w-16 rounded-full bg-linear-to-r ${game.accent}`} aria-hidden />
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(game.status)}`}>
          {statusLabel(game.status)}
        </span>
      </div>

      <h3 className={`font-semibold tracking-tight text-zinc-100 ${featured ? "text-2xl" : "text-xl"}`}>
        <Link href={detailsHref} aria-label={`Open ${game.name}`} className="transition hover:text-fuchsia-200">
          {game.name}
        </Link>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{game.summary}</p>

      {screenshotPath ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/70">
          <div className="relative aspect-video w-full">
            <Image
              src={screenshotPath}
              alt={`${game.name} screenshot`}
              fill
              sizes="(min-width: 768px) 480px, 100vw"
              priority={imagePriority}
              fetchPriority={imagePriority ? "high" : "auto"}
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end text-sm text-zinc-400">
        {!compact ? (
          <Link
            href={detailsHref}
            aria-label={`${actionLabel} ${game.name}`}
            className={
              playable
                ? "inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-400 px-5 py-2.5 text-base font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-emerald-900/35 transition hover:-translate-y-0.5 hover:bg-emerald-300"
                : "rounded-md px-2 py-1 font-medium text-fuchsia-300 transition group-hover:text-fuchsia-200 hover:bg-zinc-800"
            }
          >
            {playable ? (
              <>
                <span>{actionLabel}</span>
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/95"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" focusable="false">
                    <path d="M8.2 5.25v13.5c0 .62.67 1.01 1.2.7l10.05-6.75a.81.81 0 0 0 0-1.4L9.4 4.55a.81.81 0 0 0-1.2.7Z" />
                  </svg>
                </span>
              </>
            ) : (
              actionLabel
            )}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
