import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const GUEST_COOKIE_NAME = "lab_guest_id";

export async function getOrCreateGuestId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (existing) {
    return existing;
  }

  const nextGuestId = randomUUID();
  cookieStore.set(GUEST_COOKIE_NAME, nextGuestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return nextGuestId;
}
