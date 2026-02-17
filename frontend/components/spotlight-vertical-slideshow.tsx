"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export type SpotlightSlide = {
  id: string;
  kind: "game" | "tool";
  title: string;
  summary: string;
  href: string;
  screenshotPath: string;
  statusLabel: string;
};

type SpotlightVerticalSlideshowProps = {
  slides: SpotlightSlide[];
};

export function SpotlightVerticalSlideshow({ slides }: SpotlightVerticalSlideshowProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const handle = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5000);

    return () => {
      window.clearInterval(handle);
    };
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <article className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 text-sm text-zinc-400">
        Spotlight content is being prepared.
      </article>
    );
  }

  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 md:p-5">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/80">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide) => (
            <div key={slide.id} className="relative aspect-16/10 w-full shrink-0">
              <Image
                src={slide.screenshotPath}
                alt={`${slide.title} screenshot`}
                fill
                sizes="(min-width: 768px) 900px, 100vw"
                className="object-contain p-4 md:p-5"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
          {slides[activeIndex]?.kind === "tool" ? "Tool Spotlight" : "Game Spotlight"}
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{slides[activeIndex]?.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{slides[activeIndex]?.summary}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
              }}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveIndex((current) => (current + 1) % slides.length);
              }}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Next
            </button>

            <div className="ml-2 flex items-center gap-1.5">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                  }}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === activeIndex ? "bg-cyan-300" : "bg-zinc-600 hover:bg-zinc-500"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300">
              {slides[activeIndex]?.statusLabel}
            </span>
            <Link
              href={slides[activeIndex]?.href ?? "/"}
              className="rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/15 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
            >
              Open
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
