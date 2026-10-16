import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth?.user);
  const isLoginPage = nextUrl.pathname.startsWith("/sign-in");
  const isApi = nextUrl.pathname.startsWith("/api");
  const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

  if (isApi) {
    if (isAuthApi) return NextResponse.next();
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isLoginPage && isLoggedIn) {
    const raw = nextUrl.searchParams.get("callbackUrl") || "/";
    const target = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    return NextResponse.redirect(new URL(target, nextUrl));
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/sign-in", nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  if (nextUrl.pathname === "/") {
    res.headers.set("Cache-Control", "private, no-store");
  }
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
