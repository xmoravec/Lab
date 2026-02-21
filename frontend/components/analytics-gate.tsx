"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";

import {
  COOKIE_CONSENT_UPDATED_EVENT,
  getStoredCookieConsent,
  type CookieConsentChoice,
} from "@/lib/privacy/consent";

export function AnalyticsGate() {
  const [consent, setConsent] = useState<CookieConsentChoice | null>(null);

  useEffect(() => {
    setConsent(getStoredCookieConsent());

    function handleConsentUpdate(event: Event) {
      const customEvent = event as CustomEvent<{ choice?: CookieConsentChoice }>;
      const nextChoice = customEvent.detail?.choice;
      if (nextChoice === "accepted" || nextChoice === "rejected") {
        setConsent(nextChoice);
        return;
      }

      setConsent(getStoredCookieConsent());
    }

    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdate);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdate);
    };
  }, []);

  if (consent !== "accepted") {
    return null;
  }

  return <Analytics />;
}