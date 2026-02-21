"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getStoredCookieConsent,
  setStoredCookieConsent,
  type CookieConsentChoice,
} from "@/lib/privacy/consent";

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredCookieConsent();
    setIsVisible(existing === null);
  }, []);

  function handleChoice(choice: CookieConsentChoice) {
    setStoredCookieConsent(choice);
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-700 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-zinc-300">
          This site uses required cookies for sign-in/session and optional analytics cookies for usage insights.
          <span className="ml-1">
            See <Link href="/privacy" className="font-medium text-cyan-300 hover:text-cyan-200">Privacy Policy</Link>.
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => handleChoice("rejected")}
            className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500"
          >
            Keep required only
          </button>
          <button
            type="button"
            onClick={() => handleChoice("accepted")}
            className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}