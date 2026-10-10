import type { Metadata } from "next";
import { UnitMaster } from "@/components/UnitMaster";

export const metadata: Metadata = {
  title: "Master unit — HANDOVER",
};

export default function UnitMasterPage() {
  return <UnitMaster />;
}
