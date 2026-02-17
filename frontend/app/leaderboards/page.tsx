import { SectionTitle } from "@/components/section-title";
import { fetchWordleLeaderboard } from "@/lib/content-api";

type PodiumStyle = {
  cardClassName: string;
  badgeClassName: string;
  eloClassName: string;
  title: string;
  icon: string;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function podiumStyle(position: number): PodiumStyle {
  if (position === 1) {
    return {
      cardClassName:
        "border-amber-300/60 bg-gradient-to-br from-amber-400/20 via-yellow-300/10 to-amber-500/20 shadow-xl shadow-amber-500/20",
      badgeClassName: "border-amber-300/70 bg-amber-300/20 text-amber-100",
      eloClassName: "border-amber-300/60 bg-amber-300/20 text-amber-100",
      title: "Gold Crown",
      icon: "👑",
    };
  }

  if (position === 2) {
    return {
      cardClassName:
        "border-zinc-400/60 bg-gradient-to-br from-zinc-300/20 via-zinc-200/10 to-zinc-500/20 shadow-lg shadow-zinc-400/15",
      badgeClassName: "border-zinc-300/70 bg-zinc-200/20 text-zinc-100",
      eloClassName: "border-zinc-300/60 bg-zinc-200/20 text-zinc-100",
      title: "Silver Shield",
      icon: "🥈",
    };
  }

  return {
    cardClassName:
      "border-orange-400/60 bg-gradient-to-br from-orange-500/20 via-amber-800/10 to-orange-700/20 shadow-lg shadow-orange-500/15",
    badgeClassName: "border-orange-300/70 bg-orange-400/20 text-orange-100",
    eloClassName: "border-orange-300/60 bg-orange-400/20 text-orange-100",
    title: "Bronze Blaze",
    icon: "🥉",
  };
}

export default async function LeaderboardsPage() {
  const leaderboard = await fetchWordleLeaderboard();
  const topThree = leaderboard.entries.slice(0, 3);
  const remaining = leaderboard.entries.slice(3);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/85 p-7 md:p-8">
        <SectionTitle
          title="Leaderboards"
          subtitle="Cross-game ranking hub. Wordle ELO is live now, with more games joining soon."
        />

        <p className="mt-3 text-sm text-zinc-400">
          Generated: {new Date(leaderboard.generatedAt).toLocaleString()} · Ranking model: ELO blend (wins,
          consistency, and volume)
        </p>
      </section>

      <section className="mt-8">
        <SectionTitle title="Wordle Top 3" subtitle="Current podium based on personalized match outcomes." />

        {topThree.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">
            No ranked players yet. Play Wordle to become the first entry.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-6">
            {topThree.map((entry, index) => {
              const position = index + 1;
              const style = podiumStyle(position);
              const isFirst = position === 1;

              return (
                <article
                  key={entry.userId}
                  className={`rounded-2xl border p-5 ${style.cardClassName} ${isFirst ? "md:col-span-3 md:scale-[1.02]" : "md:col-span-3 lg:col-span-1"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${style.badgeClassName}`}>
                      Rank #{entry.rank}
                    </span>
                    <span className="text-2xl" role="img" aria-label={`${style.title} icon`}>
                      {style.icon}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200/80">{style.title}</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-zinc-100">@{entry.username}</h3>
                  <p className="mt-1 text-sm text-zinc-200/85">
                    {entry.wins}W · {entry.losses}L · {formatPercent(entry.winRate)} win rate
                  </p>

                  <div className={`mt-4 rounded-xl border px-3 py-2 ${style.eloClassName}`}>
                    <p className="text-xs uppercase tracking-[0.12em]">ELO Score</p>
                    <p className="text-2xl font-black">{entry.eloScore}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle title="Full Ranking" subtitle="Top players and consistency metrics." />

        <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800">
          <table className="w-full border-collapse bg-zinc-900/85 text-left text-sm">
            <thead className="bg-zinc-950/90 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">ELO</th>
                <th className="px-4 py-3">Win Rate</th>
                <th className="px-4 py-3">Games</th>
                <th className="px-4 py-3">Avg Attempts</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.entries.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-zinc-400" colSpan={6}>
                    No leaderboard entries yet.
                  </td>
                </tr>
              ) : (
                [...topThree, ...remaining].map((entry) => (
                  <tr key={entry.userId} className="border-t border-zinc-800 text-zinc-200">
                    <td className="px-4 py-3 font-semibold">#{entry.rank}</td>
                    <td className="px-4 py-3">@{entry.username}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-200">{entry.eloScore}</td>
                    <td className="px-4 py-3">{formatPercent(entry.winRate)}</td>
                    <td className="px-4 py-3">{entry.gamesPlayed}</td>
                    <td className="px-4 py-3">{entry.averageAttempts.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
