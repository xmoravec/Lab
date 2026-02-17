import Link from "next/link";
import { cookies } from "next/headers";

import { auth, signOut } from "@/auth";

const ADMIN_MODE_COOKIE_NAME = "lab_admin_mode";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/tools", label: "Tools" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export async function SiteHeader() {
  const session = await auth();
  const cookieStore = await cookies();
  const isAdmin = Boolean(session?.user?.isAdmin);
  const adminModeEnabled = isAdmin && cookieStore.get(ADMIN_MODE_COOKIE_NAME)?.value === "on";

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
              {isAdmin ? (
                <form
                  action={async () => {
                    "use server";
                    const activeSession = await auth();
                    if (!activeSession?.user?.id || !activeSession.user.isAdmin) {
                      return;
                    }

                    const activeCookies = await cookies();
                    activeCookies.set(ADMIN_MODE_COOKIE_NAME, adminModeEnabled ? "off" : "on", {
                      httpOnly: true,
                      sameSite: "lax",
                      secure: process.env.NODE_ENV === "production",
                      path: "/",
                    });
                  }}
                >
                  <button
                    type="submit"
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                      adminModeEnabled
                        ? "border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/20"
                        : "border-amber-500/60 text-amber-200 hover:bg-amber-500/20"
                    }`}
                    title={adminModeEnabled ? "Click to disable admin mode" : "Click to enable admin mode"}
                  >
                    Admin {adminModeEnabled ? "ON" : "OFF"}
                  </button>
                </form>
              ) : null}
              <form
                action={async () => {
                  "use server";
                  const activeCookies = await cookies();
                  activeCookies.set(ADMIN_MODE_COOKIE_NAME, "off", {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    path: "/",
                  });
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
