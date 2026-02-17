import Link from "next/link";
import { SectionTitle } from "@/components/section-title";

const tools = [
  {
    slug: "wordle_solver",
    name: "Wordle Solver",
    summary: "Apply green/yellow/gray clues and get ranked candidate suggestions from the same dictionaries as gameplay.",
    status: "live",
    accent: "from-cyan-500 to-fuchsia-500",
  },
];

export default function ToolsPage() {
  const liveTools = tools.filter((item) => item.status === "live");

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/85 p-7 md:p-8">
        <SectionTitle
          title="Tools"
          subtitle="Utility experiences for solving, planning, and optimization across games and experiments."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{tools.length}</p>
          </article>
          <article className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-cyan-300">Live</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-100">{liveTools.length}</p>
          </article>
          <article className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Audience</p>
            <p className="mt-1 text-sm font-semibold text-zinc-200">You + Community</p>
          </article>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle title="Tool Catalog" subtitle="Open a tool to start solving immediately." />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <article key={tool.slug} className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className={`h-2.5 w-16 rounded-full bg-linear-to-r ${tool.accent}`} aria-hidden />
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                  Live
                </span>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
                <Link href={`/tools/${tool.slug}`} className="transition hover:text-fuchsia-200">
                  {tool.name}
                </Link>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{tool.summary}</p>

              <div className="mt-5 flex items-center justify-end text-sm text-zinc-400">
                <Link
                  href={`/tools/${tool.slug}`}
                  className="rounded-md px-2 py-1 font-medium text-fuchsia-300 transition hover:bg-zinc-800 hover:text-fuchsia-200"
                >
                  Open tool
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
