import Link from "next/link";

import { auth, signOut } from "@/auth";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/dev-log", label: "Dev Log" },
];

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-base font-semibold tracking-tight text-zinc-100">
          The Playground <span className="text-fuchsia-400">Lab</span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {session?.user?.id ? (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 sm:inline-flex">
                @{session.user.username}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/account/sign-in"
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                Sign in
              </Link>
              <Link
                href="/account/sign-up"
                className="rounded-md border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-2 text-sm font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
