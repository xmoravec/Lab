import { SectionTitle } from "@/components/section-title";

const logEntries = [
  {
    title: "Phase 1-2 foundation",
    text: "Dockerized Next.js + FastAPI + Mongo stack, typed contracts, and baseline health checks.",
  },
  {
    title: "Phase 2.5 reliability",
    text: "Added startup status reporting and improved CORS/env parsing robustness for safer deployment paths.",
  },
  {
    title: "Phase 3 content shell",
    text: "Introduced reusable content endpoints and first multi-page UX flow (Home, Games, Dev Log).",
  },
];

export default function DevLogPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <SectionTitle
        title="Dev Log"
        subtitle="Temporary notes that track experiments, tradeoffs, and implementation milestones."
      />

      <div className="mt-6 space-y-4">
        {logEntries.map((entry) => (
          <article key={entry.title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-lg font-semibold text-zinc-100">{entry.title}</h3>
            <p className="mt-2 text-sm text-zinc-300">{entry.text}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
