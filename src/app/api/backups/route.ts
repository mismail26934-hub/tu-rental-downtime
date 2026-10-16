import { NextResponse } from "next/server";
import { listBackups } from "@/db/backup";
import { requireWriter } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const backups = await listBackups();
  return NextResponse.json({ backups });
}
