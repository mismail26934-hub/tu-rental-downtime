import type { Metadata } from "next";
import { ModelMaster } from "@/components/ModelMaster";

export const metadata: Metadata = {
  title: "Master model",
};

export default function ModelMasterPage() {
  return <ModelMaster />;
}
