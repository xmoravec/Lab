import { cookies } from "next/headers";

import { auth } from "@/auth";

const ADMIN_MODE_COOKIE_NAME = "lab_admin_mode";

export async function GET(): Promise<Response> {
  const session = await auth();
  const cookieStore = await cookies();

  const isAdmin = Boolean(session?.user?.isAdmin);
  const adminModeEnabled = isAdmin && cookieStore.get(ADMIN_MODE_COOKIE_NAME)?.value === "on";

  return Response.json({
    isAdmin,
    adminModeEnabled,
  });
}
