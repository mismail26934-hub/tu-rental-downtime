import type { Metadata } from "next";
import { HandoverBoard } from "@/components/HandoverBoard";

export const metadata: Metadata = {
  title: "Daftar unit — HANDOVER",
};

export default function DaftarPage() {
  return <HandoverBoard />;
}
