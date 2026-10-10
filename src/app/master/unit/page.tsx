import type { Metadata } from "next";
import { UnitMaster } from "@/components/UnitMaster";

export const metadata: Metadata = {
  title: "Master unit — ARMOR",
};

export default function UnitMasterPage() {
  return <UnitMaster />;
}
