import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "The Playground (Lab)",
  description: "FastAPI + Next.js + MongoDB playground",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
