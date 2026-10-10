import type { Metadata } from "next";
import { DtSummary } from "@/components/DtSummary";

export const metadata: Metadata = {
  title: "Summary DT — HANDOVER",
};

export default function HomePage() {
  return <DtSummary />;
}
