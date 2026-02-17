import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata = {
  title: "The Playground (Lab)",
  description: "FastAPI + Next.js + MongoDB playground",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.2),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.18),transparent_30%)]" />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
