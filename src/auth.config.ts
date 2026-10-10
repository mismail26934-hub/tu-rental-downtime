import type { NextAuthConfig } from "next-auth";

function authUrlIsHttps() {
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";
  return url.startsWith("https://");
}

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 10 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [],
  trustHost: true,
  useSecureCookies: authUrlIsHttps(),
  cookies: authUrlIsHttps()
    ? undefined
    : {
        sessionToken: {
          name: "authjs.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax" as const,
            path: "/",
            secure: false,
          },
        },
      },
} satisfies NextAuthConfig;
