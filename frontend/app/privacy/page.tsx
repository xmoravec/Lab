import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · The Playground (Lab)",
  description: "Privacy, cookies, and data handling policy for The Playground (Lab).",
};

const effectiveDate = "2026-02-21";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-7 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-100">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-400">Effective date: {effectiveDate}</p>
      </section>

      <section className="mt-6 space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-7 text-sm text-zinc-300 md:p-8">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">1. What this policy covers</h2>
          <p className="mt-2">
            This policy explains how The Playground (Lab) collects, uses, and stores data when you use the app,
            including account features, gameplay, and tools.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">2. Data collected</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Account data: email, username, display name, avatar URL (if provided by OAuth provider).</li>
            <li>Auth/session data: secure session tokens and identity/session cookies needed for sign-in.</li>
            <li>Gameplay data: game states, moves/guesses, outcomes, and leaderboard stats.</li>
            <li>Operational data: server logs and diagnostic events used for reliability and abuse protection.</li>
            <li>Analytics data (optional): aggregate usage analytics only when analytics consent is accepted.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">3. Cookies and similar storage</h2>
          <p className="mt-2">The app uses two cookie categories:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Required cookies: needed for authentication, session continuity, guest-session handling, and security.
            </li>
            <li>
              Optional analytics cookies: used by Vercel Analytics only after you choose &quot;Allow analytics&quot; in the
              consent dialog.
            </li>
          </ul>
          <p className="mt-2">
            You can decline analytics and continue using core app features. Required cookies remain active because they
            are necessary for app functionality.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">4. Why data is used</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Authenticate users and maintain sessions.</li>
            <li>Persist game progress, matchmaking context, and leaderboard ranking.</li>
            <li>Protect services from abuse (security checks, rate limiting, fraud/spam prevention).</li>
            <li>Understand aggregate app usage patterns (only with analytics consent).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">5. Data sharing and processors</h2>
          <p className="mt-2">Infrastructure and providers used by this project include:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Vercel (frontend hosting and optional analytics)</li>
            <li>Railway (backend hosting)</li>
            <li>MongoDB Atlas (database hosting)</li>
            <li>Cloudflare (DNS, proxy, and edge protections)</li>
            <li>Google OAuth (only when you use Google sign-in)</li>
          </ul>
          <p className="mt-2">Data is not sold.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">6. Retention and deletion</h2>
          <p className="mt-2">
            Account and gameplay data are retained while the account is active and as needed for application
            functionality and security. You can request account/data deletion using the contact method below.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">7. Security practices</h2>
          <p className="mt-2">
            The project uses password hashing, internal service authentication headers, role checks for privileged
            actions, and rate limiting controls. No system can be guaranteed perfectly secure, but protections are
            continuously improved.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">8. Your choices</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Choose whether to allow optional analytics in the consent prompt.</li>
            <li>Use account features or play guest-eligible modes without account creation.</li>
            <li>Request access, correction, or deletion inquiries via the contact below.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">9. Contact</h2>
          <p className="mt-2">
            For privacy questions or data requests, contact the project owner via
            <a
              href="https://www.xmoravec.com"
              target="_blank"
              rel="noreferrer"
              className="ml-1 font-medium text-cyan-300 hover:text-cyan-200"
            >
              www.xmoravec.com
            </a>
            .
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4 text-xs text-zinc-400">
          <p>
            By creating an account or using authenticated gameplay, you acknowledge this policy.
            <Link href="/account/sign-up" className="ml-1 font-medium text-cyan-300 hover:text-cyan-200">
              Create account
            </Link>
            {" · "}
            <Link href="/account/sign-in" className="font-medium text-cyan-300 hover:text-cyan-200">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
