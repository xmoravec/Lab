import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-zinc-800/80 bg-zinc-950/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            Built by <span className="text-cyan-300">xmoravec</span>
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Personal website: <a href="https://www.xmoravec.com" target="_blank" rel="noreferrer" className="font-medium text-fuchsia-300 transition hover:text-fuchsia-200">www.xmoravec.com</a>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
           <span className="font-medium text-zinc-300">lab.xmoravec.com</span>
          </p>
        </div>

        <div className="text-xs text-zinc-500 md:text-right">
          <p>The Playground Lab</p>
          <p className="mt-1">
            <Link href="/privacy" className="font-medium text-cyan-300 transition hover:text-cyan-200">
              Privacy Policy
            </Link>
          </p>
          <p className="mt-1">© {year} xmoravec. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
