export type CookieConsentChoice = "accepted" | "rejected";

export const COOKIE_CONSENT_STORAGE_KEY = "lab_cookie_consent";
export const COOKIE_CONSENT_COOKIE_NAME = "lab_cookie_consent";
export const COOKIE_CONSENT_UPDATED_EVENT = "lab-cookie-consent-updated";

function normalizeConsent(value: string | null): CookieConsentChoice | null {
  if (value === "accepted" || value === "rejected") {
    return value;
  }

  return null;
}

export function getStoredCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return normalizeConsent(raw);
  } catch {
    return null;
  }
}

export function setStoredCookieConsent(choice: CookieConsentChoice): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    // Ignore storage failures and still attempt cookie write/event dispatch.
  }

  const oneYearSeconds = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${choice}; Max-Age=${oneYearSeconds}; Path=/; SameSite=Lax`;

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, {
      detail: { choice },
    }),
  );
}