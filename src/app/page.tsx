import type { Metadata } from "next";
import { DtSummary } from "@/components/DtSummary";

export const metadata: Metadata = {
  title: { absolute: "ARMOR - Summary DT" },
};

export default function HomePage() {
  return <DtSummary />;
}
