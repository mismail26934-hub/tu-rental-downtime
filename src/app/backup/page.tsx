import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BackupList } from "@/components/BackupList";
import { canManage } from "@/lib/access";
import { findAuthUserById } from "@/db/users";

export const metadata: Metadata = {
  title: "Backup data",
};

export default async function BackupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const dbUser = await findAuthUserById(session.user.id);
  if (!dbUser || dbUser.active !== "1" || !canManage(dbUser.level)) redirect("/");
  return <BackupList />;
}
