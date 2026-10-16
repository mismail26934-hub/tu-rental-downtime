import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { authConfig } from "@/auth.config";
import { authenticateUser, findAuthUserById } from "@/db/users";
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-rate-limit";

const REVALIDATE_MS = 60_000;

class LoginLockedError extends CredentialsSignin {
  code = "login_locked";
}

async function requestIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "local"
    );
  } catch {
    return "local";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username || "");
        const password = String(credentials?.password || "");
        const ip = await requestIp();
        const gate = assertLoginAllowed(username, ip);
        if (!gate.ok) {
          throw new LoginLockedError();
        }
        const user = await authenticateUser(username, password);
        if (!user) {
          recordLoginFailure(username, ip);
          return null;
        }
        clearLoginFailures(username, ip);
        return {
          id: user.id,
          name: user.name || user.username,
          email: user.username,
          level: user.level,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id || "";
        token.level = user.level;
        token.name = user.name;
        token.lastCheck = Date.now();
        return token;
      }
      if (trigger === "update" && session && typeof session.name === "string") {
        token.name = session.name;
      }
      const id = String(token.id || "");
      if (!id) return null;
      const lastCheck = Number(token.lastCheck || 0);
      if (Date.now() - lastCheck < REVALIDATE_MS) return token;
      const dbUser = await findAuthUserById(id);
      if (!dbUser || dbUser.active !== "1") return null;
      token.level = dbUser.level;
      token.name = dbUser.name || token.name;
      token.lastCheck = Date.now();
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.id || "");
      session.user.level = String(token.level || "");
      if (token.name) session.user.name = String(token.name);
      return session;
    },
  },
});
