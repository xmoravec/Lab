import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string;
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    username?: string;
    isAdmin?: boolean;
    adminSyncedAt?: number;
  }
}
