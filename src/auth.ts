import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authenticateUser } from "@/db/users";

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
        const user = await authenticateUser(username, password);
        if (!user) return null;
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
      }
      if (trigger === "update" && session && typeof session.name === "string") {
        token.name = session.name;
      }
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
