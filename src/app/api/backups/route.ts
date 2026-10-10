import { NextResponse } from "next/server";
import { listBackups } from "@/db/backup";
import { requireUser, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const backups = await listBackups();
  return NextResponse.json({ backups });
}
