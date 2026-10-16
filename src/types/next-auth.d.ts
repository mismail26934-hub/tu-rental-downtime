import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      level: string;
      photo_name?: string;
    };
  }

  interface User {
    level: string;
    photo_name?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    level: string;
    photo_name?: string;
    lastCheck?: number;
  }
}
