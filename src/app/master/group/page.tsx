import type { Metadata } from "next";
import { GroupMaster } from "@/components/GroupMaster";

export const metadata: Metadata = {
  title: "Master group",
};

export default function GroupMasterPage() {
  return <GroupMaster />;
}
