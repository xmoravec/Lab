import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const backendBaseUrl = process.env.API_INTERNAL_BASE_URL ?? "http://backend:8000";
const internalAuthSecret = process.env.BACKEND_INTERNAL_AUTH_SECRET ?? "lab-internal-dev-secret";

type BackendAccount = {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
};

type BackendCredentialsVerifyResponse = {
  account: BackendAccount;
};

const ADMIN_SYNC_INTERVAL_MS = 60_000;

function sanitizeUsername(input: string): string {
  const raw = input.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const normalized = raw.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized.length >= 3) {
    return normalized.slice(0, 24);
  }
  return `player_${Math.random().toString(36).slice(2, 8)}`;
}

async function verifyCredentials(email: string, password: string): Promise<BackendAccount | null> {
  const response = await fetch(`${backendBaseUrl}/api/auth/credentials/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-auth": internalAuthSecret,
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as BackendCredentialsVerifyResponse;
  return payload.account;
}

async function upsertGoogleAccount(params: {
  providerAccountId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}): Promise<BackendAccount | null> {
  const username = sanitizeUsername(params.email.split("@")[0] ?? "player");

  const response = await fetch(`${backendBaseUrl}/api/auth/oauth/google/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-auth": internalAuthSecret,
    },
    body: JSON.stringify({
      providerAccountId: params.providerAccountId,
      email: params.email,
      username,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as BackendCredentialsVerifyResponse;
  return payload.account;
}

async function fetchAccountById(params: {
  userId: string;
  username: string;
  email: string;
}): Promise<BackendAccount | null> {
  const response = await fetch(`${backendBaseUrl}/api/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-internal-auth": internalAuthSecret,
      "x-user-id": params.userId,
      "x-user-name": params.username,
      "x-user-email": params.email,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as BackendCredentialsVerifyResponse;
  return payload.account;
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email and Password",
    credentials: {
      email: {},
      password: {},
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");

      if (!email || !password) {
        return null;
      }

      const account = await verifyCredentials(email, password);
      if (!account) {
        return null;
      }

      return {
        id: account.userId,
        email: account.email,
        name: account.displayName,
        image: account.avatarUrl ?? null,
        username: account.username,
        isAdmin: account.isAdmin,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/account/sign-in",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.userId = user.id;
        token.username = (user as { username?: string }).username;
        token.isAdmin = Boolean((user as { isAdmin?: boolean }).isAdmin);
        token.adminSyncedAt = Date.now();
      }

      if (
        account?.provider === "google" &&
        account.providerAccountId &&
        typeof token.email === "string" &&
        token.email
      ) {
        const linkedAccount = await upsertGoogleAccount({
          providerAccountId: account.providerAccountId,
          email: token.email,
          displayName: typeof token.name === "string" && token.name ? token.name : token.email,
          avatarUrl: typeof token.picture === "string" ? token.picture : null,
        });

        if (linkedAccount) {
          token.userId = linkedAccount.userId;
          token.username = linkedAccount.username;
          token.isAdmin = linkedAccount.isAdmin;
          token.name = linkedAccount.displayName;
          token.picture = linkedAccount.avatarUrl ?? undefined;
          token.email = linkedAccount.email;
          token.adminSyncedAt = Date.now();
        }
      }

      const canRefreshAdmin =
        typeof token.userId === "string" &&
        token.userId.length > 0 &&
        typeof token.username === "string" &&
        token.username.length > 0 &&
        typeof token.email === "string" &&
        token.email.length > 0;

      if (canRefreshAdmin) {
        const lastSyncedAt = typeof token.adminSyncedAt === "number" ? token.adminSyncedAt : 0;
        const shouldRefresh = Date.now() - lastSyncedAt > ADMIN_SYNC_INTERVAL_MS;

        if (shouldRefresh) {
          const refreshedAccount = await fetchAccountById({
            userId: token.userId,
            username: token.username,
            email: token.email,
          });

          if (refreshedAccount) {
            token.username = refreshedAccount.username;
            token.isAdmin = refreshedAccount.isAdmin;
            token.name = refreshedAccount.displayName;
            token.picture = refreshedAccount.avatarUrl ?? undefined;
            token.email = refreshedAccount.email;
          }

          token.adminSyncedAt = Date.now();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : "";
        session.user.username = typeof token.username === "string" ? token.username : "";
        session.user.isAdmin = Boolean(token.isAdmin);
      }

      return session;
    },
  },
});
