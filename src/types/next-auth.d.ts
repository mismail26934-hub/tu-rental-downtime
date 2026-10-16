import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      level: string;
    };
  }

  interface User {
    level: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    level: string;
    lastCheck?: number;
  }
}
