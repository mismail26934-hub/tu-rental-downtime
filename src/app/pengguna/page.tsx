import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UserMaster } from "@/components/UserMaster";
import { isSuperuser } from "@/lib/access";

export const metadata: Metadata = {
  title: "Pengguna — ARMOR",
};

export default async function UsersPage() {
  const session = await auth();
  if (!isSuperuser(session?.user?.level)) redirect("/");
  return <UserMaster />;
}
