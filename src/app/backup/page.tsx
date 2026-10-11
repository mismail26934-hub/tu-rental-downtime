import type { Metadata } from "next";
import { BackupList } from "@/components/BackupList";

export const metadata: Metadata = {
  title: "Backup data",
};

export default function BackupPage() {
  return <BackupList />;
}
