import { SectionTitle } from "@/components/section-title";
import { fetchWordleLeaderboard } from "@/lib/content-api";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {topThree.map((entry) => (
              <article
                key={entry.userId}
                className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-lg shadow-black/20"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-300">
                  Rank #{entry.rank}
                </p>
                <h3 className="mt-2 text-2xl font-bold text-zinc-100">@{entry.username}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {entry.wins}W · {entry.losses}L · {formatPercent(entry.winRate)} win rate
                </p>

                <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">ELO Score</p>
                  <p className="text-2xl font-black text-emerald-100">{entry.eloScore}</p>
                </div>
              </article>
            ))}
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
