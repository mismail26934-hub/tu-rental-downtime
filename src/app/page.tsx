import type { Metadata } from "next";
import { DtSummary } from "@/components/DtSummary";

export const metadata: Metadata = {
  title: "Summary DT — ARMOR",
};

export default function HomePage() {
  return <DtSummary />;
}
