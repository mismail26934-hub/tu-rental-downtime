import { NextResponse } from "next/server";
import { insertGroup, isDuplicateGroupError, listGroups } from "@/db/groups";
import { badRequest, requireUser, unauthorized } from "@/lib/http";
import { isRowId } from "@/lib/row-input";
import { parseQuota } from "@/lib/units";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const groups = await listGroups();
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    group?: string;
    quota_hrs?: unknown;
  } | null;
  const id = String(body?.id || "");
  const group = String(body?.group || "").trim();
  const quota = parseQuota(String(body?.quota_hrs ?? ""));
  if (!isRowId(id)) return badRequest("Id tidak valid");
  if (!group) return badRequest("Group wajib diisi");
  if (group.length > 128) return badRequest("Group terlalu panjang");
  if (quota == null) return badRequest("Quota Hrs harus angka");
  try {
    const saved = await insertGroup(id, { group, quota_hrs: quota });
    return NextResponse.json({ group: saved });
  } catch (error) {
    if (isDuplicateGroupError(error)) return badRequest("Group sudah ada");
    throw error;
  }
}
